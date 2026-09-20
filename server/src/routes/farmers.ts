import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../middleware/auth.js';
import { parseId } from '../lib/helpers.js';
import { getTechnicianScope } from '../lib/technicianScope.js';

const router = Router();
router.use(authRequired);

function serialize(farmer: {
  id: number;
  rsbsaNumber: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  farmerAddress1: string;
  farmerAddress2: string;
  farmerAddress3: string;
  farmAddress2: string;
  farmAddress3: string;
  birthdate: Date | null;
  sex: string;
  contactNo: string;
  fourPs: boolean;
  indigenous: boolean;
  pwd: boolean;
  farmArea: number;
  areaPlanted: number | null;
  commodity: string;
  farmerGeoCode: string | null;
  farmGeoCode: string | null;
  barangayId: number | null;
  barangay: { name: string } | null;
}) {
  return {
    id: farmer.id,
    rsbsaNumber: farmer.rsbsaNumber,
    lastName: farmer.lastName,
    firstName: farmer.firstName,
    middleName: farmer.middleName,
    suffix: farmer.suffix,
    fullName: [farmer.firstName, farmer.middleName, farmer.lastName, farmer.suffix]
      .filter(Boolean)
      .join(' '),
    farmerAddress1: farmer.farmerAddress1,
    farmerAddress2: farmer.farmerAddress2,
    farmerAddress3: farmer.farmerAddress3,
    farmAddress2: farmer.farmAddress2,
    farmAddress3: farmer.farmAddress3,
    birthdate: farmer.birthdate?.toISOString().split('T')[0] ?? null,
    sex: farmer.sex,
    contactNo: farmer.contactNo,
    fourPs: farmer.fourPs,
    indigenous: farmer.indigenous,
    pwd: farmer.pwd,
    farmArea: farmer.farmArea,
    areaPlanted: farmer.areaPlanted,
    commodity: farmer.commodity,
    farmerGeoCode: farmer.farmerGeoCode,
    farmGeoCode: farmer.farmGeoCode,
    barangay: farmer.barangay?.name ?? farmer.farmerAddress1,
    barangayId: farmer.barangayId,
  };
}

router.get('/stats', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const baseWhere =
    scope.barangayId != null
      ? { barangayId: scope.barangayId }
      : scope.isTechnician
        ? { barangayId: { in: [] as number[] } }
        : {};

  const [total, byBarangay] = await Promise.all([
    prisma.farmer.count({ where: baseWhere }),
    prisma.farmer.groupBy({
      by: ['barangayId'],
      where: baseWhere,
      _count: { id: true },
      _sum: { farmArea: true },
    }),
  ]);

  const barangays = await prisma.barangay.findMany(
    scope.barangayId != null ? { where: { id: scope.barangayId } } : undefined
  );
  const barangayNames = new Map(barangays.map((b) => [b.id, b.name]));

  res.json({
    scope: {
      level: scope.isTechnician ? 'barangay' : 'municipality',
      barangay: scope.barangayName,
    },
    total,
    byBarangay: byBarangay.map((row) => ({
      barangay: row.barangayId ? barangayNames.get(row.barangayId) ?? 'Unknown' : 'Unassigned',
      count: row._count.id,
      totalFarmArea: row._sum.farmArea ?? 0,
    })),
  });
});

router.get('/', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const search = String(req.query.search ?? '').trim();
  let barangay = String(req.query.barangay ?? '').trim();
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const skip = (page - 1) * limit;

  // Technicians are locked to their assigned barangay
  if (scope.isTechnician) {
    barangay = scope.barangayName || '__none__';
  }

  const where: Record<string, unknown> = {};
  if (scope.isTechnician && scope.barangayId != null) {
    where.barangayId = scope.barangayId;
  } else if (scope.isTechnician) {
    where.barangayId = { in: [] };
  }

  if (search) {
    where.OR = [
      { lastName: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { rsbsaNumber: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (barangay && !scope.isTechnician) {
    where.barangay = { name: { equals: barangay, mode: 'insensitive' } };
  }

  const [farmers, total] = await Promise.all([
    prisma.farmer.findMany({
      where,
      include: { barangay: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.farmer.count({ where }),
  ]);

  res.json({
    data: farmers.map(serialize),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get('/:id', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const farmer = await prisma.farmer.findUnique({
    where: { id },
    include: { barangay: true },
  });
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });

  if (scope.isTechnician) {
    if (scope.barangayId == null || farmer.barangayId !== scope.barangayId) {
      return res.status(403).json({ error: 'Access limited to your assigned barangay' });
    }
  }

  res.json(serialize(farmer));
});

export default router;
