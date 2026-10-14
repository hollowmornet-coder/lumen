import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async handler so rejected promises reach Express' error
 * middleware instead of becoming unhandled rejections.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
