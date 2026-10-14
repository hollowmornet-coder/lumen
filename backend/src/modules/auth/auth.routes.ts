import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../middleware/validate';
import * as controller from './auth.controller';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.schema';

const router = Router();

router.post('/login', authLimiter, validateBody(loginSchema), controller.login);
router.post('/register', authLimiter, validateBody(registerSchema), controller.register);
router.post('/logout', controller.logout);

router.get('/me', requireAuth, controller.me);
router.patch('/profile', requireAuth, validateBody(updateProfileSchema), controller.updateMyProfile);
router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validateBody(changePasswordSchema),
  controller.changeMyPassword,
);

export default router;
