import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Info,
  ScanLine,
  Search,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import { Badge, StockBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { QrCode } from '@/components/ui/qr-code';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import {
  useApiMutation,
  useBooks,
  useDebounced,
  useMembers,
  useScanLookup,
  useSettings,
} from '@/hooks/useApi';
import { cn, formatDate, formatNumber, formatRupiah, toInputDate } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import type { Book, Loan, Member } from '@/types';

const INVALIDATE = [
  ['loans'],
  ['my-loans'],
  ['books'],
  ['dashboard'],
  ['members'],
  ['activity'],
] as const;

/** Turns a raw setting string into a number with a safe fallback. */
function settingNumber(items: Array<{ key: string; value: string }> | undefined, key: string, fallback: number) {
  const raw = items?.find((i) => i.key === key)?.value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AdminCirculationPage() {
  const settings = useSettings();
  const defaultDays = settingNumber(settings.data, 'loan_duration_days', 7);

  const [memberTerm, setMemberTerm] = React.useState('');
  const [bookTerm, setBookTerm] = React.useState('');
  const debouncedMember = useDebounced(memberTerm, 300);
  const debouncedBook = useDebounced(bookTerm, 300);

  const [member, setMember] = React.useState<Member | null>(null);
  const [book, setBook] = React.useState<Book | null>(null);
  const [note, setNote] = React.useState('');
  const [issued, setIssued] = React.useState<Loan | null>(null);

  // Scanner buffer. A keyboard-wedge scanner "types" the code and presses
  // Enter, so the field is a normal input that submits on Enter. It stays
  // focused between scans, which is what makes repeated scanning bearable.
  const [scanCode, setScanCode] = React.useState('');
  const [scanError, setScanError] = React.useState<string | null>(null);
  // A resolved loan slip is information, not a failure — it gets its own state
  // so it is not styled as an error the officer must fix.
  const [scanNotice, setScanNotice] = React.useState<string | null>(null);
  const scanInputRef = React.useRef<HTMLInputElement | null>(null);
  const scan = useScanLookup();

  // The day count follows the setting until the officer edits it by hand.
  // Modelled as an override rather than an effect: an effect that copies the
  // setting into state would fight the officer on every background refetch.
  const [daysOverride, setDaysOverride] = React.useState<string | null>(null);
  const days = daysOverride ?? String(defaultDays);

  const members = useMembers(
    { search: debouncedMember || undefined, status: 'active', pageSize: 6 },
    { enabled: !member },
  );

  const books = useBooks(
    { search: debouncedBook || undefined, status: 'active', pageSize: 6 },
    { enabled: !book },
  );

  const issue = useApiMutation<
    { userId: number; bookId: number; days?: number; note?: string },
    Loan
  >({
    mutationFn: async (payload) => (await api.post<Loan>('/loans/counter', payload)).data,
    successMessage: (loan) => `Buku dipinjamkan. Jatuh tempo ${formatDate(loan.dueAt)}.`,
    invalidate: INVALIDATE,
    onSuccess: (loan) => {
      setIssued(loan);
      setBook(null);
      setBookTerm('');
      setNote('');
    },
  });

  const reset = () => {
    setMember(null);
    setBook(null);
    setMemberTerm('');
    setBookTerm('');
    setNote('');
    setIssued(null);
    setDaysOverride(null);
    setScanCode('');
    setScanError(null);
    setScanNotice(null);
  };

  /**
   * Handles one scan.
   *
   * The resolve endpoint returns a *summary* (enough to know what was scanned);
   * the full record is then fetched so the desk shows the same card it would
   * show after a manual search. Two round trips, but only on scan, and it keeps
   * a single source of truth for what a "member card" displays.
   */
  const handleScan = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = scanCode.trim();
    if (!code || scan.isPending) return;

    setScanError(null);
    setScanNotice(null);

    try {
      const target = await scan.mutateAsync(code);

      if (target.kind === 'member') {
        const full = (await api.get<Member>(`/members/${target.id}`)).data;
        setMember(full);
        setMemberTerm('');
      } else if (target.kind === 'book') {
        const full = (await api.get<Book>(`/books/${target.id}`)).data;
        setBook(full);
        setBookTerm('');
      } else {
        // A loan slip is a receipt, not an input: point the officer at the
        // transaction instead of pretending it can be lent again.
        setScanNotice(
          `Nota ${target.loanCode} — ${target.memberName}, ${target.bookTitle}. Buka menu Transaksi untuk menanganinya.`,
        );
      }

      setScanCode('');
      // Keep the cursor in the field so the next scan lands without a click.
      scanInputRef.current?.focus();
    } catch (err) {
      setScanCode('');
      setScanError(err instanceof Error ? err.message : 'Kode tidak dikenali.');
      scanInputRef.current?.focus();
    }
  };

  const memberLimit = settingNumber(settings.data, 'max_loan_per_user', 3);
  const quotaUsed = member?.activeLoans ?? 0;
  const quotaFull = Boolean(member) && quotaUsed >= memberLimit;
  const canIssue = Boolean(member && book) && !quotaFull && !issue.isPending;
  const dayCount = Math.max(1, Number.parseInt(days, 10) || defaultDays);

  // Preview only. The server stamps the real due date, so a stale clock here
  // can never corrupt data - it just shows the officer what to expect.
  // `today` is captured once per mount so the preview cannot shift mid-form.
  const [today] = React.useState(() => Date.now());
  const duePreview = React.useMemo(
    () => toInputDate(new Date(today + dayCount * 86_400_000)),
    [today, dayCount],
  );

  return (
    <>
      <PageHeader
        eyebrow="Sirkulasi"
        title="Meja Sirkulasi"
        description="Layani peminjaman langsung di loket: pilih anggota, pilih buku, lalu serahkan. Stok berkurang saat itu juga dan jatuh tempo dihitung otomatis."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Meja Sirkulasi' },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/transaksi">
              Daftar transaksi
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        }
        meta={
          <p className="text-xs text-muted-foreground">
            Masa pinjam bawaan {formatNumber(defaultDays)} hari · kuota{' '}
            {formatNumber(memberLimit)} buku per anggota
          </p>
        }
      />

      <PageBody className="space-y-4">
        {issued ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
            role="status"
            className="panel flex flex-col gap-4 border-success/30 bg-success-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Peminjaman tercatat untuk {issued.member.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {issued.book.title} · jatuh tempo {formatDate(issued.dueAt)} ·{' '}
                  <span className="font-mono">{issued.loanCode}</span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Slip QR: the officer can scan this later to pull the
                  transaction back up without typing the code. */}
              <QrCode
                value={issued.loanCode}
                size={64}
                label={`Kode transaksi ${issued.loanCode}`}
              />
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => setIssued(null)}>
                  Pinjamkan lagi
                </Button>
                <Button size="sm" asChild>
                  <Link to={`/katalog/${issued.bookId}`}>Lihat buku</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---------- Scanner ---------- */}
          <section
            className="panel p-5 lg:col-span-2"
            aria-labelledby="scan-desk"
          >
            <header className="mb-3 flex items-start gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ScanLine className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="scan-desk" className="font-display text-base font-semibold">
                  Pindai kartu atau barcode
                </h2>
                <p className="text-xs text-muted-foreground">
                  Arahkan pemindai ke kartu anggota (kode <span className="font-mono">MBR-…</span>)
                  atau barcode ISBN buku, lalu tekan Enter. Kolom tetap siap untuk pindaian
                  berikutnya.
                </p>
              </div>
            </header>

            <form onSubmit={handleScan} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <ScanLine
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  ref={scanInputRef}
                  id="scan-code"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  placeholder="Scan di sini…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Kode hasil pindai"
                  aria-describedby={scanError ? 'scan-error' : undefined}
                  aria-invalid={Boolean(scanError)}
                  className="pl-9 font-mono"
                />
              </div>
              <Button type="submit" loading={scan.isPending} disabled={!scanCode.trim()}>
                Cari kode
              </Button>
            </form>

            {scanError ? (
              <p
                id="scan-error"
                role="alert"
                className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2 text-xs text-destructive"
              >
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {scanError}
              </p>
            ) : null}

            {scanNotice ? (
              <p
                role="status"
                className="mt-2 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground"
              >
                <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                {scanNotice}
              </p>
            ) : null}

            <p className="mt-2 text-2xs text-muted-foreground">
              Kode yang dikenali langsung mengisi langkah 1 (anggota) atau langkah 2 (buku) di
              bawah. Bila pemindai tidak ada, ketik kodenya dan tekan Enter.
            </p>
          </section>

          {/* ---------- Step 1: member ---------- */}
          <section className="panel p-5" aria-labelledby="pick-member">
            <header className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-electric-soft text-xs font-semibold text-primary">
                1
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="pick-member" className="font-display text-base font-semibold">
                  Pilih anggota
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cari berdasarkan nama, username, atau kode anggota
                </p>
              </div>
              {member ? (
                <Button variant="ghost" size="sm" onClick={() => setMember(null)}>
                  Ganti
                </Button>
              ) : null}
            </header>

            {member ? (
              <div className="rounded-xl border border-primary/25 bg-electric-soft/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-foreground">
                      {member.fullName}
                    </p>
                    <p className="truncate font-mono text-2xs text-muted-foreground">
                      {member.memberCode ?? member.username}
                      {member.className ? ` · ${member.className}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={quotaFull ? 'danger' : 'info'}>
                        {formatNumber(quotaUsed)}/{formatNumber(memberLimit)} buku dipinjam
                      </Badge>
                      {member.status !== 'active' ? (
                        <Badge tone="danger">Akun nonaktif</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                {quotaFull ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Kuota peminjaman anggota ini sudah penuh. Minta salah satu buku dikembalikan
                    terlebih dahulu.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Cari anggota" htmlFor="member-search">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="member-search"
                      type="search"
                      value={memberTerm}
                      onChange={(e) => setMemberTerm(e.target.value)}
                      placeholder="Nama, username, atau kode anggota..."
                      className="pl-9"
                    />
                  </div>
                </Field>

                {members.isLoading ? (
                  <div className="space-y-2" role="status" aria-label="Memuat anggota">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-lg skeleton" />
                    ))}
                  </div>
                ) : members.isError ? (
                  <ErrorState
                    title="Gagal memuat anggota"
                    message={members.error?.message}
                    onRetry={() => void members.refetch()}
                  />
                ) : (members.data?.items.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={UserRound}
                    title="Anggota tidak ditemukan"
                    description="Periksa ejaan nama atau gunakan kode anggota."
                    className="py-8"
                  />
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {members.data?.items.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setMember(m)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground">
                            {m.fullName.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {m.fullName}
                            </span>
                            <span className="block truncate font-mono text-2xs text-muted-foreground">
                              {m.memberCode ?? m.username}
                            </span>
                          </span>
                          <Badge tone={m.activeLoans > 0 ? 'info' : 'neutral'}>
                            {formatNumber(m.activeLoans)} dipinjam
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* ---------- Step 2: book ---------- */}
          <section className="panel p-5" aria-labelledby="pick-book">
            <header className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-violet-soft text-xs font-semibold text-secondary">
                2
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="pick-book" className="font-display text-base font-semibold">
                  Pilih buku
                </h2>
                <p className="text-xs text-muted-foreground">Hanya buku dengan stok tersedia</p>
              </div>
              {book ? (
                <Button variant="ghost" size="sm" onClick={() => setBook(null)}>
                  Ganti
                </Button>
              ) : null}
            </header>

            {book ? (
              <div className="rounded-xl border border-secondary/25 bg-violet-soft/40 p-4">
                <div className="flex items-start gap-3">
                  <MiniCover title={book.title} author={book.author} src={book.coverPath} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-foreground">
                      {book.title}
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">{book.author}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StockBadge available={book.availableCopies} total={book.totalCopies} />
                      <Badge tone="neutral">
                        <CalendarClock className="size-3" aria-hidden />
                        {formatNumber(dayCount)} hari
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Cari buku" htmlFor="book-search">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="book-search"
                      type="search"
                      value={bookTerm}
                      onChange={(e) => setBookTerm(e.target.value)}
                      placeholder="Judul, penulis, atau ISBN..."
                      className="pl-9"
                    />
                  </div>
                </Field>

                {books.isLoading ? (
                  <div className="space-y-2" role="status" aria-label="Memuat buku">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-lg skeleton" />
                    ))}
                  </div>
                ) : books.isError ? (
                  <ErrorState
                    title="Gagal memuat buku"
                    message={books.error?.message}
                    onRetry={() => void books.refetch()}
                  />
                ) : (books.data?.items.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="Buku tidak ditemukan"
                    description="Coba kata kunci lain, atau periksa apakah buku masih berstatus aktif."
                    className="py-8"
                  />
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {books.data?.items.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          disabled={b.availableCopies === 0}
                          onClick={() => setBook(b)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                            b.availableCopies === 0
                              ? 'cursor-not-allowed opacity-55'
                              : 'hover:bg-muted/60',
                          )}
                        >
                          <MiniCover title={b.title} author={b.author} src={b.coverPath} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {b.title}
                            </span>
                            <span className="block truncate text-2xs text-muted-foreground">
                              {b.author}
                            </span>
                          </span>
                          <StockBadge available={b.availableCopies} total={b.totalCopies} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ---------- Step 3: confirm ---------- */}
        <section className="panel p-5" aria-labelledby="confirm-issue">
          <header className="mb-4 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-success-soft text-xs font-semibold text-success">
              3
            </span>
            <div>
              <h2 id="confirm-issue" className="font-display text-base font-semibold">
                Serahkan buku
              </h2>
              <p className="text-xs text-muted-foreground">
                Jatuh tempo dihitung sejak hari ini, bukan sejak pengajuan
              </p>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-end">
            <Field
              label="Masa pinjam"
              htmlFor="loan-days"
              hint={`Bawaan ${formatNumber(defaultDays)} hari.`}
            >
              <div className="relative">
                <Input
                  id="loan-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={days}
                  onChange={(e) => setDaysOverride(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  hari
                </span>
              </div>
            </Field>

            <Field
              label="Catatan petugas"
              htmlFor="loan-note"
              hint="Opsional, tersimpan pada transaksi."
            >
              <Textarea
                id="loan-note"
                rows={2}
                maxLength={255}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: peminjaman untuk lomba karya ilmiah."
              />
            </Field>

            <Button
              size="lg"
              disabled={!canIssue}
              loading={issue.isPending}
              onClick={() => {
                if (!member || !book) return;
                void issue.mutateAsync({
                  userId: member.id,
                  bookId: book.id,
                  days: dayCount,
                  note: note.trim() || undefined,
                });
              }}
              className="md:mb-6"
            >
              <ScanLine className="size-4" aria-hidden />
              Pinjamkan Sekarang
            </Button>
          </div>

          {!member || !book ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {!member && !book
                ? 'Pilih anggota dan buku terlebih dahulu.'
                : !member
                  ? 'Anggota belum dipilih.'
                  : 'Buku belum dipilih.'}
            </p>
          ) : null}

          {member && book ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
              <p className="eyebrow mb-2">Ringkasan serah terima</p>
              <dl className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="inline">Anggota</dt>
                  <dd className="inline font-semibold text-foreground sm:mt-0.5 sm:block">
                    {member.fullName}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="inline">Buku</dt>
                  <dd className="inline font-semibold text-foreground sm:mt-0.5 sm:block">
                    {book.title}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="inline">Jatuh tempo</dt>
                  <dd className="inline font-semibold text-foreground sm:mt-0.5 sm:block">
                    {formatDate(duePreview)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="inline">Denda keterlambatan</dt>
                  <dd className="inline font-semibold text-foreground sm:mt-0.5 sm:block">
                    {formatRupiah(
                      settingNumber(settings.data, 'late_fee_per_day', 1000),
                    )}{' '}
                    / hari
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <button type="button" className="sr-only" onClick={reset}>
            Atur ulang formulir
          </button>
        </section>
      </PageBody>
    </>
  );
}
