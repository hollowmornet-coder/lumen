import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import type { Role } from '../modules/auth/auth.types';

export const AUTH_COOKIE = 'lumen_token';

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.secret) as unknown as JwtPayload;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
  return cookie ?? null;
}

/**
 * Verifies the session and loads the *current* user record.
 *
 * We deliberately re-read the user on every request instead of trusting the
 * JWT body: if an admin deactivates a member, their existing token must stop
 * working immediately rather than at expiry.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();

    let payload: JwtPayload;
    try {
      payload = verifyToken(token);
    } catch {
      throw unauthorized('Sesi Anda telah berakhir. Silakan masuk kembali.');
    }

    // Lazy import avoids a circular dependency between auth and db modules.
    const { findAuthUserById } = await import('../modules/auth/auth.service');
    const user = await findAuthUserById(payload.sub);
    if (!user) throw unauthorized('Akun tidak ditemukan.');
    if (user.status !== 'active') {
      throw forbidden('Akun Anda dinonaktifkan. Hubungi petugas perpustakaan.');
    }

    req.user = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Role-based access control. MUST be used after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Halaman ini hanya dapat diakses oleh petugas perpustakaan.'));
    }
    next();
  };
}

export const requireAdmin = requireRole('admin');
