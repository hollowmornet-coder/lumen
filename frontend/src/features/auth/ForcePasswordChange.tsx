import * as React from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';

/**
 * Blocking password change for bulk-imported accounts.
 *
 * The Excel importer creates every account in a batch with the SAME temporary
 * password (hashing 500 individual passwords would block the request for about
 * 40 seconds). A shared secret is only acceptable if it cannot stay in use, so
 * those accounts are flagged and land here until they choose their own.
 *
 * This is a plain fixed overlay rather than a Dialog: it must not be closable
 * with Escape, a backdrop click, or a stray focus trap. The only way out is to
 * change the password or sign out.
 */
export function ForcePasswordChange() {
  const { user, refresh, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!user?.mustChangePassword) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Kata sandi baru minimal 8 karakter dan harus memuat huruf serta angka.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Kata sandi baru harus berbeda dari kata sandi sementara.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      toast.success('Kata sandi diperbarui. Selamat datang!');
      // Refreshing re-reads the flag from the server, so the gate disappears
      // only when the database says it should.
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui kata sandi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-password-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-navy-950/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <ShieldAlert className="size-5" aria-hidden />
          </span>
          <div>
            <h1 id="force-password-title" className="font-display text-lg font-semibold">
              Ganti kata sandi Anda
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Akun ini dibuat oleh petugas dengan kata sandi sementara yang dipakai bersama. Buat
              kata sandi pribadi sebelum melanjutkan.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <Field label="Kata sandi sementara" htmlFor="force-current" required>
            <Input
              id="force-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </Field>

          <Field
            label="Kata sandi baru"
            htmlFor="force-new"
            hint="Minimal 8 karakter, memuat huruf dan angka."
            required
          >
            <Input
              id="force-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </Field>

          <Field label="Ulangi kata sandi baru" htmlFor="force-confirm" required>
            <Input
              id="force-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-destructive-soft p-2.5 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={busy}>
            <KeyRound className="size-4" aria-hidden />
            Simpan kata sandi baru
          </Button>
        </form>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 w-full rounded-md py-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Keluar dan masuk dengan akun lain
        </button>
      </div>
    </div>
  );
}
