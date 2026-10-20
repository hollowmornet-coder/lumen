import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { excelUpload } from '../../lib/upload';
import { writeLimiter } from '../../middleware/rateLimit';
import * as controller from './excel.controller';

const router = Router();

// Import/export is an administrative data-exchange tool.
router.use(requireAuth, requireAdmin);

router.get('/template', controller.downloadTemplate);
router.get('/template/members', controller.downloadMemberTemplate);

router.get('/export/books', controller.exportBooks);
router.get('/export/members', controller.exportMembers);
router.get('/export/loans', controller.exportLoans);
router.get('/export/fines', controller.exportFines);

router.post('/import/books', writeLimiter, excelUpload.single('file'), controller.importBooks);
router.post('/import/members', writeLimiter, excelUpload.single('file'), controller.importMembers);

export default router;
