import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { badRequest } from '../../lib/errors';
import { logActivity } from '../activity/activity.service';
import { backupFileName, dumpDatabase } from './backup.service';
import { restoreDatabase } from './backup.restore';

export const download = asyncHandler(async (req: Request, res: Response) => {
  const sql = await dumpDatabase();
  const name = backupFileName();

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'data.backup',
    entityType: 'database',
    description: `Mengunduh cadangan database (${name})`,
    metadata: { bytes: Buffer.byteLength(sql) },
    ipAddress: req.ip ?? undefined,
  });

  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(sql);
});

/**
 * Restores the database from an uploaded dump.
 *
 * Two independent guards, because this is the most destructive endpoint in the
 * system:
 *
 *  1. A typed confirmation phrase, so a mis-click cannot trigger it.
 *  2. `inspectDump`, which refuses anything that is not recognisably a LUMEN
 *     backup before a single table is touched.
 *
 * The activity log entry is written BEFORE the restore runs. Afterwards the
 * `activity_logs` table has just been replaced by the dump's contents, so a
 * post-restore write would be lost — and "who restored what, when" is exactly
 * the record you need after an incident.
 */
export const restore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw badRequest('Tidak ada berkas cadangan yang diunggah.');

  const confirmation = String((req.body as { confirmation?: string }).confirmation ?? '').trim();
  if (confirmation !== 'PULIHKAN') {
    throw badRequest('Ketik PULIHKAN pada kolom konfirmasi untuk melanjutkan.');
  }

  const originalName = req.file.originalname;

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'data.restore',
    entityType: 'database',
    description: `Memulihkan database dari berkas "${originalName}"`,
    metadata: { bytes: req.file.size },
    ipAddress: req.ip ?? undefined,
  });

  const report = await restoreDatabase(req.file.buffer);

  res.json({
    success: true,
    data: {
      bytes: report.bytes,
      tables: report.tables,
      durationMs: report.durationMs,
    },
    message:
      'Database berhasil dipulihkan. Semua pengguna perlu masuk ulang karena sesi lama merujuk data yang sudah diganti.',
  });
});
