import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BookCheck,
  BookMarked,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  Library,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import { Badge, LoanStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HeadlineFigure, StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useCategories, useMemberOverview, useMyLoans, useAnnouncements } from '@/hooks/useApi';
import { useAuth } from '@/features/auth/AuthContext';
import { LeaderboardCard } from '@/features/profile/LeaderboardCard';
import { MyLevelCard } from '@/features/profile/MyLevelCard';
import { cn, formatDate, formatNumber, relativeDays } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

export default function MemberHomePage() {
  const { user } = useAuth();
  const overview = useMemberOverview();
  const loans = useMyLoans({ pageSize: 5, sort: 'requested_at', direction: 'DESC' });
  const categories = useCategories();

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.04);
  const rowVariants = reduce ? STILL : staggerItem;

  const d = overview.data;
  const isLoading = overview.isLoading;

  const maxLoan = d?.maxLoanPerUser ?? 0;
  const usedQuota = d?.activeLoans ?? 0;
  const quotaPercent = maxLoan > 0 ? Math.min(100, Math.round((usedQuota / maxLoan) * 100)) : 0;
  const quotaFull = d ? d.remainingQuota <= 0 : false;

  const recent = loans.data?.items ?? [];
  const firstName = user?.fullName?.split(' ')[0] ?? 'Siswa';

  return (
    <>
      <PageHeader
        eyebrow="Beranda Siswa"
        title={`Halo, ${firstName}`}
        description="Ringkasan peminjaman Anda di Perpustakaan Sekolah Digital. Semua angka diambil langsung dari server."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void overview.refetch();
              void loans.refetch();
            }}
            loading={overview.isFetching || loans.isFetching}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Perbarui
          </Button>
        }
        meta={
          <p className="text-xs text-muted-foreground">
            {user?.memberCode ? (
              <>
                Kode anggota{' '}
                <span className="font-mono font-semibold text-foreground">{user.memberCode}</span>
              </>
            ) : (
              'Kode anggota diberikan petugas perpustakaan'
            )}
          </p>
        }
      />

      <PageBody className="space-y-6">
        {/* ---------- Personal figures ---------- */}
        <section aria-label="Statistik pribadi">
          {overview.isError ? (
            <div className="panel">
              <ErrorState
                title="Gagal memuat ringkasan"
                message={overview.error?.message}
                onRetry={() => void overview.refetch()}
              />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-4">
              <HeadlineFigure
                label="Buku Sedang Dipinjam"
                value={usedQuota}
                caption={maxLoan > 0 ? `dari ${formatNumber(maxLoan)} kuota Anda` : 'kuota belum diatur'}
                loading={isLoading}
              />

              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
                <StatCard
                  index={0}
                  label="Menunggu Persetujuan"
                  value={d?.pendingRequests ?? 0}
                  icon={Clock3}
                  tone="warning"
                  loading={isLoading}
                  hint="diajukan, belum disetujui petugas"
                />
                <StatCard
                  index={1}
                  label="Peminjaman Terlambat"
                  value={d?.overdueLoans ?? 0}
                  icon={AlertTriangle}
                  tone="danger"
                  loading={isLoading}
                  hint="lewat jatuh tempo"
                />
                <StatCard
                  index={2}
                  label="Total Pernah Dipinjam"
                  value={d?.totalBorrowed ?? 0}
                  icon={BookCheck}
                  tone="success"
                  loading={isLoading}
                  hint="selama masa keanggotaan"
                />
                <StatCard
                  index={3}
                  label="Menunggu Verifikasi"
                  value={d?.returnRequested ?? 0}
                  icon={BookOpen}
                  tone="violet"
                  loading={isLoading}
                  hint="pengembalian sudah diajukan"
                />
              </div>
            </div>
          )}
        </section>

        {/* ---------- Quota ---------- */}
        <section className="panel p-5" aria-label="Kuota peminjaman">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Kuota Peminjaman</p>
              <h2 className="font-display text-base font-semibold text-foreground">
                {isLoading
                  ? 'Memuat kuota...'
                  : overview.isError
                    ? 'Data kuota tidak tersedia'
                    : `${formatNumber(usedQuota)} dari ${formatNumber(maxLoan)} buku terpakai`}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kuota terisi saat buku disetujui petugas dan masih ada di tangan Anda.
              </p>
            </div>
            {quotaFull && !isLoading ? (
              <Badge tone="warning">
                <AlertTriangle className="size-3" aria-hidden />
                Batas tercapai
              </Badge>
            ) : null}
          </div>

          {isLoading ? (
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
          ) : overview.isError ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void overview.refetch()}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Coba muat ulang kuota
            </Button>
          ) : (
            <div
              role="progressbar"
              aria-label="Penggunaan kuota peminjaman"
              aria-valuemin={0}
              aria-valuemax={maxLoan}
              aria-valuenow={usedQuota}
              aria-valuetext={`${usedQuota} dari ${maxLoan} buku terpakai`}
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  quotaFull ? 'bg-warning' : usedQuota > 0 ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          )}

          {quotaFull && !isLoading ? (
            <div
              role="status"
              className="mt-4 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning-soft p-3.5"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-warning">Batas peminjaman tercapai</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Anda sedang memegang {formatNumber(usedQuota)} dari {formatNumber(maxLoan)} buku.
                  Kembalikan buku yang sedang dipinjam atau batalkan pengajuan yang masih
                  menunggu, lalu Anda dapat mengajukan buku lagi. Ini bukan kendala pada sistem.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/perpustakaan/pinjaman">
                    Kelola pinjaman aktif
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* ---------- Announcements ---------- */}
        <MemberAnnouncements />

        {/* ---------- Level + leaderboard ---------- */}
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Level dan peringkat">
          <MyLevelCard />
          <LeaderboardCard limit={8} />
        </section>

        {/* ---------- Recent loans + quick actions ---------- */}
        <section className="grid gap-4 lg:grid-cols-3" aria-label="Pinjaman dan aksi cepat">
          <div className="panel overflow-hidden lg:col-span-2">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">
                  Pinjaman Terbaru
                </h2>
                <p className="text-xs text-muted-foreground">
                  Lima transaksi terakhir yang Anda ajukan
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/perpustakaan/pinjaman">Lihat semua</Link>
              </Button>
            </header>

            {loans.isError ? (
              <ErrorState
                title="Gagal memuat peminjaman"
                message={loans.error?.message}
                onRetry={() => void loans.refetch()}
              />
            ) : loans.isLoading ? (
              <div className="space-y-2 p-4" role="status" aria-label="Memuat peminjaman">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-12 shrink-0 rounded-md" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Belum ada peminjaman"
                description="Pilih judul dari katalog untuk mengajukan peminjaman pertama Anda."
                action={
                  <Button asChild size="sm">
                    <Link to="/perpustakaan/katalog">Buka katalog</Link>
                  </Button>
                }
              />
            ) : (
              <motion.ul
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="divide-y divide-border"
              >
                {recent.map((loan) => {
                  const overdue = loan.displayStatus === 'overdue';
                  return (
                    <motion.li
                      key={loan.id}
                      variants={rowVariants}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <MiniCover
                        title={loan.book.title}
                        author={loan.book.author}
                        src={loan.book.coverPath}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold text-foreground">
                          {loan.book.title}
                        </p>
                        <p className="truncate text-2xs text-muted-foreground">
                          {loan.loanCode} ·{' '}
                          {loan.dueAt ? (
                            <span className={cn(overdue && 'font-semibold text-destructive')}>
                              jatuh tempo {formatDate(loan.dueAt)} ({relativeDays(loan.dueAt)})
                            </span>
                          ) : (
                            'belum ada jatuh tempo'
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <LoanStatusBadge status={loan.displayStatus} />
                        {overdue && loan.daysLate !== null && loan.daysLate > 0 ? (
                          <Badge tone="danger">{formatNumber(loan.daysLate)} hari telat</Badge>
                        ) : null}
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>

          <div className="panel p-5">
            <p className="eyebrow">Aksi Cepat</p>
            <h2 className="font-display text-base font-semibold text-foreground">
              Mulai dalam satu langkah
            </h2>
            <ul className="mt-3 space-y-2.5">
              <li>
                <QuickAction
                  to="/perpustakaan/katalog"
                  title="Cari buku di katalog"
                  description="Telusuri koleksi dan ajukan peminjaman."
                  icon={BookMarked}
                />
              </li>
              <li>
                <QuickAction
                  to="/perpustakaan/pinjaman"
                  title="Kelola pinjaman aktif"
                  description="Batalkan pengajuan atau ajukan pengembalian."
                  icon={ClipboardList}
                />
              </li>
              <li>
                <QuickAction
                  to="/perpustakaan/riwayat"
                  title="Lihat riwayat"
                  description="Peminjaman yang sudah selesai, ditolak, atau dibatalkan."
                  icon={CalendarDays}
                />
              </li>
            </ul>
          </div>
        </section>

        {/* ---------- Categories ---------- */}
        <section className="panel p-5" aria-label="Jelajahi kategori">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Jelajahi</p>
              <h2 className="font-display text-base font-semibold text-foreground">
                Kategori koleksi
              </h2>
              <p className="text-xs text-muted-foreground">
                Pilih kategori untuk membuka katalog yang sudah terfilter.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/perpustakaan/katalog">
                Lihat katalog
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </header>

          {categories.isError ? (
            <div className="mt-4">
              <ErrorState
                title="Gagal memuat kategori"
                message={categories.error?.message}
                onRetry={() => void categories.refetch()}
                className="py-8"
              />
            </div>
          ) : categories.isLoading ? (
            <div className="mt-4 flex flex-wrap gap-2" role="status" aria-label="Memuat kategori">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-28 rounded-full" />
              ))}
            </div>
          ) : (categories.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Library}
              title="Belum ada kategori"
              description="Petugas perpustakaan belum menambahkan kategori koleksi."
              className="py-10"
            />
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {categories.data?.map((category) => (
                <li key={category.id}>
                  <Link
                    to={`/katalog?categoryId=${category.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-electric-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Library className="size-3" aria-hidden />
                    {category.name}
                    <span className="text-2xs text-muted-foreground">
                      {formatNumber(category.bookCount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Live announcements on the member home page.
 *
 * Only unexpired items are requested, and the section removes itself entirely
 * when there is nothing to say — an empty "Pengumuman" box every day trains
 * people to ignore the area where the important notice will one day appear.
 */
function MemberAnnouncements() {
  const announcements = useAnnouncements({ activeOnly: 'true', pageSize: 3 });
  const items = announcements.data?.items ?? [];

  if (announcements.isLoading || items.length === 0) return null;

  return (
    <section aria-label="Pengumuman perpustakaan" className="space-y-2">
      {items.map((a) => (
        <article
          key={a.id}
          className={cn(
            'panel flex items-start gap-3 p-4',
            a.pinned && 'border-primary/35 bg-electric-soft/40',
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-electric-soft text-primary">
            <Megaphone className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold">{a.title}</h2>
              {a.pinned ? <Badge tone="info">Penting</Badge> : null}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
            <p className="mt-1.5 text-2xs text-muted-foreground">
              {a.createdByName} · {formatDate(a.createdAt)}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function QuickAction({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3 transition-colors hover:border-primary/30 hover:bg-electric-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-soft text-secondary"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
          {title}
          <ArrowRight
            className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}
