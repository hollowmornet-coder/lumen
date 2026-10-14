import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { ApiMeta } from '@/lib/api';
import type {
  ActivityItem,
  AdminOverview,
  AuthorDetail,
  AuthorSummary,
  Book,
  Category,
  DashboardCharts,
  Loan,
  Member,
  MemberOverview,
  SeriesDetail,
  SettingItem,
} from '@/types';

export const queryKeys = {
  adminOverview: ['dashboard', 'admin', 'overview'] as const,
  adminCharts: (range: string) => ['dashboard', 'admin', 'charts', range] as const,
  memberOverview: ['dashboard', 'member', 'overview'] as const,
  books: (params: unknown) => ['books', params] as const,
  book: (id: number) => ['book', id] as const,
  categories: ['categories'] as const,
  members: (params: unknown) => ['members', params] as const,
  loans: (params: unknown) => ['loans', params] as const,
  myLoans: (params: unknown) => ['my-loans', params] as const,
  activity: (params: unknown) => ['activity', params] as const,
  settings: ['settings'] as const,
  authors: (params: unknown) => ['authors', params] as const,
  author: (slug: string) => ['author', slug] as const,
  series: (id: number) => ['series', id] as const,
};

interface ListResult<T> {
  items: T[];
  meta: ApiMeta;
}

type Options<T> = Omit<UseQueryOptions<ListResult<T>, ApiError>, 'queryKey' | 'queryFn'>;

/** True when the failure means "you are not allowed", not "it broke". */
export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

export function useAdminOverview() {
  return useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: async () => (await api.get<AdminOverview>('/dashboard/admin/overview')).data,
    refetchInterval: 60_000,
  });
}

export function useAdminCharts(params: { from: string; to: string; bucket: string }) {
  return useQuery({
    queryKey: queryKeys.adminCharts(JSON.stringify(params)),
    queryFn: async () =>
      (await api.get<DashboardCharts>('/dashboard/admin/charts', { query: params })).data,
    placeholderData: (prev) => prev,
  });
}

export function useMemberOverview() {
  return useQuery({
    queryKey: queryKeys.memberOverview,
    queryFn: async () => (await api.get<MemberOverview>('/dashboard/member/overview')).data,
  });
}

export function useBooks(params: Record<string, unknown>, options?: Options<Book>) {
  return useQuery({
    queryKey: queryKeys.books(params),
    queryFn: async () => {
      const res = await api.get<Book[]>('/books', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useBook(id: number | null) {
  return useQuery({
    queryKey: queryKeys.book(id ?? 0),
    queryFn: async () => (await api.get<Book>(`/books/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => (await api.get<Category[]>('/categories')).data,
    staleTime: 5 * 60_000,
  });
}

export function useMembers(params: Record<string, unknown>, options?: Options<Member>) {
  return useQuery({
    queryKey: queryKeys.members(params),
    queryFn: async () => {
      const res = await api.get<Member[]>('/members', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useLoans(params: Record<string, unknown>, options?: Options<Loan>) {
  return useQuery({
    queryKey: queryKeys.loans(params),
    queryFn: async () => {
      const res = await api.get<Loan[]>('/loans', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useMyLoans(params: Record<string, unknown>, options?: Options<Loan>) {
  return useQuery({
    queryKey: queryKeys.myLoans(params),
    queryFn: async () => {
      const res = await api.get<Loan[]>('/loans/mine', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useActivity(params: Record<string, unknown>, options?: Options<ActivityItem>) {
  return useQuery({
    queryKey: queryKeys.activity(params),
    queryFn: async () => {
      const res = await api.get<ActivityItem[]>('/activity', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => (await api.get<SettingItem[]>('/settings')).data,
  });
}

/* ------------------------------------------------------------------
   Authors & series
   ------------------------------------------------------------------ */

export function useAuthors(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.authors(params),
    queryFn: async () => {
      const res = await api.get<AuthorSummary[]>('/collections/authors', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

export function useAuthor(slug: string | null) {
  return useQuery({
    queryKey: queryKeys.author(slug ?? ''),
    queryFn: async () =>
      (await api.get<AuthorDetail>(`/collections/authors/${encodeURIComponent(slug as string)}`))
        .data,
    enabled: Boolean(slug),
  });
}

export function useSeries(id: number | null) {
  return useQuery({
    queryKey: queryKeys.series(id ?? 0),
    queryFn: async () =>
      (await api.get<SeriesDetail>(`/collections/series/${id}`)).data,
    enabled: Boolean(id) && Number.isFinite(id),
  });
}

const emptyMeta: ApiMeta = {
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

/* ------------------------------------------------------------------
   Mutations
   ------------------------------------------------------------------ */

/**
 * Wraps a mutation so a success toast fires only after the server confirms,
 * and the relevant caches are invalidated afterwards.
 */
export function useApiMutation<TVars, TData = unknown>({
  mutationFn,
  successMessage,
  invalidate = [],
  onSuccess,
  onError,
}: {
  mutationFn: (vars: TVars) => Promise<TData>;
  successMessage?: string | ((data: TData, vars: TVars) => string);
  invalidate?: ReadonlyArray<readonly unknown[]>;
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (err: ApiError, vars: TVars) => void;
}) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, vars) => {
      if (successMessage) {
        const msg = typeof successMessage === 'function' ? successMessage(data, vars) : successMessage;
        if (msg) {
          import('sonner').then(({ toast }) => toast.success(msg));
        }
      }
      for (const key of invalidate) {
        void qc.invalidateQueries({ queryKey: key as readonly unknown[] });
      }
      onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      if (onError) {
        onError(err as ApiError, vars);
        return;
      }
      import('sonner').then(({ toast }) =>
        toast.error((err as ApiError).message ?? 'Terjadi kesalahan.'),
      );
    },
  });
}

/* ------------------------------------------------------------------
   URL-synced list state - keeps filters shareable via the address bar.
   ------------------------------------------------------------------ */

export function useListParams(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams();

  const get = React.useCallback(
    (key: string, fallback = '') => params.get(key) ?? defaults[key] ?? fallback,
    [params, defaults],
  );

  const set = React.useCallback(
    (key: string, value: string | number | undefined) => {
      setParams(
        (prev: URLSearchParams) => {
          const next = new URLSearchParams(prev);
          if (value === undefined || value === '' || value === defaults[key]) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  const setMany = React.useCallback(
    (values: Record<string, string | number | undefined>) => {
      setParams(
        (prev: URLSearchParams) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(values)) {
            if (value === undefined || value === '' || value === defaults[key]) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  const reset = React.useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  return { params, get, set, setMany, reset, raw: params };
}

/** Debounced mirror of a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
