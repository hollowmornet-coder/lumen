import { execute, query, queryOne, withTransaction, type RowDataPacket } from '../../config/db';
import { conflict, notFound } from '../../lib/errors';
import { escapeLike, paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { findDuplicateIdentity } from '../auth/auth.service';
import { toBook, type Book, type BookRow } from './books.types';
import type { BookQuery, CreateBookInput, UpdateBookInput } from './books.schema';

const BOOK_COLUMNS = `
  b.id, b.isbn, b.title, b.author, b.publisher, b.publish_year, b.category_id,
  b.description, b.shelf_location, b.total_copies, b.available_copies,
  b.cover_path, b.status, b.created_at, b.updated_at, c.name AS category_name
`;

const BOOK_FROM = `
  FROM books b
  LEFT JOIN categories c ON c.id = b.category_id
`;

/** Build the shared WHERE clause + params used by list and count. */
function buildFilters(q: BookQuery) {
  const where: string[] = [];
  const args: unknown[] = [];

  if (q.search) {
    where.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)');
    const like = `%${escapeLike(q.search)}%`;
    args.push(like, like, like);
  }
  if (q.categoryId) {
    where.push('b.category_id = ?');
    args.push(q.categoryId);
  }
  if (q.availability === 'available') {
    where.push('b.available_copies > 0');
  } else if (q.availability === 'unavailable') {
    where.push('b.available_copies = 0');
  }
  if (q.status !== 'all') {
    where.push('b.status = ?');
    args.push(q.status);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

export async function listBooks(params: BookQuery): Promise<Paginated<Book>> {
  const { whereSql, args } = buildFilters(params);

  const listQuery = parseListQuery(
    { page: params.page, pageSize: params.pageSize, sort: params.sort, direction: params.direction },
    ['title', 'author', 'publish_year', 'available_copies', 'created_at', 'isbn'],
    'title',
  );

  const totalRow = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total ${BOOK_FROM} ${whereSql}`,
    args,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  // `sort` comes from a whitelist in parseListQuery, never raw user input.
  const rows = await query<BookRow>(
    `SELECT ${BOOK_COLUMNS} ${BOOK_FROM} ${whereSql}
      ORDER BY b.${listQuery.sort} ${listQuery.direction}, b.id ASC
      LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toBook), total, listQuery);
}

export async function getBookById(id: number): Promise<Book> {
  const row = await queryOne<BookRow>(
    `SELECT ${BOOK_COLUMNS} ${BOOK_FROM} WHERE b.id = ?`,
    [id],
  );
  if (!row) throw notFound('Buku tidak ditemukan.');
  return toBook(row);
}

export async function createBook(input: CreateBookInput, coverPath: string | null): Promise<Book> {
  const existing = await queryOne<RowDataPacket & { id: number }>(
    'SELECT id FROM books WHERE isbn = ? LIMIT 1',
    [input.isbn],
  );
  if (existing) throw conflict('ISBN sudah terdaftar. Gunakan ISBN lain.');

  const result = await execute(
    `INSERT INTO books
       (isbn, title, author, publisher, publish_year, category_id, description,
        shelf_location, total_copies, available_copies, cover_path, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.isbn,
      input.title,
      input.author,
      input.publisher || null,
      input.publishYear ?? null,
      input.categoryId ?? null,
      input.description || null,
      input.shelfLocation || null,
      input.totalCopies,
      // A brand-new title starts fully available.
      input.totalCopies,
      coverPath,
      input.status ?? 'active',
    ],
  );

  return getBookById(result.insertId);
}

export async function updateBook(
  id: number,
  input: UpdateBookInput,
  coverPath: string | null,
): Promise<Book> {
  const current = await getBookById(id);

  if (input.isbn && input.isbn !== current.isbn) {
    const existing = await queryOne<RowDataPacket & { id: number }>(
      'SELECT id FROM books WHERE isbn = ? AND id <> ? LIMIT 1',
      [input.isbn, id],
    );
    if (existing) throw conflict('ISBN sudah digunakan buku lain.');
  }

  // Changing total_copies must never make the stock inconsistent: copies that
  // are currently on loan cannot be "removed" from the catalogue.
  const newTotal = input.totalCopies ?? current.totalCopies;
  const borrowed = current.borrowedCopies;
  if (newTotal < borrowed) {
    throw conflict(
      `Jumlah eksemplar tidak dapat dikurangi menjadi ${newTotal} karena ada ${borrowed} eksemplar yang sedang dipinjam.`,
    );
  }
  if (newTotal === 0) {
    throw conflict('Jumlah eksemplar minimal 1.');
  }

  const newAvailable = newTotal - borrowed;
  const newCover = coverPath ?? current.coverPath;

  await execute(
    `UPDATE books SET
       isbn = ?, title = ?, author = ?, publisher = ?, publish_year = ?,
       category_id = ?, description = ?, shelf_location = ?,
       total_copies = ?, available_copies = ?, cover_path = ?, status = ?
     WHERE id = ?`,
    [
      input.isbn ?? current.isbn,
      input.title ?? current.title,
      input.author ?? current.author,
      input.publisher === undefined ? current.publisher : input.publisher || null,
      input.publishYear === undefined ? current.publishYear : input.publishYear ?? null,
      input.categoryId === undefined ? current.categoryId : input.categoryId ?? null,
      input.description === undefined ? current.description : input.description || null,
      input.shelfLocation === undefined ? current.shelfLocation : input.shelfLocation || null,
      newTotal,
      newAvailable,
      newCover,
      input.status ?? current.status,
      id,
    ],
  );

  return getBookById(id);
}

/**
 * Hard-deletes a book only when no loan history references it.
 *
 * Books that appear in any transaction are deactivated (soft delete) instead,
 * so historical reports stay intact. See docs/DESKRIPSI_PROGRAM.md.
 */
export async function deleteBook(id: number): Promise<{ deleted: boolean; softDeleted: boolean }> {
  const book = await getBookById(id);

  const usage = await queryOne<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM loans WHERE book_id = ?',
    [id],
  );
  const total = Number(usage?.total ?? 0);

  if (total > 0) {
    await execute("UPDATE books SET status = 'inactive' WHERE id = ?", [id]);
    return { deleted: false, softDeleted: true };
  }

  if (book.borrowedCopies > 0) {
    throw conflict('Buku masih memiliki eksemplar yang dipinjam.');
  }

  await execute('DELETE FROM books WHERE id = ?', [id]);
  return { deleted: true, softDeleted: false };
}

export async function setBookStatus(id: number, status: 'active' | 'inactive'): Promise<Book> {
  const book = await getBookById(id);
  if (status === 'inactive' && book.borrowedCopies > 0) {
    throw conflict(
      'Buku tidak dapat dinonaktifkan karena masih ada eksemplar yang sedang dipinjam.',
    );
  }
  await execute('UPDATE books SET status = ? WHERE id = ?', [status, id]);
  return getBookById(id);
}

/** Removes the stored cover file reference (the file itself is removed by the caller). */
export async function clearBookCover(id: number): Promise<Book> {
  await execute('UPDATE books SET cover_path = NULL WHERE id = ?', [id]);
  return getBookById(id);
}

/**
 * Bulk insert used by the Excel importer.
 *
 * Runs inside a single transaction so a failure part-way through rolls the
 * whole import back rather than leaving the catalogue half-updated.
 */
export async function bulkCreateBooks(
  rows: CreateBookInput[],
): Promise<{ inserted: number }> {
  return withTransaction(async (conn) => {
    let inserted = 0;
    for (const row of rows) {
      await conn.execute(
        `INSERT INTO books
           (isbn, title, author, publisher, publish_year, category_id, description,
            shelf_location, total_copies, available_copies, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.isbn,
          row.title,
          row.author,
          row.publisher || null,
          row.publishYear ?? null,
          row.categoryId ?? null,
          row.description || null,
          row.shelfLocation || null,
          row.totalCopies,
          row.totalCopies,
          row.status ?? 'active',
        ],
      );
      inserted += 1;
    }
    return { inserted };
  });
}

export async function findBooksByIsbnList(isbns: string[]): Promise<Map<string, number>> {
  if (isbns.length === 0) return new Map();
  const placeholders = isbns.map(() => '?').join(', ');
  const rows = await query<RowDataPacket & { isbn: string; id: number }>(
    `SELECT isbn, id FROM books WHERE isbn IN (${placeholders})`,
    isbns,
  );
  return new Map(rows.map((r) => [r.isbn, r.id]));
}

export { findDuplicateIdentity };
