/**
 * Application error types.
 *
 * Rule: anything thrown that is NOT an AppError is treated as an
 * unexpected internal fault. The error middleware returns a generic
 * 500 for those so we never leak stack traces or SQL to the client.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, 'BAD_REQUEST', details);

export const unauthorized = (message = 'Anda harus masuk terlebih dahulu.') =>
  new AppError(401, message, 'UNAUTHORIZED');

export const forbidden = (message = 'Anda tidak memiliki izin untuk tindakan ini.') =>
  new AppError(403, message, 'FORBIDDEN');

export const notFound = (message = 'Data yang diminta tidak ditemukan.') =>
  new AppError(404, message, 'NOT_FOUND');

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, message, 'CONFLICT', details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, message, 'UNPROCESSABLE_ENTITY', details);

export const tooManyRequests = (message: string) =>
  new AppError(429, message, 'TOO_MANY_REQUESTS');

export const internal = (message = 'Terjadi kesalahan pada server.') =>
  new AppError(500, message, 'INTERNAL_ERROR');

/** Business-rule violations that are the user's fault, not a server fault. */
export class BusinessRuleError extends AppError {
  constructor(message: string, code = 'BUSINESS_RULE') {
    super(422, message, code);
    this.name = 'BusinessRuleError';
  }
}
