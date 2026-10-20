import { z } from 'zod';

/** ISO calendar date, no time part. */
const dateOnly = z
  .string({ required_error: 'Tanggal wajib diisi.' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

export const createHolidaySchema = z.object({
  date: dateOnly,
  name: z
    .string({ required_error: 'Nama hari libur wajib diisi.' })
    .trim()
    .min(3, 'Nama hari libur minimal 3 karakter.')
    .max(120, 'Nama hari libur maksimal 120 karakter.'),
});

export const holidayQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const holidayIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type HolidayQuery = z.infer<typeof holidayQuerySchema>;
