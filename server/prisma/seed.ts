import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, SitioType } from '@prisma/client';

const prisma = new PrismaClient();

const BARANGAYS = [
  { name: 'Bunog', area: 125.5, classification: 'Irrigated' },
  { name: 'Campong Ulay', area: 98.3, classification: 'Irrigated' },
  { name: 'Candawaga', area: 75.8, classification: 'Rainfed' },
  { name: 'Canipaan', area: 68.2, classification: 'Irrigated' },
  { name: 'Culasian', area: 55.4, classification: 'Rainfed' },
  { name: 'Iraan', area: 48.9, classification: 'Irrigated' },
  { name: 'Latud', area: 42.6, classification: 'Rainfed' },
  { name: 'Panalingaan', area: 38.3, classification: 'Irrigated' },
  { name: 'Punta Baja (Poblacion)', area: 35.7, classification: 'Rainfed' },
  { name: 'Ransang', area: 32.1, classification: 'Irrigated' },
  { name: 'Taburi', area: 0, classification: 'Rainfed' },
];

const SITIOS: { barangayName: string; name: string; type: SitioType }[] = [
  { barangayName: 'Bunog', name: 'Sitio 1', type: 'Sitio' },
  { barangayName: 'Bunog', name: 'Sitio 2', type: 'Sitio' },
  { barangayName: 'Bunog', name: 'Purok 1', type: 'Purok' },
  { barangayName: 'Campong Ulay', name: 'Sitio Centro', type: 'Sitio' },
  { barangayName: 'Campong Ulay', name: 'Purok 1', type: 'Purok' },
  { barangayName: 'Candawaga', name: 'Sitio Riverside', type: 'Sitio' },
  { barangayName: 'Latud', name: 'Purok 1', type: 'Purok' },
  { barangayName: 'Latud', name: 'Purok 2', type: 'Purok' },
];

const USERS = [
  {
    email: 'admin@da.gov.ph',
    password: 'admin123',
    fullName: 'Department Head',
    role: 'admin' as const,
    municipality: null as string | null,
  },
  {
    email: 'technician@da.gov.ph',
    password: 'tech123',
    fullName: 'Field Technician',
    role: 'technician' as const,
    municipality: 'Latud',
  },
  {
    email: 'encoder@municipality.gov.ph',
    password: 'encoder123',
    fullName: 'Municipal Encoder',
    role: 'encoder' as const,
    municipality: null as string | null,
  },
];

async function main() {
  console.log('Seeding RiceWatch database...');

  // Remove obsolete demo accounts from the old role model
  await prisma.user.deleteMany({
    where: { email: { in: ['staff@da.gov.ph', 'viewer@da.gov.ph'] } },
  });

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        role: u.role,
        municipality: u.municipality,
        passwordHash: await bcrypt.hash(u.password, 10),
      },
      create: {
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        fullName: u.fullName,
        role: u.role,
        office: 'Department of Agriculture - Rizal',
        municipality: u.municipality,
      },
    });
  }

  for (const b of BARANGAYS) {
    await prisma.barangay.upsert({
      where: { name: b.name },
      update: { area: b.area, classification: b.classification },
      create: b,
    });
  }

  for (const s of SITIOS) {
    const barangay = await prisma.barangay.findUnique({ where: { name: s.barangayName } });
    if (!barangay) continue;
    const existing = await prisma.sitio.findFirst({
      where: { barangayId: barangay.id, name: s.name },
    });
    if (!existing) {
      await prisma.sitio.create({
        data: { barangayId: barangay.id, name: s.name, type: s.type },
      });
    }
  }

  const latud = await prisma.barangay.findUnique({ where: { name: 'Latud' } });
  const campong = await prisma.barangay.findUnique({ where: { name: 'Campong Ulay' } });
  const ransang = await prisma.barangay.findUnique({ where: { name: 'Ransang' } });

  if (latud && (await prisma.plantingReport.count()) === 0) {
    await prisma.plantingReport.createMany({
      data: [
        {
          barangayId: latud.id,
          sitio: 'Purok 1',
          farmerCount: 45,
          seedVariety: 'NSIC Rc222',
          areaPlanted: 125.5,
          datePlanted: new Date('2026-03-15'),
          irrigationType: 'Irrigated',
          season: 'Wet Season',
          expectedHarvest: new Date('2026-07-15'),
        },
        {
          barangayId: campong!.id,
          sitio: 'Sitio Centro',
          farmerCount: 32,
          seedVariety: 'PSB Rc82',
          areaPlanted: 98.3,
          datePlanted: new Date('2026-03-20'),
          irrigationType: 'Rainfed',
          season: 'Wet Season',
          expectedHarvest: new Date('2026-07-20'),
        },
        {
          barangayId: ransang!.id,
          sitio: '-',
          farmerCount: 28,
          seedVariety: 'NSIC Rc160',
          areaPlanted: 75.8,
          datePlanted: new Date('2026-04-01'),
          irrigationType: 'Irrigated',
          season: 'Wet Season',
          expectedHarvest: new Date('2026-08-01'),
        },
      ],
    });

    await prisma.harvestReport.createMany({
      data: [
        {
          barangayId: latud.id,
          sitio: 'Purok 1',
          harvestDate: new Date('2026-07-15'),
          harvestedArea: 125.5,
          totalProduction: 628,
          averageYield: 5.0,
          riceVariety: 'NSIC Rc222',
          irrigationType: 'Irrigated',
        },
        {
          barangayId: campong!.id,
          sitio: 'Sitio Centro',
          harvestDate: new Date('2026-07-20'),
          harvestedArea: 98.3,
          totalProduction: 442,
          averageYield: 4.5,
          riceVariety: 'PSB Rc82',
          irrigationType: 'Rainfed',
        },
      ],
    });

    await prisma.standingCropReport.createMany({
      data: [
        {
          barangayId: latud.id,
          sitio: 'Purok 1',
          cropStage: 'Vegetative',
          area: 125.5,
          cropCondition: 'Good',
          damagedArea: 0,
          pestInfestation: 'None',
          irrigationStatus: 'Normal',
          lastUpdated: new Date('2026-05-10'),
        },
        {
          barangayId: campong!.id,
          sitio: 'Sitio Centro',
          cropStage: 'Reproductive',
          area: 98.3,
          cropCondition: 'Fair',
          damagedArea: 5.2,
          pestInfestation: 'Mild',
          irrigationStatus: 'Low Water',
          lastUpdated: new Date('2026-05-12'),
        },
        {
          barangayId: ransang!.id,
          sitio: '-',
          cropStage: 'Maturing',
          area: 75.8,
          cropCondition: 'Good',
          damagedArea: 0,
          pestInfestation: 'None',
          irrigationStatus: 'Normal',
          lastUpdated: new Date('2026-05-13'),
        },
      ],
    });
  }

  if ((await prisma.notification.count()) === 0) {
    await prisma.notification.createMany({
      data: [
        { title: 'New Planting Report', message: 'A planting report was submitted in Brgy. Latud.', read: false },
        { title: 'Harvest Update', message: 'Harvest data updated for Campong Ulay.', read: false },
        { title: 'System', message: 'Welcome to RiceWatch monitoring system.', read: true },
      ],
    });
  }

  if ((await prisma.activity.count()) === 0) {
    await prisma.activity.createMany({
      data: [
        { action: 'New planting report submitted', location: 'Brgy. Latud, Purok 1' },
        { action: 'Harvest data updated', location: 'Brgy. Campong Ulay, Sitio Centro' },
        { action: 'Standing crop monitoring completed', location: 'Brgy. Ransang' },
      ],
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
