import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './members.controller';
import {
  createMemberSchema,
  memberQuerySchema,
  memberStatusSchema,
  resetPasswordSchema,
  updateMemberSchema,
} from './members.schema';

const router = Router();

// Member records are private: students may only ever see their own loan
// history, so every endpoint here is admin-only.
router.use(requireAuth, requireAdmin);

router.get('/', validateQuery(memberQuerySchema), controller.list);
router.get('/:id', controller.detail);

router.post('/', writeLimiter, validateBody(createMemberSchema), controller.create);
router.patch('/:id', writeLimiter, validateBody(updateMemberSchema), controller.update);
router.patch('/:id/status', validateBody(memberStatusSchema), controller.setStatus);
router.post('/:id/reset-password', writeLimiter, validateBody(resetPasswordSchema), controller.resetPassword);
router.delete('/:id', controller.remove);

export default router;
