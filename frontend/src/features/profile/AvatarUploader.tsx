import * as React from 'react';
import { toast } from 'sonner';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

/**
 * Accepted formats, mirrored from the server's magic-byte check.
 *
 * GIF is listed first because it is the reason this panel exists: a student
 * asked for an animated photo, and the server accepts it only for avatars.
 */
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_MB = 5;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Client-side pre-check.
 *
 * The server re-validates the actual bytes - this only exists to fail fast
 * with a message the student can act on, instead of uploading 5 MB over a
 * school connection to be told "format tidak dikenali".
 */
function validate(file: File): string | null {
  if (!ALLOWED.includes(file.type.toLowerCase())) {
    return 'Format harus JPG, PNG, WEBP, atau GIF.';
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return `Ukuran foto maksimal ${MAX_MB} MB.`;
  }
  if (file.size === 0) {
    return 'Berkas kosong. Pilih foto lain.';
  }
  return null;
}

export function AvatarUploader() {
  const { user, setUser } = useAuth();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

  // Object URLs must be revoked or the blob stays in memory for the tab's
  // lifetime. Each preview replaces the previous one.
  const previewRef = React.useRef<string | null>(null);
  const setPreviewUrl = React.useCallback((url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }, []);

  React.useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const upload = React.useCallback(
    async (file: File) => {
      const problem = validate(file);
      if (problem) {
        toast.error(problem);
        return;
      }

      setPreviewUrl(URL.createObjectURL(file));
      setBusy(true);

      const form = new FormData();
      form.append('avatar', file);

      try {
        const res = await api.upload<User>('/auth/avatar', form);
        setUser(res.data);
        setPreviewUrl(null);
        toast.success(res.message ?? 'Foto profil berhasil diperbarui.');
      } catch (err) {
        setPreviewUrl(null);
        toast.error(err instanceof ApiError ? err.message : 'Gagal mengunggah foto.');
      } finally {
        setBusy(false);
        // Allow picking the same file again after an error.
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [setPreviewUrl, setUser],
  );

  const remove = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.delete<User>('/auth/avatar');
      setUser(res.data);
      setPreviewUrl(null);
      toast.success('Foto profil dihapus.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus foto.');
    } finally {
      setBusy(false);
    }
  }, [setPreviewUrl, setUser]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const displayName = user?.fullName ?? 'Anggota';
  const currentSrc = preview ?? user?.avatarPath ?? null;

  return (
    <section className="panel p-5" aria-label="Foto profil">
      <header className="mb-4 flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-electric-soft text-primary"
          aria-hidden
        >
          <Camera className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">Foto Profil</h2>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WEBP, atau GIF (animasi didukung). Maksimal {MAX_MB} MB.
          </p>
        </div>
      </header>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative">
          <Avatar name={displayName} src={currentSrc} size="xl" ring />
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy-950/55">
              <Loader2 className="size-5 animate-spin text-white" aria-hidden />
            </span>
          ) : null}
        </div>

        <div className="w-full space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-4 text-center transition-colors',
              dragging ? 'border-primary bg-electric-soft' : 'border-border bg-background/40',
            )}
          >
            <ImagePlus className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-2xs text-muted-foreground">
              Tarik foto ke sini, atau
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                Pilih Foto
              </Button>
              {user?.avatarPath ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="text-destructive hover:bg-destructive-soft"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Hapus
                </Button>
              ) : null}
            </div>
          </div>

          <p className="text-2xs leading-relaxed text-muted-foreground">
            Foto hanya terlihat oleh petugas perpustakaan dan Anda sendiri. Berkas disimpan di
            server perpustakaan, bukan di komputer ini.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Pilih berkas foto profil"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </section>
  );
}
