import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './fines.controller';
import { fineQuerySchema, settleFineSchema } from './fines.schema';

const router = Router();

router.use(requireAuth);

// A member only ever sees their own fines; the service scopes by user id.
router.get('/mine', validateQuery(fineQuerySchema), controller.mine);

// The ledger itself is administrative.
router.get('/', requireAdmin, validateQuery(fineQuerySchema), controller.list);
router.post('/:id/settle', requireAdmin, writeLimiter, validateBody(settleFineSchema), controller.settle);

export default router;
