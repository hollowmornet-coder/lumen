import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../lib/asyncHandler';
import { unauthorized } from '../../lib/errors';
import { AUTH_COOKIE, signToken } from '../../middleware/auth';
import { logActivity } from '../activity/activity.service';
import {
  changePassword,
  findAuthUserById,
  registerMember,
  updateProfile,
  verifyCredentials,
} from './auth.service';
import { toPublicUser } from './auth.types';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.schema';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LoginInput;
  const ip = req.ip ?? undefined;

  try {
    const user = await verifyCredentials(body.identifier, body.password);
    const token = signToken({ sub: user.id, username: user.username, role: user.role });

    res.cookie(AUTH_COOKIE, token, cookieOptions());

    await logActivity({
      userId: user.id,
      actorName: user.fullName,
      action: 'auth.login',
      entityType: 'auth',
      entityId: user.id,
      description: `${user.fullName} berhasil masuk`,
      ipAddress: ip,
    });

    res.json({ success: true, data: { user, token } });
  } catch (err) {
    await logActivity({
      actorName: body.identifier.slice(0, 100),
      action: 'auth.login_failed',
      entityType: 'auth',
      description: 'Percobaan masuk gagal',
      metadata: { identifier: body.identifier },
      ipAddress: ip,
    });
    throw err;
  }
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RegisterInput;
  const user = await registerMember(body);

  await logActivity({
    userId: user.id,
    actorName: user.fullName,
    action: 'auth.register',
    entityType: 'auth',
    entityId: user.id,
    description: `${user.fullName} mendaftar sebagai anggota`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({ success: true, data: { user } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await logActivity({
      userId: req.user.id,
      actorName: req.user.fullName,
      action: 'auth.logout',
      entityType: 'auth',
      entityId: req.user.id,
      description: `${req.user.fullName} keluar dari aplikasi`,
      ipAddress: req.ip ?? undefined,
    });
  }
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true, message: 'Anda telah keluar.' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();

  // Re-read the record so a hard refresh still gets the complete profile
  // (member code, class, phone, last login) rather than a trimmed subset.
  const user = await findAuthUserById(req.user.id);
  if (!user) throw unauthorized();

  res.json({ success: true, data: toPublicUser(user) });
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const body = req.body as UpdateProfileInput;
  const user = await updateProfile(req.user.id, body);

  await logActivity({
    userId: req.user.id,
    actorName: user.fullName,
    action: 'profile.update',
    entityType: 'auth',
    entityId: user.id,
    description: `${user.fullName} memperbarui profil`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: user });
});

export const changeMyPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const body = req.body as ChangePasswordInput;
  await changePassword(req.user.id, body);

  await logActivity({
    userId: req.user.id,
    actorName: req.user.fullName,
    action: 'password.change',
    entityType: 'auth',
    entityId: req.user.id,
    description: `${req.user.fullName} mengubah kata sandi`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Kata sandi berhasil diperbarui.' });
});
