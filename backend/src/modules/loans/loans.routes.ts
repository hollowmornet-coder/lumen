import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './loans.controller';
import {
  bulkApproveSchema,
  confirmReturnSchema,
  counterLoanSchema,
  loanQuerySchema,
  rejectLoanSchema,
  renewLoanSchema,
  requestLoanSchema,
} from './loans.schema';

const router = Router();

router.use(requireAuth);

// --- Member endpoints (ownership enforced inside the service layer) ---
router.get('/mine', validateQuery(loanQuerySchema), controller.listMine);
router.post('/', writeLimiter, validateBody(requestLoanSchema), controller.create);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/return-request', controller.requestReturn);
router.post('/:id/renew', writeLimiter, validateBody(renewLoanSchema), controller.renew);

// --- Shared read endpoints; scoped automatically by role ---
router.get('/', validateQuery(loanQuerySchema), controller.list);
router.get('/:id', controller.detail);

// --- Librarian-only workflow steps ---
router.post('/counter', requireAdmin, writeLimiter, validateBody(counterLoanSchema), controller.counter);
router.post(
  '/bulk-approve',
  requireAdmin,
  writeLimiter,
  validateBody(bulkApproveSchema),
  controller.bulkApprove,
);
router.post('/:id/approve', requireAdmin, writeLimiter, controller.approve);
router.post('/:id/borrow', requireAdmin, controller.borrow);
router.post('/:id/reject', requireAdmin, writeLimiter, validateBody(rejectLoanSchema), controller.reject);
router.post('/:id/release', requireAdmin, writeLimiter, controller.release);
router.post(
  '/:id/return-confirm',
  requireAdmin,
  writeLimiter,
  validateBody(confirmReturnSchema),
  controller.confirmReturn,
);
router.patch('/:id/note', requireAdmin, controller.updateNote);

export default router;
