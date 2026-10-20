import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z
    .string({ required_error: 'Judul wajib diisi.' })
    .trim()
    .min(3, 'Judul minimal 3 karakter.')
    .max(150, 'Judul maksimal 150 karakter.'),
  body: z
    .string({ required_error: 'Isi pengumuman wajib diisi.' })
    .trim()
    .min(3, 'Isi minimal 3 karakter.')
    .max(2000, 'Isi maksimal 2000 karakter.'),
  audience: z.enum(['all', 'user', 'admin']).optional().default('all'),
  pinned: z
    .union([z.boolean(), z.literal('0'), z.literal('1'), z.literal(0), z.literal(1)])
    .optional()
    .transform((v) => v === true || v === '1' || v === 1),
  /** `null`/absent = never expires. ISO datetime, interpreted by MySQL. */
  expiresAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/, 'Format tanggal kedaluwarsa tidak valid.')
    .optional()
    .nullable(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan yang dikirim.' },
);

export const announcementQuerySchema = z.object({
  /** Members only ever see what applies to them, regardless of this flag. */
  audience: z.enum(['all', 'user', 'admin']).optional(),
  activeOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
});

export const announcementIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type AnnouncementQuery = z.infer<typeof announcementQuerySchema>;
