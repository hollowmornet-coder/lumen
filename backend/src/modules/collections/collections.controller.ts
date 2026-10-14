import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import {
  createSeries,
  getAuthorBySlug,
  getSeriesById,
  getSeriesItems,
  listAllAuthors,
  listAuthors,
  listLooseBooksByAuthor,
  listSeriesByAuthor,
  replaceSeriesItems,
  updateSeries,
} from './collections.service';
import type {
  AuthorQuery,
  SeriesCreateInput,
  SeriesItemsInput,
  SeriesUpdateInput,
} from './collections.schema';

export const listAuthorsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await listAuthors(req.query as unknown as AuthorQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

/**
 * Author detail: the summary, their verified series, and the books they have
 * that belong to no series. Returned in one response so the page does not
 * need three round trips.
 */
export const authorDetail = asyncHandler(async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const author = await getAuthorBySlug(slug);
  const [series, looseBooks] = await Promise.all([
    listSeriesByAuthor(author.id),
    listLooseBooksByAuthor(author.id),
  ]);

  res.json({
    success: true,
    data: {
      author,
      series,
      looseBooks,
      // Books in series, so the librarian can see the real split.
      seriesTitleCount: author.seriesTitleCount,
    },
  });
});

export const seriesDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [series, items] = await Promise.all([getSeriesById(id), getSeriesItems(id)]);
  res.json({ success: true, data: { series, items } });
});

/* ---------------- Admin ---------------- */

export const listAuthorsAll = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listAllAuthors() });
});

export const createSeriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const series = await createSeries(req.body as SeriesCreateInput);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.update',
    entityType: 'series',
    entityId: series.id,
    description: `Menambahkan seri "${series.name}" untuk ${series.authorName}`,
    ipAddress: req.ip ?? undefined,
  });
  res.status(201).json({ success: true, data: series, message: 'Seri berhasil ditambahkan.' });
});

export const updateSeriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const series = await updateSeries(id, req.body as SeriesUpdateInput);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.update',
    entityType: 'series',
    entityId: id,
    description: `Memperbarui seri "${series.name}"`,
    ipAddress: req.ip ?? undefined,
  });
  res.json({ success: true, data: series, message: 'Seri berhasil diperbarui.' });
});

export const replaceItemsHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await replaceSeriesItems(id, req.body as SeriesItemsInput);
  const series = await getSeriesById(id);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.update',
    entityType: 'series',
    entityId: id,
    description: `Mengatur ulang isi seri "${series.name}" (${series.totalItems} judul)`,
    ipAddress: req.ip ?? undefined,
  });
  res.json({ success: true, data: series, message: 'Urutan seri berhasil disimpan.' });
});
