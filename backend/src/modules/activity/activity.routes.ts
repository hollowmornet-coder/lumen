import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import * as controller from './activity.controller';

const router = Router();

router.use(requireAuth);

// The audit trail is operational data, not personal data: admin only.
router.get('/', requireAdmin, controller.list);

export default router;
