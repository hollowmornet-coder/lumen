import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Info,
  Library,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import { Badge, ReservationStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmContent, ConfirmDialog, ConfirmTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useApiMutation, useMyReservations } from '@/hooks/useApi';
import { cn, formatDate, formatNumber, relativeDays } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Reservation } from '@/types';

const INVALIDATE = [
  ['my-reservations'],
  ['reservations'],
  ['dashboard'],
  ['books'],
] as const;

export default function MyReservationsPage() {
  const reservations = useMyReservations();

  const cancel = useApiMutation<number, Reservation>({
    mutationFn: async (id) => (await api.post<Reservation>(`/reservations/${id}/cancel`)).data,
    successMessage: 'Antrean dibatalkan.',
    invalidate: INVALIDATE,
  });

  const items = reservations.data ?? [];
  const active = items.filter((r) => r.status === 'waiting' || r.status === 'ready');
  const past = items.filter((r) => r.status !== 'waiting' && r.status !== 'ready');
  const readyCount = active.filter((r) => r.status === 'ready').length;

  return (
    <>
      <PageHeader
        eyebrow="Sirkulasi"
        title="Antrean Saya"
        description="Buku yang Anda pesan saat stok sedang habis. Ketika satu eksemplar kembali ke rak, orang pertama dalam antrean mendapat kabar dan jatah waktu untuk mengambilnya."
        breadcrumb={[
          { label: 'Beranda', to: '/perpustakaan' },
          { label: 'Antrean Saya' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reservations.refetch()}
              loading={reservations.isFetching && !reservations.isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Perbarui
            </Button>
            <Button size="sm" asChild>
              <Link to="/katalog">
                <BookOpen className="size-3.5" aria-hidden />
                Cari Buku
              </Link>
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {reservations.isLoading
              ? 'Memuat antrean...'
              : readyCount > 0
                ? `${formatNumber(readyCount)} buku siap diambil`
                : `${formatNumber(active.length)} antrean aktif`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {reservations.isError ? (
          <div className="panel">
            <ErrorState
              title="Gagal memuat antrean"
              message={reservations.error?.message}
              onRetry={() => void reservations.refetch()}
            />
          </div>
        ) : reservations.isLoading ? (
          <div className="panel space-y-3 p-4" role="status" aria-label="Memuat antrean">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 rounded-lg border border-border p-4">
                <Skeleton className="h-14 w-10 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Library}
              title="Belum ada antrean"
              description="Saat sebuah buku sedang habis, Anda dapat memesan tempat dalam antrean dari halaman detail buku."
              action={
                <Button asChild size="sm">
                  <Link to="/katalog">
                    Buka katalog
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {active.length > 0 ? (
              <section className="panel overflow-hidden" aria-label="Antrean aktif">
                <header className="border-b border-border px-5 py-3">
                  <h2 className="font-display text-sm font-semibold">Antrean aktif</h2>
                  <p className="text-xs text-muted-foreground">
                    Posisi 1 berarti Anda yang berikutnya dilayani.
                  </p>
                </header>
                <motion.ul
                  variants={staggerContainer(0.04)}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-border"
                >
                  {active.map((r) => (
                    <motion.li key={r.id} variants={staggerItem}>
                      <ReservationRow
                        reservation={r}
                        onCancel={() => cancel.mutateAsync(r.id)}
                        cancelling={cancel.isPending}
                      />
                    </motion.li>
                  ))}
                </motion.ul>
              </section>
            ) : null}

            {past.length > 0 ? (
              <section className="panel overflow-hidden" aria-label="Riwayat antrean">
                <header className="border-b border-border px-5 py-3">
                  <h2 className="font-display text-sm font-semibold">Riwayat antrean</h2>
                  <p className="text-xs text-muted-foreground">
                    Antrean yang sudah terpenuhi, dibatalkan, atau kedaluwarsa.
                  </p>
                </header>
                <ul className="divide-y divide-border">
                  {past.map((r) => (
                    <li key={r.id}>
                      <ReservationRow reservation={r} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <p className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Bila buku pesanan tidak diambil sampai batas waktu, antrean dilepas otomatis dan
            kesempatan berpindah ke anggota berikutnya. Anda tetap dapat memesan ulang.
          </span>
        </p>
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ReservationRow({
  reservation,
  onCancel,
  cancelling,
}: {
  reservation: Reservation;
  onCancel?: () => Promise<unknown>;
  cancelling?: boolean;
}) {
  const isReady = reservation.status === 'ready';
  const isWaiting = reservation.status === 'waiting';
  const canCancel = isReady || isWaiting;

  return (
    <article
      className={cn(
        'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start',
        isReady && 'bg-success-soft/30',
      )}
    >
      <MiniCover
        title={reservation.book.title}
        author={reservation.book.author}
        src={reservation.book.coverPath}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ReservationStatusBadge status={reservation.status} />
          {isWaiting && reservation.queuePosition ? (
            <Badge tone="info">Posisi {formatNumber(reservation.queuePosition)}</Badge>
          ) : null}
          {reservation.book.availableCopies > 0 && !isReady ? (
            <Badge tone="success">
              {formatNumber(reservation.book.availableCopies)} eksemplar tersedia
            </Badge>
          ) : null}
        </div>

        <h3 className="mt-1.5 font-display text-sm font-semibold text-foreground">
          {reservation.book.title}
        </h3>
        <p className="text-xs text-muted-foreground">{reservation.book.author}</p>

        <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-2xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarClock className="size-3" aria-hidden />
            <dt className="sr-only">Tanggal mengantre</dt>
            <dd>Dipesan {formatDate(reservation.createdAt)}</dd>
          </div>
          {reservation.expiresAt ? (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Batas pengambilan</dt>
              <dd
                className={cn(
                  relativeDays(reservation.expiresAt).startsWith('terlambat') &&
                    'font-semibold text-destructive',
                )}
              >
                Ambil sebelum {formatDate(reservation.expiresAt)} (
                {relativeDays(reservation.expiresAt)})
              </dd>
            </div>
          ) : null}
        </dl>

        {isReady ? (
          <p className="mt-2.5 rounded-lg border border-success/25 bg-success-soft px-3 py-2 text-xs text-success">
            Buku sudah disisihkan untuk Anda. Datang ke meja perpustakaan sebelum batas waktu.
          </p>
        ) : null}

        {reservation.note ? (
          <p className="mt-1.5 text-2xs italic text-muted-foreground">Catatan: {reservation.note}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/katalog/${reservation.bookId}`}>Lihat buku</Link>
        </Button>

        {canCancel && onCancel ? (
          <ConfirmDialog>
            <ConfirmTrigger asChild>
              <Button size="sm" variant="ghost" disabled={cancelling}>
                <Trash2 className="size-3.5" aria-hidden />
                Batalkan
              </Button>
            </ConfirmTrigger>
            <ConfirmContent
              title="Batalkan antrean?"
              tone="danger"
              confirmLabel="Ya, batalkan"
              cancelLabel="Kembali"
              onConfirm={async () => {
                try {
                  await onCancel();
                } catch {
                  // The toast already carries the server message.
                }
              }}
              description={
                <>
                  Antrean untuk <strong>{reservation.book.title}</strong> akan dihapus. Posisi Anda
                  diberikan kepada anggota berikutnya.
                </>
              }
            >
              <p className="text-xs text-muted-foreground">
                Dipesan {formatDate(reservation.createdAt)}
              </p>
            </ConfirmContent>
          </ConfirmDialog>
        ) : null}
      </div>
    </article>
  );
}
