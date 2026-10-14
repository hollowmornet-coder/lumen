import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

/**
 * Validates and REPLACES `req.body` / `req.query` with the parsed result.
 *
 * After this middleware runs, `req.body` is guaranteed to match the schema, so
 * the `as SomeType` casts inside controllers are safe. Nothing is trusted
 * from the client without passing through a schema first.
 */
function make<T extends ZodTypeAny>(schema: T, source: 'body' | 'query') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    if (source === 'body') {
      req.body = result.data;
    } else {
      // Express 4 exposes `query` through a prototype getter; assigning on the
      // instance shadows it, which is what we want.
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}

export const validateBody = <T extends ZodTypeAny>(schema: T): RequestHandler => make(schema, 'body');
export const validateQuery = <T extends ZodTypeAny>(schema: T): RequestHandler => make(schema, 'query');

/** Convenience for routes that take both. */
export function validate(schema: { body?: ZodTypeAny; query?: ZodTypeAny }): RequestHandler[] {
  const handlers: RequestHandler[] = [];
  if (schema.query) handlers.push(validateQuery(schema.query));
  if (schema.body) handlers.push(validateBody(schema.body));
  return handlers;
}

export type Infer<T extends ZodTypeAny> = z.infer<T>;
