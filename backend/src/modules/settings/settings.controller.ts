import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import { getRawSettings, updateSetting } from './settings.service';
import type { SettingsUpdateInput } from './settings.schema';

function normalise(value: boolean | '0' | '1' | 0 | 1): string {
  return value === true || value === '1' || value === 1 ? '1' : '0';
}

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getRawSettings();
  res.json({ success: true, data });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const parsed = req.body as SettingsUpdateInput;
  const entries = Object.entries(parsed);
  const serialised = entries.map(([key, value]) => [
    key,
    typeof value === 'boolean' || value === 0 || value === 1 ? normalise(value) : String(value),
  ] as const);

  await Promise.all(serialised.map(([key, value]) => updateSetting(key, value)));

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'settings.update',
    entityType: 'settings',
    description: `Memperbarui pengaturan: ${serialised.map(([k]) => k).join(', ')}`,
    metadata: Object.fromEntries(serialised),
    ipAddress: req.ip ?? undefined,
  });

  const data = await getRawSettings();
  res.json({ success: true, data, message: 'Pengaturan berhasil disimpan.' });
});
