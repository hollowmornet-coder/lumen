import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { RotateCcw, Save, Settings2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmContent, ConfirmDialog, ConfirmTrigger } from '@/components/ui/dialog';
import { Field, Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
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
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

/** The subset of keys that are stored as numbers. */
type NumericSettingKey = 'max_loan_per_user' | 'loan_duration_days' | 'late_fee_per_day';

interface FormState {
  max_loan_per_user: string;
  loan_duration_days: string;
  require_approval: boolean;
  allow_self_return: boolean;
  late_fee_per_day: string;
}

interface SettingsPayload {
  max_loan_per_user: number;
  loan_duration_days: number;
  /** The API accepts booleans, but the column stores '1' / '0'. */
  require_approval: '0' | '1';
  allow_self_return: '0' | '1';
  late_fee_per_day: number;
}

/** Server-side bounds, mirrored in settings.schema.ts. */
const BOUNDS: Record<SettingKey, { min: number; max: number; unit: string }> = {
  max_loan_per_user: { min: 1, max: 20, unit: 'buku' },
  loan_duration_days: { min: 1, max: 90, unit: 'hari' },
  require_approval: { min: 0, max: 0, unit: '' },
  allow_self_return: { min: 0, max: 0, unit: '' },
  late_fee_per_day: { min: 0, max: 100_000, unit: 'rupiah' },
};

const FALLBACK: FormState = {
  max_loan_per_user: '3',
  loan_duration_days: '7',
  require_approval: true,
  allow_self_return: true,
  late_fee_per_day: '1000',
};

const FALLBACK_DESCRIPTIONS: Record<SettingKey, string> = {
  max_loan_per_user: 'Jumlah buku maksimal yang dapat dipinjam seorang anggota pada waktu bersamaan.',
  loan_duration_days: 'Masa peminjaman dihitung sejak buku diserahkan, dalam hitungan hari.',
  require_approval: 'Jika aktif, setiap peminjaman baru harus disetujui petugas sebelum buku diserahkan.',
  allow_self_return: 'Jika aktif, anggota boleh menandai buku ingin dikembalikan tanpa bantuan petugas.',
  late_fee_per_day: 'Denda yang dihitung otomatis untuk setiap hari keterlambatan pengembalian.',
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
  return (
    a.max_loan_per_user === b.max_loan_per_user &&
    a.loan_duration_days === b.loan_duration_days &&
    a.require_approval === b.require_approval &&
    a.allow_self_return === b.allow_self_return &&
    a.late_fee_per_day === b.late_fee_per_day
  );
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
  if (form.max_loan_per_user !== baseline.max_loan_per_user) changedLabels.push('Jumlah peminjaman maks');
  if (form.loan_duration_days !== baseline.loan_duration_days) changedLabels.push('Masa peminjaman');
  if (form.require_approval !== baseline.require_approval) changedLabels.push('Persetujuan petugas');
  if (form.allow_self_return !== baseline.allow_self_return) changedLabels.push('Pengembalian mandiri');
  if (form.late_fee_per_day !== baseline.late_fee_per_day) changedLabels.push('Denda harian');

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
                </dl>
              </div>
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
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

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