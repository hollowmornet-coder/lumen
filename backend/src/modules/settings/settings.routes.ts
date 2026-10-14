import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../middleware/validate';
import * as controller from './settings.controller';
import { settingsUpdateSchema } from './settings.schema';

const router = Router();

router.use(requireAuth);

// Members need to read the rules (e.g. to explain the loan quota in the UI).
router.get('/', controller.getAll);

// Only an admin may change the rules.
router.put('/', requireAdmin, writeLimiter, validateBody(settingsUpdateSchema), controller.update);

export default router;
