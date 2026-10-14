import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as controller from './collections.controller';
import {
  authorQuerySchema,
  seriesCreateSchema,
  seriesItemsSchema,
  seriesUpdateSchema,
} from './collections.schema';

const router = Router();

router.use(requireAuth);

/* ---- Read: available to every signed-in user, like the catalogue ---- */
router.get('/authors', validateQuery(authorQuerySchema), controller.listAuthorsHandler);
router.get('/authors/all', requireAdmin, controller.listAuthorsAll);
router.get('/authors/:slug', controller.authorDetail);
router.get('/series/:id', controller.seriesDetail);

/* ---- Write: librarian only ---- */
router.post('/series', requireAdmin, writeLimiter, validateBody(seriesCreateSchema), controller.createSeriesHandler);
router.patch(
  '/series/:id',
  requireAdmin,
  writeLimiter,
  validateBody(seriesUpdateSchema),
  controller.updateSeriesHandler,
);
router.put(
  '/series/:id/items',
  requireAdmin,
  writeLimiter,
  validateBody(seriesItemsSchema),
  controller.replaceItemsHandler,
);

export default router;
