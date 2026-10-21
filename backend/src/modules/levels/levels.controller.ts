import type { Request, Response } from 'express';
import { unauthorized } from '../../lib/errors';
import { asyncHandler } from '../../lib/asyncHandler';
import { getLeaderboard, getMemberLevel, getMemberRank } from './levels.service';
import { LEVEL_TIERS } from './levels';

/** GET /api/levels - the curve itself, so the UI never duplicates thresholds. */
export const tiers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: LEVEL_TIERS });
});

/** GET /api/levels/me - level + progress of the signed-in member. */
export const mine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();

  const [level, rank] = await Promise.all([
    getMemberLevel(req.user.id),
    getMemberRank(req.user.id),
  ]);

  res.json({ success: true, data: { ...level, rank } });
});

/** GET /api/levels/leaderboard - top readers. Visible to every signed-in user. */
export const leaderboard = asyncHandler(async (req: Request, res: Response) => {
  const raw = Number(req.query.limit ?? 10);
  const limit = Number.isFinite(raw) ? Math.min(50, Math.max(1, Math.floor(raw))) : 10;

  const entries = await getLeaderboard(limit);
  res.json({ success: true, data: entries });
});
