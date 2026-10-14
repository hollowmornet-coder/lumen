import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  History,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import { Badge, LoanStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { useListParams, useMyLoans } from '@/hooks/useApi';
import { cn, formatDate, formatNumber, formatRupiah } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Loan, LoanStatus } from '@/types';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

/** Statuses that can only ever be read, never acted on, by the member. */
const HISTORY_STATUSES: readonly LoanStatus[] = ['returned', 'rejected', 'cancelled'];

const FILTERS = [
  { value: 'returned', label: 'Selesai' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'all', label: 'Semua riwayat' },
] as const;

function matchesFilter(loan: Loan, filter: string): boolean {
  if (!HISTORY_STATUSES.includes(loan.status)) return false;
  return filter === 'all' || loan.status === filter;
}

interface Paged<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

/**
 * Client-side slice over one request: the server filter is single-status only,
 * while "Semua riwayat" has to merge three of them into one ordered list.
 */
function paginate<T>(rows: T[], page: number, pageSize: number): Paged<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), page: current, totalPages, total, pageSize };
}

export default function MyHistoryPage() {
  const defaults = React.useMemo(() => ({ status: 'returned' }), []);
  const { get, set, setMany, reset } = useListParams(defaults);

  const status = get('status', 'returned');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '12')) || 12;

  const loans = useMyLoans({
    status: status === 'all' ? 'all' : status,
    sort: 'requested_at',
    direction: 'DESC',
    pageSize: 100,
  });

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.03);
  const rowVariants = reduce ? STILL : staggerItem;

  const all = React.useMemo(() => loans.data?.items ?? [], [loans.data?.items]);
  const filtered = React.useMemo(
    () => all.filter((loan) => matchesFilter(loan, status)),
    [all, status],
  );
  const paged = paginate(filtered, page, pageSize);

  const hasFilters = status !== 'returned';
  const activeLabel = FILTERS.find((f) => f.value === status)?.label ?? 'Selesai';

  return (
    <>
      <PageHeader
        eyebrow="Arsip Peminjaman"
        title="Riwayat Peminjaman"
        description="Catatan peminjaman yang sudah selesai, ditolak, atau dibatalkan. Riwayat bersifat permanen dan tidak dapat disunting."
        breadcrumb={[
          { label: 'Beranda', to: '/perpustakaan' },
          { label: 'Riwayat' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loans.refetch()}
              loading={loans.isFetching && !loans.isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Perbarui
            </Button>
            <Button asChild size="sm">
              <Link to="/perpustakaan/pinjaman">
                <ClipboardList className="size-3.5" aria-hidden />
                Pinjaman Saya
              </Link>
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {loans.isLoading
              ? 'Memuat riwayat...'
              : `${formatNumber(paged.total)} transaksi · tampilan ${activeLabel.toLowerCase()}`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Filter ---------- */}
        <div className="panel p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <History className="size-3" aria-hidden />
              Status riwayat
            </span>
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setMany({ status: filter.value, page: undefined })}
                aria-pressed={status === filter.value}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  status === filter.value
                    ? 'border-primary/30 bg-electric-soft text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {filter.label}
              </button>
            ))}
            {hasFilters ? (
              <button
                type="button"
                onClick={reset}
                className="rounded text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tampilkan yang selesai
              </button>
            ) : null}
          </div>
        </div>

        {/* ---------- Table ---------- */}
        <section className="panel overflow-hidden" aria-label="Riwayat peminjaman">
          {loans.isFetching && !loans.isLoading ? (
            <div className="h-0.5 overflow-hidden bg-border" aria-hidden>
              <div className="h-full w-1/3 animate-shimmer bg-primary" />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <caption className="sr-only">
                Riwayat peminjaman buku beserta tanggal dipinjam, jatuh tempo, pengembalian, dan
                status
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Kode
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Judul buku
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Dipinjam
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Jatuh tempo
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Dikembalikan
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Status
                  </th>
                </tr>
              </thead>

              {loans.isLoading ? (
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      <TableSkeleton rows={6} columns={5} />
                    </td>
                  </tr>
                </tbody>
              ) : loans.isError ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <ErrorState
                        title="Gagal memuat riwayat"
                        message={loans.error?.message}
                        onRetry={() => void loans.refetch()}
                      />
                    </td>
                  </tr>
                </tbody>
              ) : paged.items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      {hasFilters ? (
                        <NoResultsState
                          onReset={reset}
                          description="Tidak ada riwayat dengan status ini. Coba lihat seluruh riwayat peminjaman."
                        />
                      ) : (
                        <EmptyState
                          icon={BookOpen}
                          title="Belum ada riwayat"
                          description="Riwayat akan terisi setelah buku pertama Anda selesai dipinjam atau pengajuan Anda selesai diproses."
                          action={
                            <Button asChild size="sm">
                              <Link to="/katalog">
                                Ajukan peminjaman
                                <ArrowRight className="size-3.5" aria-hidden />
                              </Link>
                            </Button>
                          }
                        />
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key={`${status}-${paged.page}-${pageSize}`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {paged.items.map((loan) => (
                    <motion.tr
                      key={loan.id}
                      variants={rowVariants}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span className="block font-mono text-xs font-semibold text-foreground">
                          {loan.loanCode}
                        </span>
                        <span className="mt-0.5 block text-2xs text-muted-foreground">
                          diajukan {formatDate(loan.requestedAt)}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <MiniCover
                            title={loan.book.title}
                            author={loan.book.author}
                            src={loan.book.coverPath}
                          />
                          <div className="min-w-0 max-w-[18rem]">
                            <p className="truncate font-display text-sm font-semibold text-foreground">
                              {loan.book.title}
                            </p>
                            <p className="truncate text-2xs text-muted-foreground">
                              {loan.book.author}
                            </p>
                            <p className="mt-1 truncate font-mono text-2xs text-muted-foreground/80">
                              {loan.book.isbn}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-foreground">
                        {formatDate(loan.borrowedAt)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-foreground">
                        {formatDate(loan.dueAt)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-foreground">
                        {formatDate(loan.returnedAt)}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <LoanStatusBadge status={loan.status} />
                          {loan.daysLate !== null && loan.daysLate > 0 ? (
                            <Badge tone="danger">{formatNumber(loan.daysLate)} hari telat</Badge>
                          ) : null}
                          {loan.lateFee !== null && loan.lateFee > 0 ? (
                            <Badge tone="warning">Denda {formatRupiah(loan.lateFee)}</Badge>
                          ) : null}
                        </div>
                        {loan.rejectedReason ? (
                          <p className="mt-1.5 max-w-[16rem] text-2xs leading-relaxed text-muted-foreground">
                            Alasan: {loan.rejectedReason}
                          </p>
                        ) : null}
                        {loan.returnCondition && loan.returnCondition !== 'good' ? (
                          <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                            Kondisi: {loan.returnCondition}
                          </p>
                        ) : null}
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              )}
            </table>
          </div>

          {paged.total > 0 ? (
            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              pageSize={pageSize}
              onPageChange={(p) => {
                set('page', p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPageSizeChange={(s) => setMany({ pageSize: s, page: undefined })}
            />
          ) : null}
        </section>
      </PageBody>
    </>
  );
}
