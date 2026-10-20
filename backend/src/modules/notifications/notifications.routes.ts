import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateQuery } from '../../middleware/validate';
import * as controller from './notifications.controller';
import { notificationQuerySchema } from './notifications.schema';

const router = Router();

router.use(requireAuth);

router.get('/', validateQuery(notificationQuerySchema), controller.list);
router.get('/unread-count', controller.unread);
router.post('/read-all', controller.readAll);
router.post('/:id/read', controller.read);
router.delete('/:id', controller.remove);

export default router;
