import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './holidays.controller';
import { createHolidaySchema, holidayQuerySchema } from './holidays.schema';

const router = Router();

router.use(requireAuth);

// Members need to know why their due date moved, so reading is open to both
// roles; only staff may change the calendar.
router.get('/', validateQuery(holidayQuerySchema), controller.list);
router.post('/', requireAdmin, writeLimiter, validateBody(createHolidaySchema), controller.create);
router.delete('/:id', requireAdmin, controller.remove);

export default router;
