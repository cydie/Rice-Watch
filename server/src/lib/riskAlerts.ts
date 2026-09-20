import { prisma } from './prisma.js';
import type { TechnicianScope } from './technicianScope.js';

export type RiskSeverity = 'low' | 'moderate' | 'high' | 'critical' | 'none';

export interface BarangayRiskAlert {
  barangay: string;
  score: number;
  severity: RiskSeverity;
  flags: string[];
  damagedAreaHa: number;
  standingAreaHa: number;
  plantedHa: number;
  harvestedHa: number;
}

function severityFromScore(score: number): RiskSeverity {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 25) return 'moderate';
  if (score > 0) return 'low';
  return 'none';
}

/** Standing-crop + harvest-lag early warning rules for NRS / LGU situationers. */
export async function computeRiskAlerts(scope: TechnicianScope): Promise<BarangayRiskAlert[]> {
  const reportWhere = scope.reportWhere;
  const [planting, harvest, standing] = await Promise.all([
    prisma.plantingReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.harvestReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.standingCropReport.findMany({ where: reportWhere, include: { barangay: true } }),
  ]);

  const names = new Set<string>();
  for (const r of [...planting, ...harvest, ...standing]) names.add(r.barangay.name);

  const alerts: BarangayRiskAlert[] = [];
  for (const name of names) {
    const pRows = planting.filter((r) => r.barangay.name === name);
    const hRows = harvest.filter((r) => r.barangay.name === name);
    const sRows = standing.filter((r) => r.barangay.name === name);

    const plantedHa = pRows.reduce((s, r) => s + r.areaPlanted, 0);
    const harvestedHa = hRows.reduce((s, r) => s + r.harvestedArea, 0);
    const standingAreaHa = sRows.reduce((s, r) => s + r.area, 0);
    const damagedAreaHa = sRows.reduce((s, r) => s + r.damagedArea, 0);

    let score = 0;
    const flags: string[] = [];

    const damagePct = standingAreaHa > 0 ? (damagedAreaHa / standingAreaHa) * 100 : 0;
    if (damagePct >= 20) {
      score += 30;
      flags.push(`Damaged area ${Math.round(damagePct)}% of standing`);
    } else if (damagePct >= 5) {
      score += 15;
      flags.push(`Damaged area ${Math.round(damagePct)}% of standing`);
    }

    const severePest = sRows.filter((r) => /severe/i.test(r.pestInfestation)).length;
    const modPest = sRows.filter((r) => /moderate/i.test(r.pestInfestation)).length;
    if (severePest > 0) {
      score += 25;
      flags.push(`Severe pest on ${severePest} standing record(s)`);
    } else if (modPest > 0) {
      score += 12;
      flags.push(`Moderate pest on ${modPest} standing record(s)`);
    }

    const droughtFlood = sRows.filter((r) =>
      /drought|flooded|low water/i.test(r.irrigationStatus)
    ).length;
    if (droughtFlood > 0) {
      score += 20;
      flags.push(`Irrigation stress on ${droughtFlood} standing record(s)`);
    }

    const lagHa = Math.max(plantedHa - harvestedHa - standingAreaHa, 0);
    if (plantedHa > 0 && lagHa / plantedHa >= 0.25) {
      score += 20;
      flags.push(`Planted-but-unaccounted lag ${Math.round(lagHa)} ha`);
    } else if (plantedHa > 0 && lagHa / plantedHa >= 0.1) {
      score += 10;
      flags.push(`Planted-but-unaccounted lag ${Math.round(lagHa)} ha`);
    }

    const criticalCond = sRows.filter((r) => /critical|poor/i.test(r.cropCondition)).length;
    if (criticalCond > 0) {
      score += 15;
      flags.push(`Poor/critical crop condition on ${criticalCond} record(s)`);
    }

    score = Math.min(100, score);
    alerts.push({
      barangay: name,
      score,
      severity: severityFromScore(score),
      flags,
      damagedAreaHa: Math.round(damagedAreaHa * 10) / 10,
      standingAreaHa: Math.round(standingAreaHa * 10) / 10,
      plantedHa: Math.round(plantedHa * 10) / 10,
      harvestedHa: Math.round(harvestedHa * 10) / 10,
    });
  }

  return alerts.sort((a, b) => b.score - a.score);
}

/** Persist high/critical alerts as notifications for Department Head visibility. */
export async function syncRiskNotifications(scope: TechnicianScope) {
  const alerts = await computeRiskAlerts(scope);
  const actionable = alerts.filter((a) => a.severity === 'high' || a.severity === 'critical');
  for (const a of actionable) {
    const title = `Early warning: Brgy. ${a.barangay} (${a.severity})`;
    const message = `Score ${a.score}/100 — ${a.flags.join('; ') || 'Review standing crop'}`;
    const existing = await prisma.notification.findFirst({
      where: { title, read: false },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) continue;
    await prisma.notification.create({
      data: { title, message, read: false },
    });
  }
  return { alerts, notified: actionable.length };
}
