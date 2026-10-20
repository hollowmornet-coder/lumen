import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { sqlUpload } from '../../lib/upload';
import { writeLimiter } from '../../middleware/rateLimit';
import * as controller from './backup.controller';

const router = Router();

// A full database dump contains every member's data: admin only.
router.use(requireAuth, requireAdmin);

router.get('/database', controller.download);
router.post('/restore', writeLimiter, sqlUpload.single('file'), controller.restore);

export default router;
