import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { notFound } from '../../lib/errors';
import { resolveScan } from './scan.service';
import type { ResolveScanQuery } from './scan.schema';

/**
 * Resolves one scanned code. Admin-only: a member scanning a stranger's card
 * would learn that person's name and class.
 */
export const resolve = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.query as unknown as ResolveScanQuery;
  const target = await resolveScan(code);

  if (!target) {
    throw notFound('Kode tidak dikenali sebagai kartu anggota, ISBN buku, atau nota transaksi.');
  }

  res.json({ success: true, data: target });
});
