import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  Hash,
  Library,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { BookCover } from '@/components/ui/book-cover';
import { Badge, StockBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/states';
import { useBook, useMyLoans, useMemberOverview, useApiMutation } from '@/hooks/useApi';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { EASE_OUT, springSoft, staggerContainer, staggerItem } from '@/lib/motion';

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bookId = Number(id);
  const { isAdmin } = useAuth();

  const { data: book, isLoading, isError, error, refetch } = useBook(Number.isFinite(bookId) ? bookId : null);
  const overview = useMemberOverview();
  const myLoans = useMyLoans({ pageSize: 50, sort: 'requested_at', direction: 'DESC' });

  const [requestOpen, setRequestOpen] = React.useState(false);
  const [note, setNote] = React.useState('');

  // Captured so the mutation closure does not depend on narrowing `book`.
  const currentBookId = book?.id ?? 0;

  const requestLoan = useApiMutation({
    mutationFn: async () => {
      const res = await api.post<{ id: number }>('/loans', {
        bookId: currentBookId,
        note: note || undefined,
      });
      return res.data;
    },
    successMessage: () => 'Permohonan peminjaman terkirim.',
    invalidate: [['/books'], ['/loans']],
    onSuccess: () => {
      setRequestOpen(false);
      setNote('');
    },
  });

  if (isLoading) {
    return (
      <PageBody>
        <CardSkeleton />
      </PageBody>
    );
  }

  if (isError || !book) {
    return (
      <PageBody>
        <div className="panel">
          <ErrorState
            title="Buku tidak ditemukan"
            message={error?.message}
            onRetry={() => void refetch()}
          />
        </div>
      </PageBody>
    );
  }

  const existing = myLoans.data?.items.find(
    (l) => l.bookId === book.id && ['pending', 'approved', 'borrowed', 'return_requested'].includes(l.status),
  );

  const quotaReached = (overview.data?.remainingQuota ?? 1) <= 0;
  const outOfStock = book.availableCopies === 0;
  const inactive = book.status !== 'active';

  // A single source of truth for the button state, so the UI never lies.
  let action: { label: string; disabled: boolean; hint: string; onClick?: () => void; tone?: 'primary' | 'outline' };

  if (inactive) {
    action = { label: 'Buku Nonaktif', disabled: true, hint: 'Buku ini sedang dinonaktifkan.', tone: 'outline' };
  } else if (existing) {
    action = {
      label: 'Sudah dalam Daftar Pinjaman',
      disabled: true,
      hint: `Status saat ini: ${existing.status.replace('_', ' ')}.`,
      tone: 'outline',
    };
  } else if (outOfStock) {
    action = { label: 'Stok Habis', disabled: true, hint: 'Semua eksemplar sedang dipinjam.', tone: 'outline' };
  } else if (quotaReached) {
    action = {
      label: 'Kuota Peminjaman Penuh',
      disabled: true,
      hint: `Anda sudah memiliki ${overview.data?.activeLoans} buku. Maksimal ${overview.data?.maxLoanPerUser}.`,
      tone: 'outline',
    };
  } else {
    action = {
      label: 'Ajukan Peminjaman',
      disabled: false,
      hint: `${book.availableCopies} eksemplar tersedia`,
      onClick: () => setRequestOpen(true),
    };
  }

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Katalog', to: '/katalog' },
          { label: book.title },
        ]}
        title={book.title}
        description={book.description ?? undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-3.5" aria-hidden />
            Kembali
          </Button>
        }
      />

      <PageBody>
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="show"
          className="grid gap-8 lg:grid-cols-[300px_1fr]"
        >
          {/* ---------- Cover ---------- */}
          <motion.div variants={staggerItem} className="space-y-4">
            <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={springSoft}>
              <BookCover
                title={book.title}
                author={book.author}
                src={book.coverPath}
                className="aspect-[3/4] w-full shadow-lift"
                rounded="rounded-xl"
              />
            </motion.div>

            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ketersediaan</span>
                <StockBadge available={book.availableCopies} total={book.totalCopies} />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      book.totalCopies > 0
                        ? (book.availableCopies / book.totalCopies) * 100
                        : 0
                    }%`,
                  }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-cyan"
                />
              </div>
              <p className="mt-2 text-2xs text-muted-foreground">
                {formatNumber(book.availableCopies)} dari {formatNumber(book.totalCopies)} eksemplar
                tersedia
              </p>
            </div>

            {isAdmin ? (
              <Button asChild variant="outline" className="w-full">
                <Link to="/admin/buku">Kelola buku ini</Link>
              </Button>
            ) : null}
          </motion.div>

          {/* ---------- Details + action ---------- */}
          <motion.div variants={staggerItem} className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {book.categoryName ? <Badge tone="violet">{book.categoryName}</Badge> : null}
                {book.status === 'inactive' ? <Badge tone="neutral">Nonaktif</Badge> : null}
                {outOfStock ? <Badge tone="danger">Tidak tersedia</Badge> : null}
              </div>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-balance">
                {book.title}
              </h1>
              <p className="text-base text-muted-foreground">{book.author}</p>
            </div>

            {/* Borrow panel */}
            {!isAdmin ? (
              <div className="panel p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.hint}</p>
                    {overview.data ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Kuota Anda: {overview.data.activeLoans}/{overview.data.maxLoanPerUser} buku
                        · Masa pinjam {overview.data.requireApproval ? 'menunggu persetujuan' : 'langsung aktif'}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="lg"
                    variant={action.tone ?? 'primary'}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className="shrink-0"
                  >
                    <BookOpen className="size-4" aria-hidden />
                    {action.label}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Metadata */}
            <dl className="panel divide-y divide-border overflow-hidden">
              <MetaRow icon={Hash} label="ISBN" value={<span className="font-mono">{book.isbn}</span>} />
              <MetaRow icon={Building2} label="Penerbit" value={book.publisher ?? '-'} />
              <MetaRow
                icon={CalendarDays}
                label="Tahun Terbit"
                value={book.publishYear ? formatDate(`${book.publishYear}-01-01`) : '-'}
              />
              <MetaRow icon={MapPin} label="Lokasi Rak" value={book.shelfLocation ?? '-'} />
              <MetaRow
                icon={Library}
                label="Kategori"
                value={book.categoryName ?? 'Tidak terkategori'}
              />
            </dl>

            {/* Availability breakdown */}
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Total Eksemplar" value={book.totalCopies} tone="neutral" />
              <MiniStat label="Tersedia" value={book.availableCopies} tone="success" />
              <MiniStat label="Dipinjam" value={book.borrowedCopies} tone="violet" />
            </div>

            {/* My loans for this title */}
            {myLoans.data && myLoans.data.items.filter((l) => l.bookId === book.id).length > 0 ? (
              <div className="panel p-5">
                <h2 className="mb-3 font-display text-base font-semibold">Riwayat Peminjaman Anda</h2>
                <ul className="space-y-2">
                  {myLoans.data.items
                    .filter((l) => l.bookId === book.id)
                    .slice(0, 5)
                    .map((loan) => (
                      <li key={loan.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {loan.loanCode}
                        </span>
                        <span className="shrink-0 text-2xs text-muted-foreground">
                          {formatDate(loan.requestedAt)}
                        </span>
                        <Badge tone="neutral">{loan.status.replace('_', ' ')}</Badge>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      </PageBody>

      {/* ---------- Request dialog ---------- */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent
          title="Ajukan peminjaman"
          description={`"${book.title}" oleh ${book.author}`}
          footer={
            <>
              <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={requestLoan.isPending}>
                Batal
              </Button>
              <Button onClick={() => requestLoan.mutate()} loading={requestLoan.isPending}>
                Kirim permohonan
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <BookCover
                title={book.title}
                author={book.author}
                src={book.coverPath}
                className="h-20 w-14 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{book.title}</p>
                <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                <p className="mt-1.5 text-2xs text-muted-foreground">
                  {book.availableCopies} eksemplar tersedia
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="loan-note" className="text-sm font-medium">
                Catatan untuk petugas <span className="text-muted-foreground">(opsional)</span>
              </label>
              <Textarea
                id="loan-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={255}
                placeholder="Contoh: untuk tugas kelompok."
                rows={3}
              />
              <p className="text-2xs text-muted-foreground">{note.length}/255</p>
            </div>

            {overview.data ? (
              <p className="flex items-start gap-2 rounded-lg bg-electric-soft px-3 py-2.5 text-xs text-primary">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {overview.data.requireApproval
                  ? 'Permohonan akan ditinjau petugas sebelum buku dapat diambil.'
                  : 'Buku langsung aktif setelah pengajuan dan dapat diambil di loket.'}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <dt className="w-32 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'violet';
}) {
  const color =
    tone === 'success' ? 'text-success' : tone === 'violet' ? 'text-secondary' : 'text-foreground';
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{formatNumber(value)}</p>
    </div>
  );
}
