import { z } from 'zod';

/**
 * A scanned code is whatever a keyboard-wedge scanner types followed by Enter.
 *
 * Length is capped because a scanner malfunction (or a paste of a whole
 * document) must not reach the database as a multi-kilobyte pattern.
 */
export const resolveScanSchema = z.object({
  code: z
    .string({ required_error: 'Kode hasil pindai wajib diisi.' })
    .trim()
    .min(2, 'Kode terlalu pendek.')
    .max(64, 'Kode terlalu panjang.'),
});

export type ResolveScanQuery = z.infer<typeof resolveScanSchema>;
