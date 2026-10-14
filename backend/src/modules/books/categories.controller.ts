import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import type { CategoryInput } from '../books/books.schema';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../books/categories.service';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await listCategories();
  res.json({ success: true, data: categories });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const category = await createCategory(req.body as CategoryInput);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.update',
    entityType: 'category',
    entityId: category.id,
    description: `Menambahkan kategori "${category.name}"`,
    ipAddress: req.ip ?? undefined,
  });
  res.status(201).json({ success: true, data: category, message: 'Kategori berhasil ditambahkan.' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const category = await updateCategory(Number(req.params.id), req.body as Partial<CategoryInput>);
  res.json({ success: true, data: category, message: 'Kategori berhasil diperbarui.' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deleteCategory(id);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.delete',
    entityType: 'category',
    entityId: id,
    description: `Menghapus kategori #${id}`,
    ipAddress: req.ip ?? undefined,
  });
  res.json({ success: true, message: 'Kategori berhasil dihapus.' });
});
