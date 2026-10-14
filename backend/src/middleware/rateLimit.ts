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

/** Rejects the request when a browser announces a non-HTML Accept header. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
