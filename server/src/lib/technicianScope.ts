import { Request } from 'express';
import { prisma } from './prisma.js';

export type TechnicianScope = {
  isTechnician: boolean;
  barangayId: number | null;
  barangayName: string | null;
  /** Prisma where for models with barangayId */
  reportWhere: { barangayId?: number } | { barangayId: { in: number[] } } | Record<string, never>;
};

/** Resolve assigned barangay scope for the current user (technicians only). */
export async function getTechnicianScope(req: Request): Promise<TechnicianScope> {
  if (req.user?.role !== 'technician') {
    return {
      isTechnician: false,
      barangayId: null,
      barangayName: null,
      reportWhere: {},
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { municipality: true },
  });

  const barangayName = user?.municipality?.trim() || null;
  if (!barangayName) {
    return {
      isTechnician: true,
      barangayId: null,
      barangayName: null,
      reportWhere: { barangayId: { in: [] } },
    };
  }

  const barangay = await prisma.barangay.findUnique({ where: { name: barangayName } });
  if (!barangay) {
    return {
      isTechnician: true,
      barangayId: null,
      barangayName,
      reportWhere: { barangayId: { in: [] } },
    };
  }

  return {
    isTechnician: true,
    barangayId: barangay.id,
    barangayName: barangay.name,
    reportWhere: { barangayId: barangay.id },
  };
}

/** @deprecated Prefer getTechnicianScope */
export async function technicianBarangayWhere(req: Request) {
  const scope = await getTechnicianScope(req);
  return scope.reportWhere;
}

export async function assertTechnicianBarangayAccess(
  req: Request,
  barangayName: string
): Promise<string | null> {
  if (req.user?.role !== 'technician') return null;

  const scope = await getTechnicianScope(req);
  if (!scope.barangayName) return 'Technician has no assigned barangay';
  if (barangayName !== scope.barangayName) {
    return `Technicians can only access data for ${scope.barangayName}`;
  }
  return null;
}
