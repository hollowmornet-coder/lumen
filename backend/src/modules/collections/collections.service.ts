import {
  execute,
  query,
  queryOne,
  withTransaction,
  type RowDataPacket,
} from '../../config/db';
import { conflict, notFound } from '../../lib/errors';
import { escapeLike, paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import type {
  AuthorQuery,
  SeriesCreateInput,
  SeriesItemsInput,
  SeriesUpdateInput,
} from './collections.schema';

/* =====================================================================
   Authors
   ===================================================================== */

export interface AuthorSummary {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  nationality: string | null;
  /** Number of distinct titles held. NOT the number of physical copies. */
  titleCount: number;
  /** Number of physical copies across those titles. */
  copyCount: number;
  /** How many copies are on the shelf right now. */
  availableCopies: number;
  seriesCount: number;
  /** Distinct books that belong to a series (excludes loose books). */
  seriesTitleCount: number;
}

interface AuthorRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  nationality: string | null;
  title_count: number;
  copy_count: number;
  available_copies: number;
  series_count: number;
  series_title_count: number;
}

function toAuthor(row: AuthorRow): AuthorSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio,
    nationality: row.nationality,
    titleCount: Number(row.title_count ?? 0),
    copyCount: Number(row.copy_count ?? 0),
    availableCopies: Number(row.available_copies ?? 0),
    seriesCount: Number(row.series_count ?? 0),
    seriesTitleCount: Number(row.series_title_count ?? 0),
  };
}

/**
 * Authors worth surfacing: they either have books in the catalogue, or they
 * have at least one verified series. An author with neither is metadata
 * noise and is filtered out rather than shown as an empty folder.
 */
export async function listAuthors(params: AuthorQuery): Promise<Paginated<AuthorSummary>> {
  const listQuery = parseListQuery(
    {
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort,
      direction: params.direction,
    },
    ['name', 'title_count', 'series_count', 'created_at'],
    'title_count',
  );

  const where: string[] = [];
  const args: unknown[] = [];

  if (params.search) {
    where.push('a.name LIKE ?');
    args.push(`%${escapeLike(params.search)}%`);
  }

  const base = `
    FROM authors a
    LEFT JOIN books b ON b.author_id = a.id
    LEFT JOIN book_series s ON s.author_id = a.id
    LEFT JOIN book_series_items si ON si.series_id = s.id AND si.book_id IS NOT NULL
  `;
  const having = `HAVING title_count > 0 OR series_count > 0`;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM (
      SELECT a.id,
             COUNT(DISTINCT b.id) AS title_count,
             COALESCE(SUM(b.total_copies), 0) AS copy_count,
             COALESCE(SUM(b.available_copies), 0) AS available_copies,
             COUNT(DISTINCT s.id) AS series_count,
             COUNT(DISTINCT si.book_id) AS series_title_count
        ${base}
       ${whereSql}
       GROUP BY a.id
       ${having}
    ) AS t`,
    args,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  const orderExpr: Record<string, string> = {
    name: 'name',
    title_count: 'title_count',
    series_count: 'series_count',
    created_at: 'name',
  };
  const orderBy = orderExpr[listQuery.sort] ?? 'title_count';

  const rows = await query<AuthorRow>(
    `SELECT a.id, a.name, a.slug, a.bio, a.nationality,
            COUNT(DISTINCT b.id) AS title_count,
            COALESCE(SUM(b.total_copies), 0) AS copy_count,
            COALESCE(SUM(b.available_copies), 0) AS available_copies,
            COUNT(DISTINCT s.id) AS series_count,
            COUNT(DISTINCT si.book_id) AS series_title_count
       ${base}
      ${whereSql}
      GROUP BY a.id, a.name, a.slug, a.bio, a.nationality
      ${having}
      ORDER BY ${orderBy} ${listQuery.direction}, a.name ASC
      LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toAuthor), total, listQuery);
}

export async function getAuthorBySlug(slug: string) {
  const row = await queryOne<AuthorRow>(
    `SELECT a.id, a.name, a.slug, a.bio, a.nationality,
            COUNT(DISTINCT b.id) AS title_count,
            COALESCE(SUM(b.total_copies), 0) AS copy_count,
            COALESCE(SUM(b.available_copies), 0) AS available_copies,
            COUNT(DISTINCT s.id) AS series_count,
            COUNT(DISTINCT si.book_id) AS series_title_count
       FROM authors a
       LEFT JOIN books b ON b.author_id = a.id
       LEFT JOIN book_series s ON s.author_id = a.id
       LEFT JOIN book_series_items si ON si.series_id = s.id AND si.book_id IS NOT NULL
      WHERE a.slug = ?
      GROUP BY a.id, a.name, a.slug, a.bio, a.nationality`,
    [slug],
  );
  if (!row) throw notFound('Penulis tidak ditemukan.');
  return toAuthor(row);
}

/* =====================================================================
   Series
   ===================================================================== */

export interface SeriesSummary {
  id: number;
  authorId: number;
  authorName: string;
  authorSlug: string;
  name: string;
  slug: string;
  description: string | null;
  verification: 'verified' | 'unverified';
  sourceUrl: string | null;
  verifiedAt: string | null;
  /** Titles the series has in total, whether or not we own them. */
  totalItems: number;
  /** Of those, how many are actually on our shelves. */
  ownedItems: number;
  availableCopies: number;
}

interface SeriesRow extends RowDataPacket {
  id: number;
  author_id: number;
  author_name: string;
  author_slug: string;
  name: string;
  slug: string;
  description: string | null;
  verification: 'verified' | 'unverified';
  source_url: string | null;
  verified_at: string | null;
  total_items: number;
  owned_items: number;
  available_copies: number;
}

const SERIES_SELECT = `
  SELECT s.id, s.author_id, a.name AS author_name, a.slug AS author_slug,
         s.name, s.slug, s.description, s.verification, s.source_url, s.verified_at,
         COUNT(i.id) AS total_items,
         COUNT(i.book_id) AS owned_items,
         COALESCE(SUM(b.available_copies), 0) AS available_copies
    FROM book_series s
    JOIN authors a ON a.id = s.author_id
    LEFT JOIN book_series_items i ON i.series_id = s.id
    LEFT JOIN books b ON b.id = i.book_id
`;

function toSeries(row: SeriesRow): SeriesSummary {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorSlug: row.author_slug,
    name: row.name,
    slug: row.slug,
    description: row.description,
    verification: row.verification,
    sourceUrl: row.source_url,
    verifiedAt: row.verified_at,
    totalItems: Number(row.total_items ?? 0),
    ownedItems: Number(row.owned_items ?? 0),
    availableCopies: Number(row.available_copies ?? 0),
  };
}

export async function listSeriesByAuthor(authorId: number): Promise<SeriesSummary[]> {
  const rows = await query<SeriesRow>(
    `${SERIES_SELECT} WHERE s.author_id = ? GROUP BY s.id ORDER BY s.name ASC`,
    [authorId],
  );
  return rows.map(toSeries);
}

export async function getSeriesById(id: number): Promise<SeriesSummary> {
  const row = await queryOne<SeriesRow>(
    `${SERIES_SELECT} WHERE s.id = ? GROUP BY s.id`,
    [id],
  );
  if (!row) throw notFound('Seri tidak ditemukan.');
  return toSeries(row);
}

export interface SeriesBookItem {
  position: number;
  note: string | null;
  /** null = in the bibliography, but not in our catalogue. */
  inLibrary: boolean;
  book: {
    id: number;
    title: string;
    author: string;
    isbn: string;
    coverPath: string | null;
    categoryName: string | null;
    publishYear: number | null;
    shelfLocation: string | null;
    availableCopies: number;
    totalCopies: number;
  } | null;
}

interface ItemRow extends RowDataPacket {
  position: number;
  note: string | null;
  book_id: number | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  cover_path: string | null;
  category_name: string | null;
  publish_year: number | null;
  shelf_location: string | null;
  available_copies: number | null;
  total_copies: number | null;
}

/**
 * The ordered bibliography of a series.
 *
 * Items with `book_id IS NULL` are titles we have verified bibliographically
 * but do not own. They come back with `inLibrary: false` and a null `book`,
 * so the UI can show them as "belum ada di koleksi" and must not offer a
 * borrow action for them.
 */
export async function getSeriesItems(seriesId: number): Promise<SeriesBookItem[]> {
  const rows = await query<ItemRow>(
    `SELECT i.position, i.note, i.book_id,
            b.title, b.author, b.isbn, b.cover_path, b.publish_year, b.shelf_location,
            b.available_copies, b.total_copies, c.name AS category_name
       FROM book_series_items i
       LEFT JOIN books b ON b.id = i.book_id
       LEFT JOIN categories c ON c.id = b.category_id
      WHERE i.series_id = ?
      ORDER BY i.position ASC`,
    [seriesId],
  );

  return rows.map((r) => ({
    position: Number(r.position),
    note: r.note,
    inLibrary: r.book_id !== null,
    book:
      r.book_id === null
        ? null
        : {
            id: r.book_id,
            title: r.title ?? '',
            author: r.author ?? '',
            isbn: r.isbn ?? '',
            coverPath: r.cover_path,
            categoryName: r.category_name,
            publishYear: r.publish_year,
            shelfLocation: r.shelf_location,
            availableCopies: Number(r.available_copies ?? 0),
            totalCopies: Number(r.total_copies ?? 0),
          },
  }));
}

export interface LooseBook {
  id: number;
  title: string;
  author: string;
  isbn: string;
  coverPath: string | null;
  categoryName: string | null;
  publishYear: number | null;
  shelfLocation: string | null;
  availableCopies: number;
  totalCopies: number;
}

/**
 * Books by this author that belong to no series - the "Karya Lepas" shelf.
 * Excludes titles already linked to a series item.
 */
export async function listLooseBooksByAuthor(authorId: number): Promise<LooseBook[]> {
  const rows = await query<ItemRow & { id: number }>(
    `SELECT b.id, b.title, b.author, b.isbn, b.cover_path, b.publish_year,
            b.shelf_location, b.available_copies, b.total_copies, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON c.id = b.category_id
      WHERE b.author_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM book_series_items i
           WHERE i.book_id = b.id AND i.series_id IN (SELECT id FROM book_series WHERE author_id = ?)
        )
      ORDER BY b.publish_year ASC, b.title ASC`,
    [authorId, authorId],
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? '',
    author: r.author ?? '',
    isbn: r.isbn ?? '',
    coverPath: r.cover_path,
    categoryName: r.category_name,
    publishYear: r.publish_year,
    shelfLocation: r.shelf_location,
    availableCopies: Number(r.available_copies ?? 0),
    totalCopies: Number(r.total_copies ?? 0),
  }));
}

/* =====================================================================
   Admin mutations
   ===================================================================== */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

export async function createSeries(input: SeriesCreateInput): Promise<SeriesSummary> {
  const slug = slugify(input.name);
  const clash = await queryOne<RowDataPacket & { id: number }>(
    'SELECT id FROM book_series WHERE author_id = ? AND slug = ? LIMIT 1',
    [input.authorId, slug],
  );
  if (clash) throw conflict('Seri dengan nama tersebut sudah ada untuk penulis ini.');

  const result = await execute(
    `INSERT INTO book_series
       (author_id, name, slug, description, verification, source_url, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.authorId,
      input.name,
      slug,
      input.description || null,
      input.verification ?? 'verified',
      input.sourceUrl || null,
      input.verifiedAt || null,
    ],
  );
  return getSeriesById(result.insertId);
}

export async function updateSeries(id: number, input: SeriesUpdateInput): Promise<SeriesSummary> {
  await getSeriesById(id);

  const sets: string[] = [];
  const args: unknown[] = [];

  if (input.name !== undefined) {
    sets.push('name = ?', 'slug = ?');
    args.push(input.name, slugify(input.name));
  }
  if (input.description !== undefined) {
    sets.push('description = ?');
    args.push(input.description || null);
  }
  if (input.verification !== undefined) {
    sets.push('verification = ?');
    args.push(input.verification);
  }
  if (input.sourceUrl !== undefined) {
    sets.push('source_url = ?');
    args.push(input.sourceUrl || null);
  }
  if (input.verifiedAt !== undefined) {
    sets.push('verified_at = ?');
    args.push(input.verifiedAt || null);
  }

  if (sets.length > 0) {
    args.push(id);
    await execute(`UPDATE book_series SET ${sets.join(', ')} WHERE id = ?`, args);
  }
  return getSeriesById(id);
}

/**
 * Replaces the bibliography of a series.
 *
 * Validated before writing, and written in a single transaction so a bad
 * payload can never leave a series half-ordered. Rejects a book that belongs
 * to a different author, and the same book listed twice.
 */
export async function replaceSeriesItems(seriesId: number, input: SeriesItemsInput) {
  const series = await getSeriesById(seriesId);

  const positions = new Set<number>();
  const bookIds = new Set<number>();

  for (const item of input.items) {
    if (positions.has(item.position)) {
      throw conflict(`Posisi ${item.position} dipakai lebih dari sekali.`);
    }
    positions.add(item.position);

    if (item.bookId === null) continue;
    if (bookIds.has(item.bookId)) {
      throw conflict('Buku yang sama tidak boleh masuk dua kali ke dalam satu seri.');
    }
    bookIds.add(item.bookId);
  }

  if (bookIds.size > 0) {
    const placeholders = [...bookIds].map(() => '?').join(',');
    const rows = await query<RowDataPacket & { id: number; author_id: number; title: string }>(
      `SELECT id, author_id, title FROM books WHERE id IN (${placeholders})`,
      [...bookIds],
    );

    if (rows.length !== bookIds.size) {
      const found = new Set(rows.map((r) => r.id));
      const missing = [...bookIds].filter((id) => !found.has(id));
      throw conflict(`Buku dengan id ${missing.join(', ')} tidak ditemukan.`);
    }
    for (const r of rows) {
      if (r.author_id !== series.authorId) {
        throw conflict(
          `"${r.title}" ditulis oleh penulis lain, sehingga tidak dapat dimasukkan ke seri ini.`,
        );
      }
    }
  }

  return withTransaction(async (conn) => {
    await conn.execute('DELETE FROM book_series_items WHERE series_id = ?', [seriesId]);
    for (const item of input.items) {
      await conn.execute(
        'INSERT INTO book_series_items (series_id, book_id, position, note) VALUES (?, ?, ?, ?)',
        [seriesId, item.bookId, item.position, item.note || null],
      );
    }
  });
}

/** Lightweight list for admin pickers. */
export async function listAllAuthors() {
  const rows = await query<RowDataPacket & { id: number; name: string }>(
    'SELECT id, name FROM authors ORDER BY name ASC',
  );
  return rows.map((r) => ({ id: r.id, name: r.name }));
}
