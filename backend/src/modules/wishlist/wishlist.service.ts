import { execute, query, queryOne, type RowDataPacket } from '../../config/db';
import { notFound } from '../../lib/errors';
import { paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import type { WishlistQuery } from './wishlist.schema';

export interface WishlistItem {
  id: number;
  bookId: number;
  title: string;
  author: string;
  coverPath: string | null;
  categoryName: string | null;
  availableCopies: number;
  totalCopies: number;
  createdAt: string;
}

interface WishlistRow extends RowDataPacket {
  id: number;
  book_id: number;
  title: string;
  author: string;
  cover_path: string | null;
  category_name: string | null;
  available_copies: number;
  total_copies: number;
  created_at: string;
}

const WISH_SELECT = `
  SELECT w.id, w.book_id, w.created_at,
         b.title, b.author, b.cover_path, b.available_copies, b.total_copies,
         c.name AS category_name
    FROM wishlists w
    JOIN books b ON b.id = w.book_id
    LEFT JOIN categories c ON c.id = b.category_id
`;

function toItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    author: row.author,
    coverPath: row.cover_path,
    categoryName: row.category_name,
    availableCopies: Number(row.available_copies),
    totalCopies: Number(row.total_copies),
    createdAt: row.created_at,
  };
}

export async function listWishlist(
  userId: number,
  params: WishlistQuery,
): Promise<Paginated<WishlistItem>> {
  const listQuery = parseListQuery(
    { page: params.page, pageSize: params.pageSize, sort: 'created_at', direction: 'DESC' },
    ['created_at'],
    'created_at',
  );

  const countRows = await query<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM wishlists WHERE user_id = ?',
    [userId],
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await query<WishlistRow>(
    `${WISH_SELECT} WHERE w.user_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toItem), total, listQuery);
}

/**
 * Adds a book to the caller's wishlist.
 *
 * The `UNIQUE (user_id, book_id)` index makes this idempotent: pressing the
 * heart twice is not an error and does not create a second row. That matters
 * because the UI toggles on click and a double click is common.
 */
export async function addToWishlist(userId: number, bookId: number): Promise<WishlistItem> {
  const book = await queryOne<RowDataPacket & { id: number }>(
    "SELECT id FROM books WHERE id = ? AND status = 'active'",
    [bookId],
  );
  if (!book) throw notFound('Buku tidak ditemukan.');

  await execute(
    `INSERT INTO wishlists (user_id, book_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId, bookId],
  );

  const row = await queryOne<WishlistRow>(
    `${WISH_SELECT} WHERE w.user_id = ? AND w.book_id = ?`,
    [userId, bookId],
  );
  if (!row) throw notFound('Buku gagal ditambahkan ke daftar keinginan.');
  return toItem(row);
}

export async function removeFromWishlist(userId: number, bookId: number): Promise<void> {
  const result = await execute('DELETE FROM wishlists WHERE user_id = ? AND book_id = ?', [
    userId,
    bookId,
  ]);
  if (result.affectedRows === 0) throw notFound('Buku tidak ada di daftar keinginan Anda.');
}

/** Which of these books the caller has already hearted — for catalogue badges. */
export async function wishlistBookIds(userId: number, bookIds: number[]): Promise<number[]> {
  if (bookIds.length === 0) return [];
  const placeholders = bookIds.map(() => '?').join(',');
  const rows = await query<RowDataPacket & { book_id: number }>(
    `SELECT book_id FROM wishlists WHERE user_id = ? AND book_id IN (${placeholders})`,
    [userId, ...bookIds],
  );
  return rows.map((r) => Number(r.book_id));
}

export interface WishlistDemand {
  bookId: number;
  title: string;
  author: string;
  wishCount: number;
  availableCopies: number;
  totalCopies: number;
}

/**
 * Titles most often wishlisted but under-stocked — the acquisition shortlist.
 * This is why the wishlist is worth storing at all, rather than being a local
 * bookmark in the browser.
 */
export async function wishlistDemand(limit = 10): Promise<WishlistDemand[]> {
  const rows = await query<WishlistRow & { wish_count: number }>(
    `SELECT w.book_id, COUNT(*) AS wish_count,
            b.title, b.author, b.available_copies, b.total_copies
       FROM wishlists w
       JOIN books b ON b.id = w.book_id
      GROUP BY w.book_id, b.title, b.author, b.available_copies, b.total_copies
      ORDER BY wish_count DESC, b.title ASC
      LIMIT ?`,
    [limit],
  );

  return rows.map((r) => ({
    bookId: Number(r.book_id),
    title: r.title,
    author: r.author,
    wishCount: Number(r.wish_count),
    availableCopies: Number(r.available_copies),
    totalCopies: Number(r.total_copies),
  }));
}
