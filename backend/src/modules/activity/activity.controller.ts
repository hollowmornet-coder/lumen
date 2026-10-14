import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { listActivity } from './activity.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listActivity({
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    action: typeof req.query.action === 'string' ? req.query.action : undefined,
  });
  res.json({ success: true, data: result.items, meta: result.meta });
});
