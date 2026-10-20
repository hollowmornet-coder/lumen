import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './visits.controller';
import { createVisitSchema, visitQuerySchema } from './visits.schema';

const router = Router();

// Visit records reveal who was in the library and when, so the whole module is
// staff-only. Members never need to read them.
router.use(requireAuth, requireAdmin);

router.get('/', validateQuery(visitQuerySchema), controller.list);
router.get('/summary', controller.summary);
router.post('/', writeLimiter, validateBody(createVisitSchema), controller.create);

export default router;
