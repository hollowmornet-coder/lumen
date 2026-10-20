import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validateQuery } from '../../middleware/validate';
import * as controller from './scan.controller';
import { resolveScanSchema } from './scan.schema';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/', validateQuery(resolveScanSchema), controller.resolve);

export default router;
