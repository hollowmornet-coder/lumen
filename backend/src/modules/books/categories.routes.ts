import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../middleware/validate';
import * as controller from './categories.controller';
import { categorySchema, updateCategorySchema } from './books.schema';

const router = Router();

router.use(requireAuth);

// Both roles need the category list to render catalogue filters.
router.get('/', controller.list);

router.post('/', requireAdmin, writeLimiter, validateBody(categorySchema), controller.create);
router.patch('/:id', requireAdmin, writeLimiter, validateBody(updateCategorySchema), controller.update);
router.delete('/:id', requireAdmin, controller.remove);

export default router;
