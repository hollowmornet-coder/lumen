import { z } from 'zod';

const boolish = z.union([z.boolean(), z.literal('0'), z.literal('1'), z.literal(0), z.literal(1)]);

/** The exact set of rules an admin may change, with sane bounds. */
export const settingsUpdateSchema = z
  .object({
    max_loan_per_user: z.coerce.number().int().min(1, 'Minimal 1 buku.').max(20, 'Maksimal 20 buku.'),
    loan_duration_days: z.coerce.number().int().min(1, 'Minimal 1 hari.').max(90, 'Maksimal 90 hari.'),
    require_approval: boolish,
    allow_self_return: boolish,
    late_fee_per_day: z.coerce.number().int().min(0).max(100_000),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada pengaturan yang dikirim.',
  });

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
