import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../lib/asyncHandler';
import { badRequest, unauthorized } from '../../lib/errors';
import { removeStoredFile, storeAvatar } from '../../lib/upload';
import { AUTH_COOKIE, signToken } from '../../middleware/auth';
import { logActivity } from '../activity/activity.service';
import {
  changePassword,
  clearAvatarPath,
  findAuthUserById,
  registerMember,
  setAvatarPath,
  updateProfile,
  verifyCredentials,
} from './auth.service';
import { issueResetToken, resetPasswordWithToken } from './password-reset.service';
import { toPublicUser } from './auth.types';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  RequestResetInput,
  ResetPasswordInput,
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

/**
 * Uploads a profile photo for the signed-in user.
 *
 * The response is the full, freshly-read user record so the client can adopt
 * it directly (`setUser`) instead of guessing what changed.
 */
export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  if (!req.file) throw badRequest('Pilih berkas foto terlebih dahulu.');

  const stored = await storeAvatar(req.file.buffer);

  let previousPath: string | null = null;
  try {
    previousPath = await setAvatarPath(req.user.id, stored.relativePath);
  } catch (err) {
    // Never leave an orphaned file behind when the write fails.
    await removeStoredFile(stored.relativePath);
    throw err;
  }

  // Old file goes only after the new path is committed.
  await removeStoredFile(previousPath);

  const user = await findAuthUserById(req.user.id);
  if (!user) throw unauthorized();

  await logActivity({
    userId: req.user.id,
    actorName: user.full_name,
    action: 'profile.avatar',
    entityType: 'auth',
    entityId: user.id,
    description: `${user.full_name} memperbarui foto profil`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: toPublicUser(user),
    message: 'Foto profil berhasil diperbarui.',
  });
});

export const removeAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();

  const previousPath = await clearAvatarPath(req.user.id);
  await removeStoredFile(previousPath);

  const user = await findAuthUserById(req.user.id);
  if (!user) throw unauthorized();

  await logActivity({
    userId: req.user.id,
    actorName: user.full_name,
    action: 'profile.avatar',
    entityType: 'auth',
    entityId: user.id,
    description: `${user.full_name} menghapus foto profil`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: toPublicUser(user),
    message: 'Foto profil dihapus.',
  });
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

/**
 * Step 1 of self-service reset: ask for a token.
 *
 * The token is returned in the response body only because this deployment has
 * no mail server. In a networked install the same call would send the token by
 * email and return nothing but a confirmation.
 */
export const requestReset = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RequestResetInput;
  const result = await issueResetToken(body.identifier);

  await logActivity({
    userId: result.user.id,
    actorName: result.user.fullName,
    action: 'password.reset_request',
    entityType: 'auth',
    entityId: result.user.id,
    description: `Permintaan reset kata sandi untuk ${result.user.username}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: { token: result.token, expiresAt: result.expiresAt },
    message: `Token reset berlaku sampai ${result.expiresAt}. Serahkan token ini kepada pemilik akun.`,
  });
});

/** Step 2: exchange the token for a new password. */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ResetPasswordInput;
  await resetPasswordWithToken(body.token, body.newPassword);

  await logActivity({
    actorName: 'reset-token',
    action: 'password.reset',
    entityType: 'auth',
    description: 'Kata sandi direset melalui token',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Kata sandi berhasil direset. Silakan masuk dengan kata sandi baru.' });
});
