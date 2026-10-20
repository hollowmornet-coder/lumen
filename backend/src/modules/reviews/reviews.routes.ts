import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './reviews.controller';
import { createReviewSchema, reviewQuerySchema } from './reviews.schema';

const router = Router();

router.use(requireAuth);

// Reading reviews is public to any signed-in user (catalogue page); writing is
// rate-limited because it is a user-generated-content endpoint.
router.get('/', validateQuery(reviewQuerySchema), controller.list);
router.get('/book/:bookId/stats', controller.stats);
router.get('/book/:bookId/mine', controller.mine);
router.post('/book/:bookId', writeLimiter, validateBody(createReviewSchema), controller.create);
router.delete('/:id', controller.remove);

export default router;
