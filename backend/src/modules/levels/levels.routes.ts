import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as controller from './levels.controller';

const router = Router();

// Levels are motivational, not private: a student may see their own progress
// and the public leaderboard, but not other members' loan histories.
router.use(requireAuth);

router.get('/', controller.tiers);
router.get('/me', controller.mine);
router.get('/leaderboard', controller.leaderboard);

export default router;
