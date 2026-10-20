import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './wishlist.controller';
import { addWishlistSchema, wishlistQuerySchema } from './wishlist.schema';

const router = Router();

router.use(requireAuth);

// A wishlist is private to its owner; only the aggregate demand report is
// staff-only.
router.get('/', validateQuery(wishlistQuerySchema), controller.list);
router.get('/check', controller.check);
router.get('/demand', requireAdmin, controller.demand);
router.post('/', writeLimiter, validateBody(addWishlistSchema), controller.create);
router.delete('/:bookId', controller.remove);

export default router;
