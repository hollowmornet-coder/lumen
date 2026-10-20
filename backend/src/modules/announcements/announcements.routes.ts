import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './announcements.controller';
import {
  announcementQuerySchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from './announcements.schema';

const router = Router();

router.use(requireAuth);

// Both roles read; only staff publish. The service filters what a member may
// see, so `GET /` is safe for everyone.
router.get('/', validateQuery(announcementQuerySchema), controller.list);
router.get('/:id', controller.detail);
router.post('/', requireAdmin, writeLimiter, validateBody(createAnnouncementSchema), controller.create);
router.patch('/:id', requireAdmin, writeLimiter, validateBody(updateAnnouncementSchema), controller.update);
router.delete('/:id', requireAdmin, controller.remove);

export default router;
