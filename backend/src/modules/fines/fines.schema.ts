import { z } from 'zod';

export const fineQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'unpaid', 'paid', 'waived']).optional().default('all'),
  kind: z.enum(['all', 'late', 'damaged', 'lost']).optional().default('all'),
  userId: z.coerce.number().int().positive().optional(),
  /**
   * Inclusive period filter on `created_at`. The monthly cash question —
   * "how much came in this month?" — was impossible to answer before this.
   */
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal awal harus YYYY-MM-DD.')
    .optional(),
  to: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal akhir harus YYYY-MM-DD.')
    .optional(),
});

export const settleFineSchema = z.object({
  action: z.enum(['pay', 'waive'], {
    required_error: 'Tindakan wajib dipilih.',
    invalid_type_error: 'Tindakan harus "pay" atau "waive".',
  }),
  note: z.string().trim().max(255).optional(),
});

export type FineQuery = z.infer<typeof fineQuerySchema>;
export type SettleFineInput = z.infer<typeof settleFineSchema>;
