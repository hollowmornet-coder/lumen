import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import * as controller from './dashboard.controller';

const router = Router();

router.use(requireAuth);

router.get('/admin/overview', requireAdmin, controller.adminOverview);
router.get('/admin/charts', requireAdmin, controller.adminCharts);
router.get('/admin/reports', requireAdmin, controller.reports);
router.get('/member/overview', controller.memberOverview);

export default router;
