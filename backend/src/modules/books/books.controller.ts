import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { badRequest, notFound } from '../../lib/errors';
import { removeStoredFile, storeCover } from '../../lib/upload';
import { logActivity } from '../activity/activity.service';
import {
  clearBookCover,
  createBook,
  deleteBook,
  getBookById,
  listBooks,
  setBookStatus,
  updateBook,
} from './books.service';
import type { BookQuery, CreateBookInput, UpdateBookInput } from './books.schema';
import type { BookStatus } from './books.types';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listBooks(req.query as unknown as BookQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const book = await getBookById(Number(req.params.id));
  res.json({ success: true, data: book });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  let coverPath: string | null = null;
  if (req.file) {
    const stored = await storeCover(req.file.buffer);
    coverPath = stored.relativePath;
  }

  try {
    const book = await createBook(req.body as CreateBookInput, coverPath);
    await logActivity({
      userId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'book.create',
      entityType: 'book',
      entityId: book.id,
      description: `Menambahkan buku "${book.title}"`,
      ipAddress: req.ip ?? undefined,
    });
    res.status(201).json({ success: true, data: book, message: 'Buku berhasil ditambahkan.' });
  } catch (err) {
    // Never leave an orphaned file behind when the insert fails.
    await removeStoredFile(coverPath);
    throw err;
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const before = await getBookById(id);

  let newCoverPath: string | null = null;
  if (req.file) {
    const stored = await storeCover(req.file.buffer);
    newCoverPath = stored.relativePath;
  }

  try {
    const book = await updateBook(id, req.body as UpdateBookInput, newCoverPath);

    if (newCoverPath) {
      await removeStoredFile(before.coverPath);
    }

    await logActivity({
      userId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'book.update',
      entityType: 'book',
      entityId: id,
      description: `Memperbarui buku "${book.title}"`,
      ipAddress: req.ip ?? undefined,
    });

    res.json({ success: true, data: book, message: 'Buku berhasil diperbarui.' });
  } catch (err) {
    await removeStoredFile(newCoverPath);
    throw err;
  }
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const book = await getBookById(id);
  const result = await deleteBook(id);

  if (result.deleted) {
    await removeStoredFile(book.coverPath);
  }

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.delete',
    entityType: 'book',
    entityId: id,
    description: result.softDeleted
      ? `Menonaktifkan buku "${book.title}" karena memiliki riwayat transaksi`
      : `Menghapus buku "${book.title}"`,
    metadata: { softDeleted: result.softDeleted },
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: result,
    message: result.softDeleted
      ? 'Buku memiliki riwayat transaksi sehingga dinonaktifkan, bukan dihapus permanen.'
      : 'Buku berhasil dihapus.',
  });
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const status = (req.body as { status?: BookStatus }).status;

  if (status !== 'active' && status !== 'inactive') {
    throw badRequest('Status harus berupa active atau inactive.');
  }

  const book = await setBookStatus(id, status);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.status',
    entityType: 'book',
    entityId: id,
    description: `${status === 'active' ? 'Mengaktifkan' : 'Menonaktifkan'} buku "${book.title}"`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: book,
    message: status === 'active' ? 'Buku berhasil diaktifkan.' : 'Buku berhasil dinonaktifkan.',
  });
});

export const removeCover = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const book = await getBookById(id);
  if (!book.coverPath) throw notFound('Buku ini tidak memiliki cover.');

  const updated = await clearBookCover(id);
  await removeStoredFile(book.coverPath);

  res.json({ success: true, data: updated, message: 'Cover berhasil dihapus.' });
});
