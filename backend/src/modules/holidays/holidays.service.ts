import { execute, query, queryOne, type PoolConnection, type RowDataPacket } from '../../config/db';
import { conflict, notFound } from '../../lib/errors';
import type { CreateHolidayInput, HolidayQuery } from './holidays.schema';

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

interface HolidayRow extends RowDataPacket {
  id: number;
  holiday_date: string;
  name: string;
}

function toHoliday(row: HolidayRow): Holiday {
  return {
    id: row.id,
    // MariaDB returns DATE columns as `YYYY-MM-DD` already; the slice guards
    // against a driver that decides to hand back a full timestamp instead.
    date: String(row.holiday_date).slice(0, 10),
    name: row.name,
  };
}

export async function listHolidays(params: HolidayQuery): Promise<Holiday[]> {
  const args: unknown[] = [];
  let where = '';

  if (params.year !== undefined) {
    where = 'WHERE YEAR(holiday_date) = ?';
    args.push(params.year);
  }

  const rows = await query<HolidayRow>(
    `SELECT id, holiday_date, name FROM holidays ${where} ORDER BY holiday_date ASC`,
    args,
  );
  return rows.map(toHoliday);
}

export async function createHoliday(input: CreateHolidayInput): Promise<Holiday> {
  try {
    const result = await execute(
      'INSERT INTO holidays (holiday_date, name) VALUES (?, ?)',
      [input.date, input.name],
    );
    const row = await queryOne<HolidayRow>(
      'SELECT id, holiday_date, name FROM holidays WHERE id = ?',
      [result.insertId],
    );
    if (!row) throw notFound('Hari libur tidak ditemukan.');
    return toHoliday(row);
  } catch (err) {
    // The UNIQUE index is the real guard; checking first would still race.
    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw conflict('Tanggal itu sudah tercatat sebagai hari libur.');
    }
    throw err;
  }
}

export async function deleteHoliday(id: number): Promise<void> {
  const result = await execute('DELETE FROM holidays WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw notFound('Hari libur tidak ditemukan.');
}

/**
 * Works out how many days to add to "now" so the due date lands on a day the
 * library is actually open.
 *
 * The loop runs entirely inside MySQL: a recursive sequence generates the
 * candidate dates, and the first one that is neither a holiday nor a Sunday
 * wins. Doing the same arithmetic in Node would mean re-deriving "today" from
 * the application clock, which is exactly the class of bug that made password
 * reset tokens expire instantly (see docs/DEBUGGING.md #17).
 *
 * Returns the ORIGINAL `days` when shifting is disabled or nothing needs to
 * move, so callers can always use `DATE_ADD(NOW(), INTERVAL ? DAY)`.
 */
export async function resolveDueDays(
  days: number,
  options: { skipHolidays: boolean },
  conn?: PoolConnection,
): Promise<number> {
  if (!options.skipHolidays) return days;

  // The window is capped: a due date is never pushed more than a month, and an
  // unbounded loop could not terminate if every day were marked a holiday.
  const MAX_SHIFT = 30;

  const sql = `
    WITH RECURSIVE seq (n) AS (
      SELECT 0
      UNION ALL
      SELECT n + 1 FROM seq WHERE n < ?
    )
    SELECT MIN(seq.n) AS first_open
      FROM seq
      LEFT JOIN holidays h
             ON h.holiday_date = DATE_ADD(CURDATE(), INTERVAL (? + seq.n) DAY)
     WHERE h.id IS NULL
       AND DAYOFWEEK(DATE_ADD(CURDATE(), INTERVAL (? + seq.n) DAY)) <> 1
       AND seq.n >= ?`;

  const args = [MAX_SHIFT + days, days, days, days];

  const runner = conn
    ? async <T extends RowDataPacket>(sqlText: string, params: unknown[]) => {
        const [rows] = await conn.query<T[]>(sqlText, params);
        return rows;
      }
    : async <T extends RowDataPacket>(sqlText: string, params: unknown[]) => query<T>(sqlText, params);

  const rows = await runner<RowDataPacket & { first_open: number | null }>(sql, args);
  const firstOpen = rows[0]?.first_open;

  if (firstOpen === null || firstOpen === undefined) {
    // Everything in the window is closed. Rather than silently producing a
    // due date during a holiday, keep the plain arithmetic and let the
    // librarian see the real date.
    return days;
  }

  return Number(firstOpen);
}
