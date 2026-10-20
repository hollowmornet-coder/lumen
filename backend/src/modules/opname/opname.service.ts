import {
  execute,
  query,
  queryOne,
  withTransaction,
  type PoolConnection,
  type RowDataPacket,
} from '../../config/db';
import { BusinessRuleError, notFound } from '../../lib/errors';
import { paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import type { CreateOpnameInput, OpnameQuery } from './opname.schema';

export interface Opname {
  id: number;
  bookId: number;
  bookTitle: string;
  isbn: string;
  /** System figure when the session started — a snapshot, never recomputed. */
  expected: number;
  counted: number;
  difference: number;
  note: string | null;
  appliedAt: string | null;
  appliedBy: number | null;
  appliedByName: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
}

interface OpnameRow extends RowDataPacket {
  id: number;
  book_id: number;
  book_title: string;
  isbn: string;
  expected: number;
  counted: number;
  note: string | null;
  applied_at: string | null;
  applied_by: number | null;
  applied_by_name: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

function toOpname(row: OpnameRow): Opname {
  return {
    id: row.id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    isbn: row.isbn,
    expected: Number(row.expected),
    counted: Number(row.counted),
    difference: Number(row.counted) - Number(row.expected),
    note: row.note,
    appliedAt: row.applied_at,
    appliedBy: row.applied_by,
    appliedByName: row.applied_by_name,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

const OPNAME_SELECT = `
  SELECT o.id, o.book_id, o.expected, o.counted, o.note,
         o.applied_at, o.applied_by, o.created_by, o.created_at,
         b.title AS book_title, b.isbn,
         cb.full_name AS created_by_name,
         ab.full_name AS applied_by_name
    FROM stock_opnames o
    JOIN books b       ON b.id = o.book_id
    JOIN users cb      ON cb.id = o.created_by
    LEFT JOIN users ab ON ab.id = o.applied_by
`;

export async function listOpnames(params: OpnameQuery): Promise<Paginated<Opname>> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (params.status === 'pending') where.push('o.applied_at IS NULL');
  if (params.status === 'applied') where.push('o.applied_at IS NOT NULL');
  if (params.bookId) {
    where.push('o.book_id = ?');
    args.push(params.bookId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listQuery = parseListQuery(
    { page: params.page, pageSize: params.pageSize, sort: 'created_at', direction: 'DESC' },
    ['created_at'],
    'created_at',
  );

  const countRows = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM stock_opnames o ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await query<OpnameRow>(
    `${OPNAME_SELECT} ${whereSql}
      ORDER BY o.${listQuery.sort} ${listQuery.direction}
      LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toOpname), total, listQuery);
}

export async function getOpnameById(id: number): Promise<Opname> {
  const row = await queryOne<OpnameRow>(`${OPNAME_SELECT} WHERE o.id = ?`, [id]);
  if (!row) throw notFound('Sesi opname tidak ditemukan.');
  return toOpname(row);
}

/**
 * Opens a stock-count session for one book.
 *
 * `expected` is read from the live row and stored. If it were recomputed at
 * approval time instead, a loan that happened between counting and approving
 * would silently change what "the shelf said" — and the whole point of an
 * audit is to preserve what was expected when the shelf was counted.
 *
 * Copies currently out on loan are deliberately NOT part of `expected`: the
 * librarian can only count what is physically in the building.
 */
export async function createOpname(
  input: CreateOpnameInput,
  createdBy: number,
): Promise<Opname> {
  const book = await queryOne<
    RowDataPacket & { id: number; title: string; available_copies: number; damaged_copies: number }
  >('SELECT id, title, available_copies, damaged_copies FROM books WHERE id = ?', [input.bookId]);
  if (!book) throw notFound('Buku tidak ditemukan.');

  const expected = Number(book.available_copies) + Number(book.damaged_copies);

  const result = await execute(
    `INSERT INTO stock_opnames (book_id, expected, counted, note, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [input.bookId, expected, input.counted, input.note ?? null, createdBy],
  );

  return getOpnameById(result.insertId);
}

/**
 * Applies a counted session to the real stock figures.
 *
 * The adjustment is expressed in terms of *physically present* copies, which is
 * the only thing an opname can actually observe:
 *
 *   present   = available + damaged
 *   borrowed  = total - present
 *   new total = counted + borrowed
 *   new avail = counted - damaged (capped so it can never go negative)
 *
 * Copies on loan are left alone. Marking a borrowed book "missing" because it
 * was not on the shelf would be a false accusation and would break the
 * invariant `available + damaged + borrowed = total`.
 */
export async function applyOpname(
  id: number,
  appliedBy: number,
): Promise<Opname> {
  await withTransaction(async (conn: PoolConnection) => {
    const [opnameRows] = await conn.query<
      Array<RowDataPacket & { id: number; book_id: number; counted: number; applied_at: string | null }>
    >('SELECT id, book_id, counted, applied_at FROM stock_opnames WHERE id = ? FOR UPDATE', [id]);
    const opname = opnameRows[0];
    if (!opname) throw notFound('Sesi opname tidak ditemukan.');
    if (opname.applied_at) {
      throw new BusinessRuleError(
        'Sesi opname ini sudah diterapkan ke stok.',
        'OPNAME_ALREADY_APPLIED',
      );
    }

    const [bookRows] = await conn.query<
      Array<
        RowDataPacket & {
          id: number;
          total_copies: number;
          available_copies: number;
          damaged_copies: number;
        }
      >
    >(
      `SELECT id, total_copies, available_copies, damaged_copies
         FROM books WHERE id = ? FOR UPDATE`,
      [opname.book_id],
    );
    const book = bookRows[0];
    if (!book) throw notFound('Buku tidak ditemukan.');

    const total = Number(book.total_copies);
    const available = Number(book.available_copies);
    const damaged = Number(book.damaged_copies);
    const counted = Number(opname.counted);

    const borrowed = Math.max(0, total - available - damaged);

    // Damage cannot exceed what was actually counted.
    const nextDamaged = Math.min(damaged, counted);
    const nextAvailable = counted - nextDamaged;
    const nextTotal = counted + borrowed;

    await conn.execute(
      `UPDATE books
          SET total_copies = ?, available_copies = ?, damaged_copies = ?
        WHERE id = ?`,
      [nextTotal, nextAvailable, nextDamaged, book.id],
    );

    await conn.execute(
      'UPDATE stock_opnames SET applied_at = NOW(), applied_by = ? WHERE id = ?',
      [appliedBy, id],
    );
  });

  return getOpnameById(id);
}
