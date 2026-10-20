import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './reservations.controller';
import { createReservationSchema, reservationQuerySchema } from './reservations.schema';

const router = Router();

router.use(requireAuth);

router.get('/mine', controller.mine);
router.post('/', writeLimiter, validateBody(createReservationSchema), controller.create);
router.post('/:id/cancel', controller.cancel);

// Queue inspection is administrative: it exposes who is waiting for what.
router.get('/', requireAdmin, validateQuery(reservationQuerySchema), controller.list);
router.get('/queue/overview', requireAdmin, controller.queue);

export default router;
