import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { coverUpload } from '../../lib/upload';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './books.controller';
import { bookQuerySchema, bookStatusSchema, createBookSchema, updateBookSchema } from './books.schema';

const router = Router();

// Every book route requires a session.
router.use(requireAuth);

/**
 * GET /api/books - catalogue listing.
 * Available to both roles; the controller never returns admin-only fields.
 */
router.get('/', validateQuery(bookQuerySchema), controller.list);
router.get('/:id', controller.detail);

// Everything below manages the catalogue itself -> admin only.
router.post('/', requireAdmin, writeLimiter, coverUpload.single('cover'), validateBody(createBookSchema), controller.create);
router.patch(
  '/:id',
  requireAdmin,
  writeLimiter,
  coverUpload.single('cover'),
  validateBody(updateBookSchema),
  controller.update,
);
router.patch('/:id/status', requireAdmin, validateBody(bookStatusSchema), controller.setStatus);
router.delete('/:id/cover', requireAdmin, controller.removeCover);
router.delete('/:id', requireAdmin, controller.remove);

export default router;
