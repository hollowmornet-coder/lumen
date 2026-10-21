import * as React from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

/**
 * Accepted formats, mirrored from the server's magic-byte check.
 *
 * GIF is listed because it is the reason this panel exists: a student asked
 * for an animated photo, and the server accepts it only for avatars.
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

/**
 * Photo block: the avatar plus its three actions.
 *
 * It renders *without* a panel wrapper so it can sit inside the member card
 * next to the identity facts. Standing alone as a full-width panel left a
 * tall empty column on the profile page.
 */
export function AvatarUploader({ className }: { className?: string }) {
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
  const hasPhoto = Boolean(user?.avatarPath);

  return (
    <div
      className={cn('flex w-full shrink-0 flex-col items-center gap-2.5 sm:w-32', className)}
      aria-label="Foto profil"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div
        className={cn(
          'relative rounded-full p-1 transition-colors',
          dragging ? 'bg-electric-soft ring-2 ring-primary ring-dashed' : 'ring-0',
        )}
      >
        <Avatar name={displayName} src={currentSrc} size="xl" ring />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy-950/55">
            <Loader2 className="size-5 animate-spin text-white" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          title={dragging ? 'Lepaskan untuk mengunggah' : undefined}
        >
          <ImagePlus className="size-3.5" aria-hidden />
          {hasPhoto ? 'Ganti' : 'Pilih Foto'}
        </Button>
        {hasPhoto ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void remove()}
            className="text-destructive hover:bg-destructive-soft"
            aria-label="Hapus foto profil"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      <p className="text-center text-[10px] leading-tight text-muted-foreground">
        {dragging ? (
          'Lepaskan berkas'
        ) : (
          <>
            JPG · PNG · WEBP · GIF
            <br />
            Maksimal {MAX_MB} MB
          </>
        )}
      </p>

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
    </div>
  );
}
