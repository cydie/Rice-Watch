import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authRequired, requireRole, signToken } from '../middleware/auth.js';

const router = Router();

/** Roles an admin may assign when creating accounts (not Department Head). */
const creatableRoleMap: Record<string, UserRole> = {
  Technician: 'technician',
  'Municipal Encoder': 'encoder',
};

router.post('/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      office: user.office,
      municipality: user.municipality,
    },
  });
});

router.get('/users', authRequired, requireRole('admin'), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      office: true,
      municipality: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

router.post('/users', authRequired, requireRole('admin'), async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    office: z.string().optional(),
    municipality: z.string().optional(),
    role: z.string(),
    password: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid account data' });

  const role = creatableRoleMap[parsed.data.role];
  if (!role) {
    return res.status(400).json({
      error: 'Invalid role. Admins can only create Technician or Municipal Encoder accounts.',
    });
  }

  if (role === 'technician' && !parsed.data.municipality?.trim()) {
    return res.status(400).json({ error: 'Technicians must be assigned to a barangay' });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: parsed.data.fullName,
      office: parsed.data.office,
      municipality: role === 'technician' ? parsed.data.municipality : parsed.data.municipality || null,
      role,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      office: true,
      municipality: true,
      createdAt: true,
    },
  });

  await prisma.activity.create({
    data: {
      action: `Account created: ${user.fullName} (${role})`,
      location: parsed.data.municipality
        ? `Brgy. ${parsed.data.municipality}`
        : parsed.data.office || 'Municipal Agriculture Office - Rizal',
      userId: req.user!.userId,
    },
  });

  res.status(201).json({ message: 'Account created successfully', user });
});

router.put('/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    office: z.string().optional(),
    municipality: z.string().optional().nullable(),
    role: z.string(),
    password: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid account data' });

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  if (existing.role === 'admin') {
    return res.status(403).json({ error: 'Department Head accounts cannot be edited here' });
  }

  const role = creatableRoleMap[parsed.data.role];
  if (!role) {
    return res.status(400).json({
      error: 'Invalid role. Admins can only assign Technician or Municipal Encoder.',
    });
  }

  if (role === 'technician' && !parsed.data.municipality?.trim()) {
    return res.status(400).json({ error: 'Technicians must be assigned to a barangay' });
  }

  const newPassword = parsed.data.password?.trim();
  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const email = parsed.data.email.toLowerCase();
  if (email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) return res.status(409).json({ error: 'Email already registered' });
  }

  const data: {
    email: string;
    fullName: string;
    office: string | null | undefined;
    municipality: string | null;
    role: UserRole;
    passwordHash?: string;
  } = {
    email,
    fullName: parsed.data.fullName,
    office: parsed.data.office,
    municipality: role === 'technician' ? (parsed.data.municipality?.trim() || null) : parsed.data.municipality?.trim() || null,
    role,
  };

  if (newPassword) {
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      office: true,
      municipality: true,
      createdAt: true,
    },
  });

  await prisma.activity.create({
    data: {
      action: `Account updated: ${user.fullName} (${role})`,
      location: user.municipality
        ? `Brgy. ${user.municipality}`
        : user.office || 'Municipal Agriculture Office - Rizal',
      userId: req.user!.userId,
    },
  });

  res.json({ message: 'Account updated successfully', user });
});

router.delete('/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  if (existing.id === req.user!.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  if (existing.role === 'admin') {
    return res.status(403).json({ error: 'Department Head accounts cannot be deleted here' });
  }

  await prisma.user.delete({ where: { id: existing.id } });

  await prisma.activity.create({
    data: {
      action: `Account deleted: ${existing.fullName} (${existing.role})`,
      location: existing.municipality
        ? `Brgy. ${existing.municipality}`
        : existing.office || 'Municipal Agriculture Office - Rizal',
      userId: req.user!.userId,
    },
  });

  res.json({ success: true, message: 'Account deleted successfully' });
});

router.post('/forgot-password', async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) {
    return res.json({ message: 'If the email exists, an OTP has been sent', demoOtp: null });
  }

  const otp = '123456';
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, otp, expiresAt },
  });

  res.json({
    message: 'OTP sent to your email address',
    demoOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  });
});

router.post('/verify-otp', async (req, res) => {
  const schema = z.object({ email: z.string().email(), otp: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid OTP data' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return res.status(400).json({ error: 'Invalid OTP' });

  const token = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      otp: parsed.data.otp,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) return res.status(400).json({ error: 'Invalid or expired OTP' });
  res.json({ message: 'OTP verified', resetTokenId: token.id });
});

router.post('/reset-password', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid reset data' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return res.status(400).json({ error: 'Unable to reset password' });

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      otp: parsed.data.otp,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!resetToken) return res.status(400).json({ error: 'Invalid or expired OTP' });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { used: true },
  });

  res.json({ message: 'Password reset successful' });
});

router.get('/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, fullName: true, role: true, office: true, municipality: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

export default router;
