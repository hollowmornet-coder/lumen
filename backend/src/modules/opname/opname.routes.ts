import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './opname.controller';
import { createOpnameSchema, opnameQuerySchema } from './opname.schema';

const router = Router();

// Stock audits change real inventory numbers, so this is staff-only.
router.use(requireAuth, requireAdmin);

router.get('/', validateQuery(opnameQuerySchema), controller.list);
router.post('/', writeLimiter, validateBody(createOpnameSchema), controller.create);
router.post('/:id/apply', writeLimiter, controller.apply);

export default router;
