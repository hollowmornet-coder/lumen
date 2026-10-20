import { execute, query, queryOne, type RowDataPacket } from '../../config/db';
import { BusinessRuleError, notFound } from '../../lib/errors';
import { paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { getSettings } from '../settings/settings.service';
import type { CreateReviewInput, ReviewQuery } from './reviews.schema';

export interface Review {
  id: number;
  bookId: number;
  bookTitle?: string;
  userId: number;
  memberName: string;
  memberCode: string | null;
  className: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewRow extends RowDataPacket {
  id: number;
  book_id: number;
  book_title?: string;
  user_id: number;
  full_name: string;
  member_code: string | null;
  class_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    userId: row.user_id,
    memberName: row.full_name,
    memberCode: row.member_code,
    className: row.class_name,
    rating: Number(row.rating),
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REVIEW_SELECT = `
  SELECT r.id, r.book_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at,
         u.full_name, u.member_code, u.class_name, b.title AS book_title
    FROM book_reviews r
    JOIN users u ON u.id = r.user_id
    JOIN books b ON b.id = r.book_id
`;

export async function listReviews(params: ReviewQuery): Promise<Paginated<Review>> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (params.bookId) {
    where.push('r.book_id = ?');
    args.push(params.bookId);
  }
  if (params.userId) {
    where.push('r.user_id = ?');
    args.push(params.userId);
  }
  if (params.rating) {
    where.push('r.rating = ?');
    args.push(params.rating);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listQuery = parseListQuery(
    {
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort,
      direction: params.direction,
    },
    ['created_at', 'rating'],
    'created_at',
  );

  const countRows = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM book_reviews r ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await query<ReviewRow>(
    `${REVIEW_SELECT} ${whereSql}
      ORDER BY r.${listQuery.sort} ${listQuery.direction}
      LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toReview), total, listQuery);
}

/** Average + star distribution, computed in SQL so it always matches the list. */
export async function reviewStats(bookId: number): Promise<{
  average: number;
  total: number;
  distribution: Record<string, number>;
}> {
  const rows = await query<RowDataPacket & { rating: number; total: number }>(
    `SELECT rating, COUNT(*) AS total FROM book_reviews WHERE book_id = ? GROUP BY rating`,
    [bookId],
  );

  const distribution: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const row of rows) {
    const star = Number(row.rating);
    const count = Number(row.total);
    distribution[String(star)] = count;
    total += count;
    sum += star * count;
  }

  return {
    average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10,
    total,
    distribution,
  };
}

/**
 * Creates or replaces the caller's review for a book.
 *
 * `UNIQUE (book_id, user_id)` means the second submission edits the first
 * rather than stacking duplicates, so `ON DUPLICATE KEY UPDATE` is the honest
 * implementation: one member, one opinion, editable.
 *
 * The "must have borrowed it" rule is a policy switch (`review_requires_loan`),
 * because a school may want reviews only from readers who finished the book —
 * or may want to let anyone rate the catalogue.
 */
export async function upsertReview(
  userId: number,
  bookId: number,
  input: CreateReviewInput,
): Promise<Review> {
  const settings = await getSettings();

  const book = await queryOne<RowDataPacket & { id: number }>(
    "SELECT id FROM books WHERE id = ? AND status = 'active'",
    [bookId],
  );
  if (!book) throw notFound('Buku tidak ditemukan.');

  if (settings.reviewRequiresLoan) {
    const borrowed = await queryOne<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total FROM loans
        WHERE user_id = ? AND book_id = ?
          AND status IN ('borrowed','return_requested','returned')`,
      [userId, bookId],
    );
    if (Number(borrowed?.total ?? 0) === 0) {
      throw new BusinessRuleError(
        'Ulasan hanya dapat ditulis setelah Anda meminjam buku ini.',
        'REVIEW_REQUIRES_LOAN',
      );
    }
  }

  await execute(
    `INSERT INTO book_reviews (book_id, user_id, rating, comment)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rating = VALUES(rating),
       comment = VALUES(comment)`,
    [bookId, userId, input.rating, input.comment ?? null],
  );

  const row = await queryOne<ReviewRow>(
    `${REVIEW_SELECT} WHERE r.book_id = ? AND r.user_id = ?`,
    [bookId, userId],
  );
  if (!row) throw notFound('Ulasan tidak ditemukan setelah disimpan.');
  return toReview(row);
}

export async function getMyReview(userId: number, bookId: number): Promise<Review | null> {
  const row = await queryOne<ReviewRow>(
    `${REVIEW_SELECT} WHERE r.book_id = ? AND r.user_id = ?`,
    [bookId, userId],
  );
  return row ? toReview(row) : null;
}

/**
 * Deletes a review. Members may only remove their own; admins may remove any
 * (moderation of abusive comments is a real need in a school).
 */
export async function deleteReview(
  id: number,
  actor: { id: number; role: 'admin' | 'user' },
): Promise<void> {
  const row = await queryOne<RowDataPacket & { user_id: number }>(
    'SELECT user_id FROM book_reviews WHERE id = ?',
    [id],
  );
  if (!row) throw notFound('Ulasan tidak ditemukan.');
  if (actor.role !== 'admin' && Number(row.user_id) !== actor.id) {
    throw new BusinessRuleError('Anda hanya dapat menghapus ulasan sendiri.', 'FORBIDDEN');
  }

  await execute('DELETE FROM book_reviews WHERE id = ?', [id]);
}
