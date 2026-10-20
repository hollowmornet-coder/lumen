import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { getSettings } from '../settings/settings.service';
import {
  getAdminOverview,
  getCategoryDistribution,
  getFineReport,
  getLateMembers,
  getMemberOverview,
  getNeverBorrowedBooks,
  getStatusDistribution,
  getTopBorrowedBooks,
  getTopMembers,
  getTransactionTrend,
  type TrendBucket,
} from './dashboard.service';

/**
 * Formats a date as `YYYY-MM-DD` in **local** time.
 *
 * `toISOString().slice(0, 10)` was wrong here: it yields the UTC date, so
 * between midnight and 07:00 in Indonesia (UTC+7) the dashboard's default range
 * ended "yesterday" and the day's own activity was excluded from the chart.
 */
const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Defaults to the last 30 days so a first-time dashboard is never empty of context. */
function resolveRange(req: Request): { from: string; to: string } {
  const now = new Date();
  const thirty = new Date(now.getTime() - 29 * 86_400_000);
  const from = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
    ? req.query.from
    : isoDate(thirty);
  const to = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
    ? req.query.to
    : isoDate(now);
  return { from, to };
}

export const adminOverview = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminOverview();
  res.json({ success: true, data });
});

export const adminCharts = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = resolveRange(req);
  const bucket: TrendBucket =
    req.query.bucket === 'week' || req.query.bucket === 'month' ? req.query.bucket : 'day';

  const [trend, categories, statuses, topBooks, topMembers] = await Promise.all([
    getTransactionTrend(from, to, bucket),
    getCategoryDistribution(),
    getStatusDistribution(from, to),
    getTopBorrowedBooks(8, from, to),
    getTopMembers(8),
  ]);

  res.json({
    success: true,
    data: { range: { from, to, bucket }, trend, categories, statuses, topBooks, topMembers },
  });
});

export const memberOverview = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings();
  const data = await getMemberOverview(req.user!.id, settings.maxLoanPerUser);
  res.json({
    success: true,
    data: {
      ...data,
      allowSelfReturn: settings.allowSelfReturn,
      requireApproval: settings.requireApproval,
      maxRenewals: settings.maxRenewals,
    },
  });
});

/** Dead stock and repeat latecomers - both are actionable, not decorative. */
export const reports = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = resolveRange(req);

  const [neverBorrowed, lateMembers, fines] = await Promise.all([
    getNeverBorrowedBooks(30),
    getLateMembers(30),
    getFineReport(from, to),
  ]);

  res.json({
    success: true,
    data: { range: { from, to }, neverBorrowed, lateMembers, fines },
  });
});
