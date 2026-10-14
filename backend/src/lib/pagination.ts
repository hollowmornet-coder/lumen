/** Shared pagination + list-query parsing for every collection endpoint. */

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

export interface ListQuery {
  page: number;
  pageSize: number;
  offset: number;
  sort: string;
  direction: 'ASC' | 'DESC';
}

export function parseListQuery(
  query: Record<string, unknown>,
  allowedSortColumns: string[],
  defaultSort = 'id',
): ListQuery {
  const rawPage = Number.parseInt(String(query.page ?? '1'), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawSize = Number.parseInt(String(query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10);
  const pageSize = Math.min(Math.max(Number.isFinite(rawSize) && rawSize > 0 ? rawSize : DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  // Whitelist sort columns. Never interpolate raw user input into ORDER BY.
  const requested = String(query.sort ?? defaultSort);
  const sort = allowedSortColumns.includes(requested) ? requested : defaultSort;

  const requestedDir = String(query.direction ?? 'DESC').toUpperCase();
  const direction: 'ASC' | 'DESC' = requestedDir === 'ASC' ? 'ASC' : 'DESC';

  return { page, pageSize, offset: (page - 1) * pageSize, sort, direction };
}

export interface Paginated<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(items: T[], total: number, q: ListQuery): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  return {
    items,
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages,
      hasNext: q.page < totalPages,
      hasPrev: q.page > 1,
    },
  };
}

/** Escape LIKE wildcards so a literal % or _ in user input is not a wildcard. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
