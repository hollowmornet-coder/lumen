import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
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
  AdminReports,
  Announcement,
  AuthorDetail,
  AuthorSummary,
  Book,
  Category,
  DashboardCharts,
  Fine,
  FineSummary,
  Holiday,
  LeaderboardEntry,
  LevelTier,
  Loan,
  Member,
  MemberOverview,
  MyLevel,
  Notification,
  Opname,
  Reservation,
  Review,
  ReviewStats,
  ScanTarget,
  SeriesDetail,
  SettingItem,
  Visit,
  VisitSummary,
  WishlistDemand,
  WishlistItem,
} from '@/types';

export const queryKeys = {
  adminOverview: ['dashboard', 'admin', 'overview'] as const,
  adminCharts: (range: string) => ['dashboard', 'admin', 'charts', range] as const,
  adminReports: (range: string) => ['dashboard', 'admin', 'reports', range] as const,
  memberOverview: ['dashboard', 'member', 'overview'] as const,
  books: (params: unknown) => ['books', params] as const,
  book: (id: number) => ['book', id] as const,
  categories: ['categories'] as const,
  members: (params: unknown) => ['members', params] as const,
  loans: (params: unknown) => ['loans', params] as const,
  myLoans: (params: unknown) => ['my-loans', params] as const,
  fines: (params: unknown) => ['fines', params] as const,
  myFines: (params: unknown) => ['my-fines', params] as const,
  reservations: ['reservations'] as const,
  myReservations: ['my-reservations'] as const,
  notifications: (params: unknown) => ['notifications', params] as const,
  notificationCount: ['notifications', 'unread-count'] as const,
  activity: (params: unknown) => ['activity', params] as const,
  settings: ['settings'] as const,
  authors: (params: unknown) => ['authors', params] as const,
  author: (slug: string) => ['author', slug] as const,
  series: (id: number) => ['series', id] as const,
  holidays: (year?: number) => ['holidays', year ?? 'all'] as const,
  visits: (params: unknown) => ['visits', params] as const,
  visitSummary: ['visits', 'summary'] as const,
  opnames: (params: unknown) => ['opnames', params] as const,
  reviews: (params: unknown) => ['reviews', params] as const,
  reviewStats: (bookId: number) => ['reviews', 'stats', bookId] as const,
  myReview: (bookId: number) => ['reviews', 'mine', bookId] as const,
  announcements: (params: unknown) => ['announcements', params] as const,
  wishlist: (params: unknown) => ['wishlist', params] as const,
  wishlistDemand: ['wishlist', 'demand'] as const,
  myLevel: ['levels', 'me'] as const,
  levelTiers: ['levels', 'tiers'] as const,
  leaderboard: (limit: number) => ['levels', 'leaderboard', limit] as const,
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

export function useAdminReports(params: { from: string; to: string }) {
  return useQuery({
    queryKey: queryKeys.adminReports(JSON.stringify(params)),
    queryFn: async () =>
      (await api.get<AdminReports>('/dashboard/admin/reports', { query: params })).data,
    placeholderData: (prev) => prev,
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

/* ------------------------------------------------------------------
   Fines, reservations, notifications
   ------------------------------------------------------------------ */

export interface FineListResult {
  items: Fine[];
  meta: ApiMeta;
  summary: FineSummary;
}

/**
 * Fines carry their own summary in the response envelope, so the totals above
 * the table always describe the whole ledger rather than the visible page.
 */
export function useFines(params: Record<string, unknown>, scope: 'admin' | 'mine' = 'admin') {
  const path = scope === 'admin' ? '/fines' : '/fines/mine';
  return useQuery({
    queryKey: scope === 'admin' ? queryKeys.fines(params) : queryKeys.myFines(params),
    queryFn: async () => {
      const res = await api.get<Fine[]>(path, { query: params });
      return {
        items: res.data,
        meta: res.meta ?? emptyMeta,
        summary: (res as unknown as { summary: FineSummary }).summary ?? {
          unpaidCount: 0,
          unpaidTotal: 0,
          paidTotal: 0,
          waivedTotal: 0,
        },
      } satisfies FineListResult;
    },
    placeholderData: (prev) => prev,
  });
}

export function useMyReservations() {
  return useQuery({
    queryKey: queryKeys.myReservations,
    queryFn: async () => (await api.get<Reservation[]>('/reservations/mine')).data,
  });
}

export function useReservations(params: Record<string, unknown>) {
  return useQuery({
    queryKey: [...queryKeys.reservations, params],
    queryFn: async () => (await api.get<Reservation[]>('/reservations', { query: params })).data,
    placeholderData: (prev) => prev,
  });
}

export function useNotifications(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: async () => {
      const res = await api.get<Notification[]>('/notifications', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    enabled,
    staleTime: 15_000,
  });
}

export function useUnreadNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notificationCount,
    queryFn: async () =>
      (await api.get<{ unread: number }>('/notifications/unread-count')).data.unread,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => (await api.get<SettingItem[]>('/settings')).data,
  });
}

/**
 * Resolves a scanned code.
 *
 * Modelled as a mutation, not a query: the same code scanned twice must hit the
 * server twice. A cached query would happily return the book it resolved five
 * minutes ago and the officer would lend the wrong copy.
 */
export function useScanLookup() {
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.get<ScanTarget>('/scan', { query: { code } })).data,
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
   Operasional lanjutan: hari libur, kunjungan, opname, ulasan,
   pengumuman, daftar keinginan.
   ------------------------------------------------------------------ */

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: queryKeys.holidays(year),
    queryFn: async () =>
      (await api.get<Holiday[]>('/holidays', { query: year ? { year } : undefined })).data,
  });
}

export function useVisits(params: Record<string, unknown>, options?: Options<Visit>) {
  return useQuery({
    queryKey: queryKeys.visits(params),
    queryFn: async () => {
      const res = await api.get<Visit[]>('/visits', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useVisitSummary() {
  return useQuery({
    queryKey: queryKeys.visitSummary,
    queryFn: async () => (await api.get<VisitSummary>('/visits/summary')).data,
  });
}

export function useOpnames(params: Record<string, unknown>, options?: Options<Opname>) {
  return useQuery({
    queryKey: queryKeys.opnames(params),
    queryFn: async () => {
      const res = await api.get<Opname[]>('/opnames', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useReviews(params: Record<string, unknown>, options?: Options<Review>) {
  return useQuery({
    queryKey: queryKeys.reviews(params),
    queryFn: async () => {
      const res = await api.get<Review[]>('/reviews', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useReviewStats(bookId: number | null) {
  return useQuery({
    queryKey: queryKeys.reviewStats(bookId ?? 0),
    queryFn: async () => (await api.get<ReviewStats>(`/reviews/book/${bookId}/stats`)).data,
    enabled: Boolean(bookId),
  });
}

export function useMyReview(bookId: number | null) {
  return useQuery({
    queryKey: queryKeys.myReview(bookId ?? 0),
    queryFn: async () => (await api.get<Review | null>(`/reviews/book/${bookId}/mine`)).data,
    enabled: Boolean(bookId),
  });
}

export function useAnnouncements(params: Record<string, unknown> = {}, options?: Options<Announcement>) {
  return useQuery({
    queryKey: queryKeys.announcements(params),
    queryFn: async () => {
      const res = await api.get<Announcement[]>('/announcements', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useWishlist(params: Record<string, unknown> = {}, options?: Options<WishlistItem>) {
  return useQuery({
    queryKey: queryKeys.wishlist(params),
    queryFn: async () => {
      const res = await api.get<WishlistItem[]>('/wishlist', { query: params });
      return { items: res.data, meta: res.meta ?? emptyMeta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useWishlistDemand() {
  return useQuery({
    queryKey: queryKeys.wishlistDemand,
    queryFn: async () => (await api.get<WishlistDemand[]>('/wishlist/demand')).data,
  });
}

/**
 * Which of the visible books the member has already hearted.
 *
 * The id list is part of the key so the query refetches when the catalogue page
 * changes, instead of serving stale hearts for a different set of rows.
 */
export function useWishlistMarks(bookIds: number[]) {
  const key = bookIds.join(',');
  return useQuery({
    queryKey: ['wishlist', 'marks', key] as const,
    queryFn: async () =>
      (await api.get<number[]>('/wishlist/check', { query: { bookIds: key } })).data,
    enabled: bookIds.length > 0,
  });
}

/* ------------------------------------------------------------------
   Levels - derived from loan history on the server, never stored.
   ------------------------------------------------------------------ */

export function useMyLevel(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.myLevel,
    queryFn: async () => (await api.get<MyLevel>('/levels/me')).data,
    ...options,
  });
}

/** The curve itself, so the UI never hard-codes a threshold. */
export function useLevelTiers() {
  return useQuery({
    queryKey: queryKeys.levelTiers,
    queryFn: async () => (await api.get<LevelTier[]>('/levels')).data,
    staleTime: 30 * 60_000,
  });
}

export function useLeaderboard(limit = 10) {
  return useQuery({
    queryKey: queryKeys.leaderboard(limit),
    queryFn: async () => (await api.get<LeaderboardEntry[]>('/levels/leaderboard', { query: { limit } })).data,
    staleTime: 60_000,
  });
}

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
          toast.success(msg);
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
      toast.error((err as ApiError).message ?? 'Terjadi kesalahan.');
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
