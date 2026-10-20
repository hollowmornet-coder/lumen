import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  DatabaseBackup,
  Download,
  HandCoins,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmContent, ConfirmDialog, ConfirmTrigger } from '@/components/ui/dialog';
import { Field, Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useApiMutation, useSettings } from '@/hooks/useApi';
import { cn, formatNumber, formatRupiah } from '@/lib/utils';
import { springSoft, staggerContainer, staggerItem } from '@/lib/motion';
import type { SettingItem } from '@/types';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

/** Exactly the keys PUT /api/settings accepts. */
const SETTING_KEYS = [
  'max_loan_per_user',
  'loan_duration_days',
  'require_approval',
  'allow_self_return',
  'late_fee_per_day',
  'max_renewals',
  'pickup_window_days',
  'fine_block_borrow',
  'damaged_fee',
  'lost_fee',
  'reservation_hold_days',
  'due_date_skip_holidays',
  'max_reservations_per_user',
  'review_requires_loan',
  'visit_tracking_enabled',
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

/** The subset of keys that are stored as numbers. */
type NumericSettingKey =
  | 'max_loan_per_user'
  | 'loan_duration_days'
  | 'late_fee_per_day'
  | 'max_renewals'
  | 'pickup_window_days'
  | 'damaged_fee'
  | 'lost_fee'
  | 'reservation_hold_days'
  | 'max_reservations_per_user';

interface FormState {
  max_loan_per_user: string;
  loan_duration_days: string;
  require_approval: boolean;
  allow_self_return: boolean;
  late_fee_per_day: string;
  max_renewals: string;
  pickup_window_days: string;
  fine_block_borrow: boolean;
  damaged_fee: string;
  lost_fee: string;
  reservation_hold_days: string;
  due_date_skip_holidays: boolean;
  max_reservations_per_user: string;
  review_requires_loan: boolean;
  visit_tracking_enabled: boolean;
}

interface SettingsPayload {
  max_loan_per_user: number;
  loan_duration_days: number;
  /** The API accepts booleans, but the column stores '1' / '0'. */
  require_approval: '0' | '1';
  allow_self_return: '0' | '1';
  late_fee_per_day: number;
  max_renewals: number;
  pickup_window_days: number;
  fine_block_borrow: '0' | '1';
  damaged_fee: number;
  lost_fee: number;
  reservation_hold_days: number;
  due_date_skip_holidays: '0' | '1';
  max_reservations_per_user: number;
  review_requires_loan: '0' | '1';
  visit_tracking_enabled: '0' | '1';
}

/** Server-side bounds, mirrored in settings.schema.ts. */
const BOUNDS: Record<SettingKey, { min: number; max: number; unit: string }> = {
  max_loan_per_user: { min: 1, max: 20, unit: 'buku' },
  loan_duration_days: { min: 1, max: 90, unit: 'hari' },
  require_approval: { min: 0, max: 0, unit: '' },
  allow_self_return: { min: 0, max: 0, unit: '' },
  late_fee_per_day: { min: 0, max: 100_000, unit: 'rupiah' },
  max_renewals: { min: 0, max: 5, unit: 'kali' },
  pickup_window_days: { min: 1, max: 30, unit: 'hari' },
  fine_block_borrow: { min: 0, max: 0, unit: '' },
  damaged_fee: { min: 0, max: 1_000_000, unit: 'rupiah' },
  lost_fee: { min: 0, max: 1_000_000, unit: 'rupiah' },
  reservation_hold_days: { min: 1, max: 30, unit: 'hari' },
  due_date_skip_holidays: { min: 0, max: 0, unit: '' },
  max_reservations_per_user: { min: 1, max: 20, unit: 'antrean' },
  review_requires_loan: { min: 0, max: 0, unit: '' },
  visit_tracking_enabled: { min: 0, max: 0, unit: '' },
};

const FALLBACK: FormState = {
  max_loan_per_user: '3',
  loan_duration_days: '7',
  require_approval: true,
  allow_self_return: true,
  late_fee_per_day: '1000',
  max_renewals: '1',
  pickup_window_days: '2',
  fine_block_borrow: true,
  damaged_fee: '5000',
  lost_fee: '50000',
  reservation_hold_days: '2',
  due_date_skip_holidays: true,
  max_reservations_per_user: '3',
  review_requires_loan: true,
  visit_tracking_enabled: true,
};

const FALLBACK_DESCRIPTIONS: Record<SettingKey, string> = {
  max_loan_per_user: 'Jumlah buku maksimal yang dapat dipinjam seorang anggota pada waktu bersamaan.',
  loan_duration_days: 'Masa peminjaman dihitung sejak buku diserahkan, dalam hitungan hari.',
  require_approval: 'Jika aktif, setiap peminjaman baru harus disetujui petugas sebelum buku diserahkan.',
  allow_self_return: 'Jika aktif, anggota boleh menandai buku ingin dikembalikan tanpa bantuan petugas.',
  late_fee_per_day: 'Denda yang dihitung otomatis untuk setiap hari keterlambatan pengembalian.',
  max_renewals:
    'Berapa kali satu peminjaman boleh diperpanjang. Isi 0 untuk mematikan fitur perpanjangan.',
  pickup_window_days:
    'Batas waktu anggota mengambil buku yang sudah disetujui. Lewat batas ini, jatah dilepas ke antrean berikutnya.',
  fine_block_borrow:
    'Jika aktif, anggota yang masih memiliki denda belum lunas tidak dapat meminjam buku baru.',
  damaged_fee: 'Biaya penggantian/perbaikan yang ditagihkan saat buku dikembalikan dalam kondisi rusak.',
  lost_fee: 'Biaya penggantian yang ditagihkan saat buku dinyatakan hilang.',
  reservation_hold_days:
    'Berapa hari buku disisihkan untuk anggota yang mengantre sebelum kesempatan berpindah.',
  due_date_skip_holidays:
    'Jika aktif, tanggal jatuh tempo yang mengenai hari libur atau hari Minggu digeser ke hari kerja berikutnya.',
  max_reservations_per_user:
    'Batas antrean aktif yang boleh dimiliki satu anggota. Mencegah satu siswa mengantre seluruh katalog.',
  review_requires_loan:
    'Jika aktif, hanya anggota yang pernah meminjam sebuah buku yang boleh menulis ulasan untuk buku itu.',
  visit_tracking_enabled:
    'Jika aktif, petugas dapat mencatat kunjungan harian perpustakaan.',
};

/** '1', 'true', 1 -> true. Everything else (including '0') -> false. */
function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalised = value.trim().toLowerCase();
  if (normalised === '1' || normalised === 'true') return true;
  if (normalised === '0' || normalised === 'false') return false;
  return fallback;
}

function toBoolFlag(value: boolean): '0' | '1' {
  return value ? '1' : '0';
}

function toInt(value: string | undefined, fallback: number): string {
  if (value === undefined) return String(fallback);
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(parsed) : String(fallback);
}

function readForm(items: readonly SettingItem[]): FormState {
  const map = new Map(items.map((item) => [item.key, item.value]));
  return {
    max_loan_per_user: toInt(map.get('max_loan_per_user'), 3),
    loan_duration_days: toInt(map.get('loan_duration_days'), 7),
    require_approval: toBool(map.get('require_approval'), true),
    allow_self_return: toBool(map.get('allow_self_return'), true),
    late_fee_per_day: toInt(map.get('late_fee_per_day'), 1000),
    max_renewals: toInt(map.get('max_renewals'), 1),
    pickup_window_days: toInt(map.get('pickup_window_days'), 2),
    fine_block_borrow: toBool(map.get('fine_block_borrow'), true),
    damaged_fee: toInt(map.get('damaged_fee'), 5000),
    lost_fee: toInt(map.get('lost_fee'), 50000),
    reservation_hold_days: toInt(map.get('reservation_hold_days'), 2),
    due_date_skip_holidays: toBool(map.get('due_date_skip_holidays'), true),
    max_reservations_per_user: toInt(map.get('max_reservations_per_user'), 3),
    review_requires_loan: toBool(map.get('review_requires_loan'), true),
    visit_tracking_enabled: toBool(map.get('visit_tracking_enabled'), true),
  };
}

function readDescriptions(items: readonly SettingItem[]): Record<SettingKey, string> {
  const map = new Map(items.map((item) => [item.key, item.description]));
  const result = { ...FALLBACK_DESCRIPTIONS };
  for (const key of SETTING_KEYS) {
    const description = map.get(key);
    if (description) result[key] = description;
  }
  return result;
}

function sameForm(a: FormState, b: FormState): boolean {
  return (Object.keys(a) as Array<keyof FormState>).every((key) => a[key] === b[key]);
}

function validate(form: FormState): Partial<Record<SettingKey, string>> {
  const errors: Partial<Record<SettingKey, string>> = {};

  const checkNumber = (key: NumericSettingKey, label: string) => {
    const raw = form[key].trim();
    if (raw === '') {
      errors[key] = `${label} wajib diisi.`;
      return;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      errors[key] = `${label} harus berupa bilangan bulat.`;
      return;
    }
    const { min, max, unit } = BOUNDS[key];
    if (parsed < min || parsed > max) {
      errors[key] = `${label} harus antara ${formatNumber(min)} dan ${formatNumber(max)} ${unit}.`;
    }
  };

  checkNumber('max_loan_per_user', 'Jumlah peminjaman');
  checkNumber('loan_duration_days', 'Masa peminjaman');
  checkNumber('late_fee_per_day', 'Denda harian');
  checkNumber('max_renewals', 'Batas perpanjangan');
  checkNumber('pickup_window_days', 'Batas pengambilan');
  checkNumber('damaged_fee', 'Biaya kerusakan');
  checkNumber('lost_fee', 'Biaya kehilangan');
  checkNumber('reservation_hold_days', 'Masa sisih antrean');
  checkNumber('max_reservations_per_user', 'Batas antrean anggota');

  return errors;
}

export default function AdminSettingsPage() {
  const settings = useSettings();
  const reduce = useReducedMotion();

  const [form, setForm] = React.useState<FormState>(FALLBACK);
  const [baseline, setBaseline] = React.useState<FormState>(FALLBACK);
  const [touched, setTouched] = React.useState(false);
  const dirtyRef = React.useRef(false);

  // Hydrate from the server, but never stomp on unsaved edits when the query
  // silently refetches (window focus, cache reconciliation).
  React.useEffect(() => {
    if (!settings.data || dirtyRef.current) return;
    const next = readForm(settings.data);
    setForm(next);
    setBaseline(next);
    setTouched(false);
  }, [settings.data]);

  const descriptions = React.useMemo(
    () => (settings.data ? readDescriptions(settings.data) : FALLBACK_DESCRIPTIONS),
    [settings.data],
  );

  const save = useApiMutation<SettingsPayload, SettingItem[]>({
    mutationFn: async (payload) => (await api.put<SettingItem[]>('/settings', payload)).data,
    successMessage: 'Pengaturan perpustakaan berhasil disimpan.',
    invalidate: [['settings'], ['dashboard'], ['loans'], ['my-loans'], ['members']],
  });

  const dirty = !sameForm(form, baseline);
  const errors = React.useMemo(() => validate(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = React.useCallback(function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    dirtyRef.current = true;
    setTouched(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const revert = () => {
    dirtyRef.current = false;
    setTouched(false);
    setForm(baseline);
  };

  const submit = async () => {
    if (hasErrors) return;
    const payload: SettingsPayload = {
      max_loan_per_user: Number(form.max_loan_per_user),
      loan_duration_days: Number(form.loan_duration_days),
      require_approval: toBoolFlag(form.require_approval),
      allow_self_return: toBoolFlag(form.allow_self_return),
      late_fee_per_day: Number(form.late_fee_per_day),
      max_renewals: Number(form.max_renewals),
      pickup_window_days: Number(form.pickup_window_days),
      fine_block_borrow: toBoolFlag(form.fine_block_borrow),
      damaged_fee: Number(form.damaged_fee),
      lost_fee: Number(form.lost_fee),
      reservation_hold_days: Number(form.reservation_hold_days),
      due_date_skip_holidays: toBoolFlag(form.due_date_skip_holidays),
      max_reservations_per_user: Number(form.max_reservations_per_user),
      review_requires_loan: toBoolFlag(form.review_requires_loan),
      visit_tracking_enabled: toBoolFlag(form.visit_tracking_enabled),
    };
    try {
      await save.mutateAsync(payload);
      // The server now holds exactly this form, so it becomes the new baseline.
      dirtyRef.current = false;
      setTouched(false);
      setBaseline(form);
    } catch {
      // The toast already carries the server message.
    }
  };

  const containerVariants = reduce ? STILL : staggerContainer(0.06);
  const panelVariants = reduce ? STILL : staggerItem;

  const changedLabels: string[] = [];
  const LABELS: Record<keyof FormState, string> = {
    max_loan_per_user: 'Jumlah peminjaman maks',
    loan_duration_days: 'Masa peminjaman',
    require_approval: 'Persetujuan petugas',
    allow_self_return: 'Pengembalian mandiri',
    late_fee_per_day: 'Denda harian',
    max_renewals: 'Batas perpanjangan',
    pickup_window_days: 'Batas pengambilan',
    fine_block_borrow: 'Blokir karena denda',
    damaged_fee: 'Biaya kerusakan',
    lost_fee: 'Biaya kehilangan',
    reservation_hold_days: 'Masa sisih antrean',
    due_date_skip_holidays: 'Geser jatuh tempo saat libur',
    max_reservations_per_user: 'Batas antrean anggota',
    review_requires_loan: 'Ulasan hanya setelah meminjam',
    visit_tracking_enabled: 'Pencatatan kunjungan',
  };
  for (const key of Object.keys(LABELS) as Array<keyof FormState>) {
    if (form[key] !== baseline[key]) changedLabels.push(LABELS[key]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Pengaturan Perpustakaan"
        description="Aturan operasional yang berlaku untuk seluruh anggota dan petugas. Perubahan berlaku segera ke semua transaksi baru."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Pengaturan' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? <Badge tone="warning">Perubahan belum disimpan</Badge> : null}
            <Button
              variant="outline"
              size="sm"
              onClick={revert}
              disabled={!dirty || save.isPending}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Kembalikan
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {settings.isLoading
              ? 'Memuat pengaturan...'
              : `${SETTING_KEYS.length} aturan aktif untuk seluruh perpustakaan`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        <div className="panel flex items-start gap-3 border-warning/25 bg-warning-soft/40 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Perubahan bersifat sistem-wide</p>
            <p className="text-xs text-muted-foreground">
              Pengaturan di sini memengaruhi seluruh anggota, termasuk peminjaman yang sedang
              berjalan. Simpan hanya setelah seluruh petugas menyetujui perubahan ini.
            </p>
          </div>
        </div>

        {settings.isError ? (
          <div className="panel">
            <ErrorState
              title="Gagal memuat pengaturan"
              message={settings.error?.message}
              onRetry={() => void settings.refetch()}
            />
          </div>
        ) : settings.isLoading ? (
          <div className="panel space-y-5 p-5" role="status" aria-label="Memuat pengaturan">
            {SETTING_KEYS.map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
            ))}
          </div>
        ) : (
          <motion.form
            variants={containerVariants}
            initial="hidden"
            animate="show"
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="grid gap-4 lg:grid-cols-2"
          >
            <motion.section
              variants={panelVariants}
              transition={reduce ? undefined : springSoft}
              className="panel p-5"
              aria-labelledby="loan-rules-heading"
            >
              <header className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-electric-soft text-primary">
                  <Settings2 className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 id="loan-rules-heading" className="font-display text-base font-semibold">
                    Aturan Peminjaman
                  </h2>
                  <p className="text-xs text-muted-foreground">Batas dan masa pinjam buku</p>
                </div>
              </header>

              <div className="space-y-4">
                <Field
                  label="Jumlah peminjaman maksimal per anggota"
                  htmlFor="max_loan_per_user"
                  required
                  error={touched ? errors.max_loan_per_user : undefined}
                  hint={`${formatNumber(BOUNDS.max_loan_per_user.min)}-${formatNumber(BOUNDS.max_loan_per_user.max)} buku. ${descriptions.max_loan_per_user}`}
                >
                  <Input
                    id="max_loan_per_user"
                    type="number"
                    inputMode="numeric"
                    min={BOUNDS.max_loan_per_user.min}
                    max={BOUNDS.max_loan_per_user.max}
                    step={1}
                    value={form.max_loan_per_user}
                    disabled={save.isPending}
                    aria-invalid={touched && errors.max_loan_per_user ? true : undefined}
                    onChange={(e) => update('max_loan_per_user', e.target.value)}
                  />
                </Field>

                <Field
                  label="Masa peminjaman"
                  htmlFor="loan_duration_days"
                  required
                  error={touched ? errors.loan_duration_days : undefined}
                  hint={`${formatNumber(BOUNDS.loan_duration_days.min)}-${formatNumber(BOUNDS.loan_duration_days.max)} hari. ${descriptions.loan_duration_days}`}
                >
                  <Input
                    id="loan_duration_days"
                    type="number"
                    inputMode="numeric"
                    min={BOUNDS.loan_duration_days.min}
                    max={BOUNDS.loan_duration_days.max}
                    step={1}
                    value={form.loan_duration_days}
                    disabled={save.isPending}
                    aria-invalid={touched && errors.loan_duration_days ? true : undefined}
                    onChange={(e) => update('loan_duration_days', e.target.value)}
                  />
                </Field>

                <Field
                  label="Denda keterlambatan per hari"
                  htmlFor="late_fee_per_day"
                  required
                  error={touched ? errors.late_fee_per_day : undefined}
                  hint={`${formatNumber(BOUNDS.late_fee_per_day.min)}-${formatNumber(BOUNDS.late_fee_per_day.max)}. ${descriptions.late_fee_per_day}`}
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="late_fee_per_day"
                      type="number"
                      inputMode="numeric"
                      min={BOUNDS.late_fee_per_day.min}
                      max={BOUNDS.late_fee_per_day.max}
                      step={100}
                      value={form.late_fee_per_day}
                      disabled={save.isPending}
                      aria-invalid={touched && errors.late_fee_per_day ? true : undefined}
                      className="pl-9"
                      onChange={(e) => update('late_fee_per_day', e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contoh: keterlambatan 3 hari dikenai{' '}
                    <span className="font-medium text-foreground">
                      {formatRupiah(Math.max(0, Number(form.late_fee_per_day) || 0) * 3)}
                    </span>
                    .
                  </p>
                </Field>
              </div>
            </motion.section>

            <motion.section
              variants={panelVariants}
              transition={reduce ? undefined : springSoft}
              className="panel p-5"
              aria-labelledby="workflow-rules-heading"
            >
              <header className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-soft text-secondary">
                  <ShieldCheck className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 id="workflow-rules-heading" className="font-display text-base font-semibold">
                    Alur Persetujuan
                  </h2>
                  <p className="text-xs text-muted-foreground">Siapa yang boleh memproses peminjaman</p>
                </div>
              </header>

              <div className="space-y-3">
                <SwitchField
                  id="require_approval"
                  label="Wajib persetujuan petugas"
                  description={descriptions.require_approval}
                  checked={form.require_approval}
                  disabled={save.isPending}
                  onChange={(next) => update('require_approval', next)}
                />
                <SwitchField
                  id="allow_self_return"
                  label="Izinkan pengembalian mandiri"
                  description={descriptions.allow_self_return}
                  checked={form.allow_self_return}
                  disabled={save.isPending}
                  onChange={(next) => update('allow_self_return', next)}
                />
              </div>

              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                <p className="eyebrow mb-2">Ringkasan aturan aktif</p>
                <dl className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Kuota per anggota</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {formatNumber(Number(form.max_loan_per_user) || 0)} buku
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Masa pinjam</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {formatNumber(Number(form.loan_duration_days) || 0)} hari
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Persetujuan petugas</dt>
                    <dd className="font-semibold text-foreground">
                      {form.require_approval ? 'Diwajibkan' : 'Tidak diwajibkan'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Pengembalian mandiri</dt>
                    <dd className="font-semibold text-foreground">
                      {form.allow_self_return ? 'Diizinkan' : 'Dilarang'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Denda harian</dt>
                    <dd className="font-semibold text-foreground">
                      {formatRupiah(Number(form.late_fee_per_day) || 0)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Perpanjangan</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {Number(form.max_renewals) > 0
                        ? `${formatNumber(Number(form.max_renewals))}x per pinjaman`
                        : 'Dinonaktifkan'}
                    </dd>
                  </div>
                </dl>
              </div>
            </motion.section>

            {/* ---------- Fines, renewals, reservations ---------- */}
            <motion.section
              variants={panelVariants}
              transition={reduce ? undefined : springSoft}
              className="panel p-5 lg:col-span-2"
              aria-labelledby="circulation-heading"
            >
              <header className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-warning-soft text-warning">
                  <HandCoins className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 id="circulation-heading" className="font-display text-base font-semibold">
                    Sirkulasi, Denda &amp; Antrean
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Aturan perpanjangan, batas pengambilan, dan tarif penggantian
                  </p>
                </div>
              </header>

              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  id="max_renewals"
                  label="Batas perpanjangan per pinjaman"
                  form={form}
                  bounds={BOUNDS.max_renewals}
                  description={descriptions.max_renewals}
                  hint="0 mematikan perpanjangan sepenuhnya."
                  error={touched ? errors.max_renewals : undefined}
                  disabled={save.isPending}
                  onChange={update}
                />

                <NumberField
                  id="pickup_window_days"
                  label="Batas waktu pengambilan"
                  form={form}
                  bounds={BOUNDS.pickup_window_days}
                  description={descriptions.pickup_window_days}
                  hint="Dihitung sejak peminjaman disetujui."
                  error={touched ? errors.pickup_window_days : undefined}
                  disabled={save.isPending}
                  onChange={update}
                />

                <NumberField
                  id="damaged_fee"
                  label="Biaya buku rusak"
                  form={form}
                  bounds={BOUNDS.damaged_fee}
                  description={descriptions.damaged_fee}
                  prefix="Rp"
                  error={touched ? errors.damaged_fee : undefined}
                  disabled={save.isPending}
                  onChange={update}
                />

                <NumberField
                  id="lost_fee"
                  label="Biaya buku hilang"
                  form={form}
                  bounds={BOUNDS.lost_fee}
                  description={descriptions.lost_fee}
                  prefix="Rp"
                  error={touched ? errors.lost_fee : undefined}
                  disabled={save.isPending}
                  onChange={update}
                />

                <NumberField
                  id="reservation_hold_days"
                  label="Masa sisih buku antrean"
                  form={form}
                  bounds={BOUNDS.reservation_hold_days}
                  description={descriptions.reservation_hold_days}
                  hint="Berlaku saat buku pesanan tersedia."
                  error={touched ? errors.reservation_hold_days : undefined}
                  disabled={save.isPending}
                  onChange={update}
                />

                <div className="md:col-span-1">
                  <SwitchField
                    id="fine_block_borrow"
                    label="Blokir peminjaman karena denda"
                    description={descriptions.fine_block_borrow}
                    checked={form.fine_block_borrow}
                    disabled={save.isPending}
                    onChange={(next) => update('fine_block_borrow', next)}
                  />
                </div>
              </div>
            </motion.section>

            {/* ---------- Kalender, antrean, ulasan, kunjungan ---------- */}
            <motion.section
              variants={panelVariants}
              transition={reduce ? undefined : springSoft}
              className="panel p-5 lg:col-span-2"
              aria-labelledby="operations-heading"
            >
              <header className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-soft text-violet">
                  <Settings2 className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 id="operations-heading" className="font-display text-base font-semibold">
                    Operasional Tambahan
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Hari libur, batas antrean, ulasan, dan pencatatan kunjungan
                  </p>
                </div>
              </header>

              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  id="max_reservations_per_user"
                  label="Batas antrean aktif per anggota"
                  form={form}
                  bounds={BOUNDS.max_reservations_per_user}
                  description={descriptions.max_reservations_per_user}
                  error={touched ? errors.max_reservations_per_user : undefined}
                  disabled={save.isPending}
                  onChange={update}
                />

                <div className="md:col-span-1">
                  <SwitchField
                    id="due_date_skip_holidays"
                    label="Geser jatuh tempo melewati hari libur"
                    description={descriptions.due_date_skip_holidays}
                    checked={form.due_date_skip_holidays}
                    disabled={save.isPending}
                    onChange={(next) => update('due_date_skip_holidays', next)}
                  />
                </div>

                <div className="md:col-span-1">
                  <SwitchField
                    id="review_requires_loan"
                    label="Ulasan hanya untuk yang pernah meminjam"
                    description={descriptions.review_requires_loan}
                    checked={form.review_requires_loan}
                    disabled={save.isPending}
                    onChange={(next) => update('review_requires_loan', next)}
                  />
                </div>

                <div className="md:col-span-1">
                  <SwitchField
                    id="visit_tracking_enabled"
                    label="Pencatatan kunjungan perpustakaan"
                    description={descriptions.visit_tracking_enabled}
                    checked={form.visit_tracking_enabled}
                    disabled={save.isPending}
                    onChange={(next) => update('visit_tracking_enabled', next)}
                  />
                </div>
              </div>

              <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Daftar hari libur yang dipakai untuk menggeser jatuh tempo dikelola di halaman{' '}
                <a href="/admin/hari-libur" className="font-medium text-primary underline">
                  Hari Libur
                </a>
                .
              </p>
            </motion.section>
          </motion.form>
        )}

        {/* ---------- Save bar ---------- */}
        {!settings.isLoading && !settings.isError ? (
          <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {dirty ? (
                <>
                  <span className="font-medium text-foreground">{changedLabels.length} aturan</span>{' '}
                  berubah: {changedLabels.join(', ')}.
                </>
              ) : (
                'Semua perubahan sudah tersimpan.'
              )}
            </p>

            <div className="flex items-center gap-2">
              <ConfirmDialog>
                <ConfirmTrigger asChild>
                  <Button
                    type="button"
                    disabled={!dirty || hasErrors || save.isPending}
                    loading={save.isPending}
                  >
                    <Save className="size-4" aria-hidden />
                    Simpan pengaturan
                  </Button>
                </ConfirmTrigger>
                <ConfirmContent
                  title="Terapkan pengaturan sistem?"
                  tone="primary"
                  confirmLabel="Ya, simpan"
                  cancelLabel="Batal"
                  onConfirm={async () => {
                    await submit();
                  }}
                  description="Perubahan berlaku langsung untuk seluruh anggota dan petugas, termasuk pada peminjaman yang sedang berjalan."
                >
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {changedLabels.map((label) => (
                      <li key={label} className="flex items-center gap-1.5">
                        <span className="size-1 rounded-full bg-primary" aria-hidden />
                        {label}
                      </li>
                    ))}
                  </ul>
                </ConfirmContent>
              </ConfirmDialog>
            </div>
          </div>
        ) : null}

        {/* ---------- Backup ---------- */}
        <BackupPanel />
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Manual database backup.
 *
 * Runs a real mysqldump on the server and streams the file down. Kept manual
 * rather than scheduled: a school server has no reliable always-on cron, and a
 * download the officer actually stores somewhere is worth more than a cron job
 * writing into a folder nobody looks at.
 */
function BackupPanel() {
  const [busy, setBusy] = React.useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await downloadFile('/backup/database', undefined, 'lumen-backup.sql');
      toast.success('Cadangan basis data berhasil diunduh. Simpan di tempat aman.');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Gagal membuat cadangan. Periksa konfigurasi mysqldump di server.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-5" aria-labelledby="backup-heading">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-soft text-cyan">
          <DatabaseBackup className="size-4" aria-hidden />
        </span>
        <div>
          <h2 id="backup-heading" className="font-display text-base font-semibold">
            Cadangan Basis Data
          </h2>
          <p className="text-xs text-muted-foreground">
            Unduh salinan lengkap seluruh data perpustakaan
          </p>
        </div>
      </header>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Berkas <span className="font-mono">.sql</span> berisi skema dan seluruh isi tabel: buku,
        anggota, transaksi, denda, dan antrean. Simpan berkas di luar server. Untuk memulihkan,
        jalankan berkas ini melalui klien MySQL pada basis data kosong.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={download} loading={busy}>
          <Download className="size-3.5" aria-hidden />
          Unduh cadangan
        </Button>
        <span className="text-2xs text-muted-foreground">
          Proses berjalan di server dan bisa memakan waktu pada basis data besar.
        </span>
      </div>

      <RestorePanel />
    </section>
  );
}

/**
 * Restore form.
 *
 * Deliberately awkward: a file picker plus a typed confirmation phrase. The
 * server also inspects the dump before touching a table, but the phrase is what
 * stops an accidental click from starting a restore in the first place.
 */
function RestorePanel() {
  const [file, setFile] = React.useState<File | null>(null);
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const canSubmit = Boolean(file) && confirmation.trim() === 'PULIHKAN' && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !canSubmit) return;

    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('confirmation', confirmation.trim());

      const res = await api.upload<{ bytes: number; tables: string[]; durationMs: number }>(
        '/backup/restore',
        form,
      );
      toast.success(res.message ?? 'Database berhasil dipulihkan.');
      setFile(null);
      setConfirmation('');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Gagal memulihkan database. Periksa berkas dan konfigurasi klien mysql.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-5 space-y-3 border-t border-border pt-4"
      aria-labelledby="restore-heading"
    >
      <div>
        <h3 id="restore-heading" className="font-display text-sm font-semibold">
          Pulihkan dari cadangan
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Seluruh isi basis data saat ini akan <strong>diganti</strong> dengan isi berkas. Tidak ada
          pembatalan.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft p-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-xs text-destructive">
          Buat cadangan terbaru lebih dulu. Setelah pemulihan, semua pengguna harus masuk ulang.
        </p>
      </div>

      <Field label="Berkas cadangan (.sql)" htmlFor="restore-file" required>
        <input
          id="restore-file"
          type="file"
          accept=".sql"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="block w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
        />
      </Field>

      <Field
        label="Ketik PULIHKAN untuk mengonfirmasi"
        htmlFor="restore-confirm"
        hint="Huruf besar semua."
        required
      >
        <Input
          id="restore-confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="PULIHKAN"
          autoComplete="off"
          disabled={busy}
        />
      </Field>

      <Button type="submit" variant="danger" size="sm" loading={busy} disabled={!canSubmit}>
        <RotateCcw className="size-3.5" aria-hidden />
        Pulihkan database
      </Button>
    </form>
  );
}

/**
 * Numeric setting input.
 *
 * Extracted because the page now has eight of them; duplicating the
 * label/hint/error/prefix markup eight times is how forms drift apart.
 */
function NumberField({
  id,
  label,
  form,
  bounds,
  description,
  hint,
  prefix,
  error,
  disabled,
  onChange,
}: {
  id: NumericSettingKey;
  label: string;
  form: FormState;
  bounds: { min: number; max: number; unit: string };
  description: string;
  hint?: string;
  prefix?: string;
  error?: string;
  disabled?: boolean;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const value = form[id];

  return (
    <Field
      label={label}
      htmlFor={id}
      required
      error={error}
      hint={`${formatNumber(bounds.min)}-${formatNumber(bounds.max)} ${bounds.unit}. ${description}${
        hint ? ` ${hint}` : ''
      }`}
    >
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={bounds.min}
          max={bounds.max}
          step={prefix ? 500 : 1}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={prefix ? 'pl-9' : undefined}
          onChange={(e) => onChange(id, e.target.value)}
        />
      </div>
    </Field>
  );
}

function SwitchField({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-60',
          checked ? 'border-primary bg-primary' : 'border-border bg-muted',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute size-4 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-[0.1875rem]',
          )}
        />
      </button>
    </div>
  );
}