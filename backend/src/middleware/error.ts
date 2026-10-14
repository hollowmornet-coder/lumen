import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
    code: 'NOT_FOUND',
  });
}

/**
 * Central error handler.
 *
 * @param err - Anything thrown anywhere in the stack.
 * @param _req
 * @param res
 * @param _next
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Zod validation failure -> 422 with a field -> message map.
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Data yang dikirim tidak valid.',
      fields,
    });
    return;
  }

  // 2. Known application error -> safe to surface.
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`${err.code}: ${err.message}`, err);
    }
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  // 3. Multer upload errors -> 400.
  if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code?.startsWith?.('LIMIT_')) {
    res.status(400).json({
      success: false,
      code: 'UPLOAD_ERROR',
      message: 'Berkas yang diunggah tidak valid atau terlalu besar.',
    });
    return;
  }

  // 4. Unknown -> log fully, return a generic message. Never leak internals.
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
    ...(env.isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
  });
}
