import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** Brute-force protection for login / register. */
export const authLimiter = rateLimit({
  windowMs: env.authRateLimit.windowMs,
  max: env.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Terlalu banyak percobaan. Silakan coba lagi beberapa menit lagi.',
  },
});

/** Looser limiter for general write operations (CRUD, import). */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Terlalu banyak permintaan. Mohon tunggu sejenak.',
  },
});

/**
 * File uploads get their own bucket.
 *
 * They are far heavier than a JSON write (megabytes vs kilobytes), so letting
 * them consume the CRUD budget would lock a librarian out of ordinary edits
 * after a handful of cover changes. The cap is deliberately low: a person
 * replaces a photo a few times, not fifty.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Terlalu banyak unggahan. Mohon tunggu sejenak.',
  },
});

/** Rejects the request when a browser announces a non-HTML Accept header. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
