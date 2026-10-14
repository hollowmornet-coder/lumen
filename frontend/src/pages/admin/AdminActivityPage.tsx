import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  Activity as ActivityIcon,
  BookOpen,
  Download,
  FileDown,
  KeyRound,
  LogIn,
  LogOut,
  PencilLine,
  RefreshCw,
  ScrollText,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { useActivity, useDebounced, useListParams } from '@/hooks/useApi';
import { cn, formatDateTime, formatNumber, initials } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

type Tone = NonNullable<BadgeProps['tone']>;

interface ActionMeta {
  /** Human-readable Indonesian label. */
  label: string;
  /** Badge tone, chosen by intent - never decoration. */
  tone: Tone;
  icon: LucideIcon;
}

/**
 * Every audit action the backend can write (see activity.service.ts).
 * A new server action without an entry here still renders, it simply falls
 * back to the raw action code with a neutral badge.
 */
const ACTIONS = {
  'auth.login': { label: 'Masuk ke sistem', tone: 'info', icon: LogIn },
  'auth.login_failed': { label: 'Gagal masuk', tone: 'danger', icon: ShieldAlert },
  'auth.logout': { label: 'Keluar dari sistem', tone: 'neutral', icon: LogOut },
  'auth.register': { label: 'Pendaftaran akun', tone: 'cyan', icon: UserPlus },
  'profile.update': { label: 'Perbarui profil', tone: 'neutral', icon: UserCog },
  'password.change': { label: 'Ganti kata sandi', tone: 'warning', icon: KeyRound },
  'book.create': { label: 'Tambah buku', tone: 'success', icon: BookOpen },
  'book.update': { label: 'Ubah data buku', tone: 'info', icon: PencilLine },
  'book.delete': { label: 'Hapus buku', tone: 'danger', icon: Trash2 },
  'book.status': { label: 'Ubah status buku', tone: 'violet', icon: BookOpen },
  'book.import': { label: 'Impor buku', tone: 'violet', icon: Upload },
  'member.create': { label: 'Tambah anggota', tone: 'success', icon: UserPlus },
  'member.update': { label: 'Ubah data anggota', tone: 'info', icon: UserCog },
  'member.status': { label: 'Ubah status anggota', tone: 'violet', icon: Users },
  'member.delete': { label: 'Hapus anggota', tone: 'danger', icon: Trash2 },
  'loan.request': { label: 'Pengajuan peminjaman', tone: 'info', icon: BookOpen },
  'loan.approve': { label: 'Persetujuan peminjaman', tone: 'success', icon: LogIn },
  'loan.reject': { label: 'Penolakan peminjaman', tone: 'danger', icon: X },
  'loan.cancel': { label: 'Pembatalan peminjaman', tone: 'neutral', icon: X },
  'loan.return_request': { label: 'Permintaan pengembalian', tone: 'violet', icon: BookOpen },
  'loan.return_confirm': { label: 'Penerimaan pengembalian', tone: 'success', icon: Download },
  'settings.update': { label: 'Perubahan pengaturan', tone: 'warning', icon: Settings2 },
  'data.export': { label: 'Ekspor data', tone: 'cyan', icon: FileDown },
} as const satisfies Record<string, ActionMeta>;

type ActionKey = keyof typeof ACTIONS;

const ACTION_GROUPS: ReadonlyArray<{ label: string; actions: readonly ActionKey[] }> = [
  {
    label: 'Autentikasi dan akun',
    actions: [
      'auth.login',
      'auth.login_failed',
      'auth.logout',
      'auth.register',
      'profile.update',
      'password.change',
    ],
  },
  {
    label: 'Katalog buku',
    actions: ['book.create', 'book.update', 'book.delete', 'book.status', 'book.import'],
  },
  {
    label: 'Anggota',
    actions: ['member.create', 'member.update', 'member.status', 'member.delete'],
  },
  {
    label: 'Peminjaman',
    actions: [
      'loan.request',
      'loan.approve',
      'loan.reject',
      'loan.cancel',
      'loan.return_request',
      'loan.return_confirm',
    ],
  },
  { label: 'Sistem', actions: ['settings.update', 'data.export'] },
];

const FALLBACK: ActionMeta = { label: 'Aktivitas lain', tone: 'neutral', icon: ScrollText };

function metaOf(action: string): ActionMeta | null {
  return (ACTIONS as Record<string, ActionMeta | undefined>)[action] ?? null;
}

/** Falls back to the raw action code so unknown server actions stay readable. */
function labelOf(action: string): string {
  return metaOf(action)?.label ?? action;
}

export default function AdminActivityPage() {
  const defaults = React.useMemo(() => ({}), []);
  const { params, get, set, setMany, reset } = useListParams(defaults);

  const [term, setTerm] = React.useState(() => get('search'));
  const debouncedTerm = useDebounced(term, 350);

  const action = get('action');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '15')) || 15;

  // Mirror the debounced box into the address bar, but only when it differs,
  // so the effect can never fight itself into a loop.
  React.useEffect(() => {
    if ((params.get('search') ?? '') === debouncedTerm) return;
    setMany({ search: debouncedTerm || undefined, page: undefined });
  }, [debouncedTerm, params, setMany]);

  const query = React.useMemo(
    () => ({
      search: debouncedTerm || undefined,
      action: action || undefined,
      page,
      pageSize,
    }),
    [debouncedTerm, action, page, pageSize],
  );

  const activity = useActivity(query);

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.03);
  const itemVariants = reduce ? STILL : staggerItem;

  const items = activity.data?.items ?? [];
  const meta = activity.data?.meta;
  const hasFilters = Boolean(debouncedTerm) || Boolean(action);

  const clearFilters = () => {
    setTerm('');
    reset();
  };

  const activeActionLabel = action ? labelOf(action) : '';

  return (
    <>
      <PageHeader
        eyebrow="Jejak Audit"
        title="Log Aktivitas"
        description="Catatan perubahan yang dilakukan pada sistem: siapa, kapan, dan tindakan apa yang dijalankan. Tidak dapat disunting dari antarmuka ini."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Log aktivitas' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void activity.refetch()}
            loading={activity.isFetching && !activity.isLoading}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Perbarui
          </Button>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {activity.isLoading
              ? 'Memuat log...'
              : `${formatNumber(meta?.total ?? 0)} catatan aktivitas tersimpan`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Filter bar ---------- */}
        <div className="panel p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
            <Field label="Cari aktivitas" htmlFor="activity-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="activity-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Cari nama pelaku atau deskripsi..."
                  className="pl-9"
                />
                {term ? (
                  <button
                    type="button"
                    onClick={() => setTerm('')}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </Field>

            <Field label="Jenis aktivitas" htmlFor="activity-action">
              <Select
                id="activity-action"
                value={action}
                onChange={(e) => setMany({ action: e.target.value || undefined, page: undefined })}
              >
                <option value="">Semua jenis</option>
                {ACTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.actions.map((key) => (
                      <option key={key} value={key}>
                        {ACTIONS[key].label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Filter aktif
              </span>
              {debouncedTerm ? <Badge tone="info">Kata kunci: {debouncedTerm}</Badge> : null}
              {action ? <Badge tone="violet">{labelOf(action)}</Badge> : null}
              <button
                type="button"
                onClick={clearFilters}
                className="rounded text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Atur ulang semua
              </button>
            </div>
          ) : null}
        </div>

        {/* ---------- Timeline ---------- */}
        <section className="panel overflow-hidden" aria-label="Daftar log aktivitas">
          {activity.isFetching && !activity.isLoading ? (
            <div className="h-0.5 overflow-hidden bg-border" aria-hidden>
              <div className="h-full w-1/3 animate-shimmer bg-primary" />
            </div>
          ) : null}

          {activity.isError ? (
            <ErrorState
              title="Gagal memuat log aktivitas"
              message={activity.error?.message}
              onRetry={() => void activity.refetch()}
            />
          ) : activity.isLoading ? (
            <ul className="divide-y divide-border" role="status" aria-label="Memuat data">
              {Array.from({ length: 7 }).map((_, i) => (
                <li key={i} className="flex items-start gap-4 px-5 py-4">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-52" />
                    <Skeleton className="h-3 w-full max-w-lg" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            hasFilters ? (
              <NoResultsState
                onReset={clearFilters}
                description="Tidak ada aktivitas yang cocok dengan jenis atau kata kunci pencarian."
              />
            ) : (
              <EmptyState
                icon={ScrollText}
                title="Log masih kosong"
                description="Setiap tindakan pada modul buku, anggota, dan peminjaman akan tercatat di sini secara otomatis."
              />
            )
          ) : (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-foreground">
                    Riwayat Aktivitas
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {activeActionLabel
                      ? `Menampilkan catatan untuk: ${activeActionLabel}`
                      : 'Semua jenis aktivitas, terbaru lebih dahulu'}
                  </p>
                </div>
                <ActivityIcon className="size-4 text-muted-foreground" aria-hidden />
              </header>

              <motion.ol
                key={`${action}-${page}-${pageSize}-${debouncedTerm}`}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="divide-y divide-border"
              >
                {items.map((item, index) => (
                  <TimelineRow
                    key={item.id}
                    action={item.action}
                    actorName={item.actorName}
                    description={item.description}
                    createdAt={item.createdAt}
                    entityType={item.entityType}
                    entityId={item.entityId}
                    isLast={index === items.length - 1}
                    variants={itemVariants}
                  />
                ))}
              </motion.ol>
            </>
          )}

          {meta && items.length > 0 ? (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={meta.pageSize}
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

/* ------------------------------------------------------------------ */

function TimelineRow({
  action,
  actorName,
  description,
  createdAt,
  entityType,
  entityId,
  isLast,
  variants,
}: {
  action: string;
  actorName: string;
  description: string | null;
  createdAt: string;
  entityType: string | null;
  entityId: number | null;
  isLast: boolean;
  variants: Variants;
}) {
  const meta = metaOf(action) ?? FALLBACK;
  const Icon = meta.icon;

  return (
    <motion.li variants={variants} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
      {/* Rail + node: the rail only fills the space below the node. */}
      <div className="flex w-8 shrink-0 flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </span>
        {!isLast ? (
          <span className={cn('mt-1 w-px flex-1 bg-border')} aria-hidden />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <code className="font-mono text-2xs text-muted-foreground">{action}</code>
        </div>

        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          <span className="font-medium">{actorName}</span>
          {description ? (
            <span className="text-muted-foreground"> &mdash; {description}</span>
          ) : null}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
          <span>{formatDateTime(createdAt)}</span>
          <span
            className="flex size-5 items-center justify-center rounded-full bg-violet-soft text-[10px] font-semibold text-secondary"
            aria-hidden
          >
            {initials(actorName)}
          </span>
          {entityType ? (
            <span>
              {entityType}
              {entityId !== null ? ` #${entityId}` : ''}
            </span>
          ) : null}
        </div>
      </div>
    </motion.li>
  );
}