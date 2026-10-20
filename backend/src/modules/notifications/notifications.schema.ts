import { z } from 'zod';

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(120).optional(),
  unreadOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});

export const notificationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
