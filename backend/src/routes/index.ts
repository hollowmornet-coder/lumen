import { Router } from 'express';
import activityRoutes from '../modules/activity/activity.routes';
import authRoutes from '../modules/auth/auth.routes';
import booksRoutes from '../modules/books/books.routes';
import categoriesRoutes from '../modules/books/categories.routes';
import collectionsRoutes from '../modules/collections/collections.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import excelRoutes from '../modules/excel/excel.routes';
import loansRoutes from '../modules/loans/loans.routes';
import membersRoutes from '../modules/members/members.routes';
import settingsRoutes from '../modules/settings/settings.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/categories', categoriesRoutes);
router.use('/collections', collectionsRoutes);
router.use('/members', membersRoutes);
router.use('/loans', loansRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/activity', activityRoutes);
router.use('/settings', settingsRoutes);
router.use('/excel', excelRoutes);

export default router;
