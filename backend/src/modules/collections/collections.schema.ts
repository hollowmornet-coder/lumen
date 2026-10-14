import { z } from 'zod';

export const authorQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['name', 'title_count', 'series_count', 'created_at']).optional().default('title_count'),
  direction: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(24),
});

export const seriesUpdateSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  verification: z.enum(['verified', 'unverified']).optional(),
  sourceUrl: z.string().trim().url('URL sumber tidak valid.').max(500).optional().nullable(),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD.').optional().nullable(),
});

export const seriesCreateSchema = z.object({
  authorId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  verification: z.enum(['verified', 'unverified']).optional().default('verified'),
  sourceUrl: z.string().trim().url('URL sumber tidak valid.').max(500).optional().nullable(),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD.').optional().nullable(),
});

/** Reordering the bibliography. Positions must be a contiguous 1..n list. */
export const seriesItemsSchema = z.object({
  items: z
    .array(
      z.object({
        bookId: z.coerce.number().int().positive().nullable(),
        position: z.coerce.number().int().min(1).max(999),
        note: z.string().trim().max(255).optional().nullable(),
      }),
    )
    .min(1, 'Seri harus memiliki minimal satu judul.')
    .max(300, 'Terlalu banyak judul dalam satu seri.'),
});

export type AuthorQuery = z.infer<typeof authorQuerySchema>;
export type SeriesUpdateInput = z.infer<typeof seriesUpdateSchema>;
export type SeriesCreateInput = z.infer<typeof seriesCreateSchema>;
export type SeriesItemsInput = z.infer<typeof seriesItemsSchema>;
