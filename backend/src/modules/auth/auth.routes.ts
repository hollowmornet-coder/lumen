import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { avatarUpload } from '../../lib/upload';
import { authLimiter, uploadLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../middleware/validate';
import * as controller from './auth.controller';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestResetSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schema';

const router = Router();

router.post('/login', authLimiter, validateBody(loginSchema), controller.login);
router.post('/register', authLimiter, validateBody(registerSchema), controller.register);
router.post('/logout', controller.logout);

// Self-service password reset. Both steps are rate limited: the first stops
// token farming, the second stops token guessing.
router.post('/forgot-password', authLimiter, validateBody(requestResetSchema), controller.requestReset);
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), controller.resetPassword);

router.get('/me', requireAuth, controller.me);
router.patch('/profile', requireAuth, validateBody(updateProfileSchema), controller.updateMyProfile);

// Profile photo. Uploads get their own rate-limit bucket because they move
// megabytes, and the file itself is validated by magic bytes in `storeAvatar`.
router.post('/avatar', requireAuth, uploadLimiter, avatarUpload.single('avatar'), controller.uploadAvatar);
router.delete('/avatar', requireAuth, uploadLimiter, controller.removeAvatar);

router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validateBody(changePasswordSchema),
  controller.changeMyPassword,
);

export default router;
