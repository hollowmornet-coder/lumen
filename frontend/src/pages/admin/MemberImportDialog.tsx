import * as React from 'react';
import { AlertTriangle, Copy, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Field } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import type { MemberImportSummary } from '@/types';

type Mode = 'validate' | 'commit';

interface PreviewState {
  mode: Mode;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

/**
 * Bulk member import.
 *
 * Two-step on purpose: "Periksa" uploads the same file with `mode=validate` and
 * writes nothing. A librarian importing 300 students should see the error list
 * *before* 280 accounts exist, not after.
 *
 * The batch password is shown once, in this dialog, with a copy button. It is
 * never stored in plaintext and never logged, so if it is lost the only way back
 * is the per-member reset flow.
 */
export function MemberImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onImported: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState<Mode | null>(null);
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const [result, setResult] = React.useState<MemberImportSummary | null>(null);

  const reset = () => {
    setFile(null);
    setBusy(null);
    setPreview(null);
    setResult(null);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const upload = async (mode: Mode) => {
    if (!file) return;
    setBusy(mode);
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await api.upload<MemberImportSummary>(
        `/excel/import/members?mode=${mode}`,
        form,
      );

      if (mode === 'validate') {
        setPreview({ mode, ...res.data });
        toast.success('Berkas terbaca. Periksa hasilnya sebelum menyimpan.');
      } else {
        setResult(res.data);
        setPreview(null);
        toast.success(res.message ?? 'Anggota berhasil diimpor.');
        onImported();
      }
    } catch (err) {
      // A 422 still carries the per-row report, which is the useful part.
      const body = (err as { data?: unknown }).data;
      if (err instanceof ApiError && err.status === 422) {
        toast.error(err.message);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Gagal mengunggah berkas.');
      }
      void body;
    } finally {
      setBusy(null);
    }
  };

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Kata sandi disalin.');
    } catch {
      toast.error('Gagal menyalin. Salin manual dari kotak di atas.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title="Impor Anggota dari Excel"
        description="Unggah daftar siswa dalam format template. Baris yang bermasalah dilewati, bukan membatalkan seluruh berkas."
        size="lg"
        footer={
          result ? (
            <DialogClose asChild>
              <Button>Selesai</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={busy !== null}>
                  Batal
                </Button>
              </DialogClose>
              <Button
                variant="outline"
                disabled={!file || busy !== null}
                loading={busy === 'validate'}
                onClick={() => void upload('validate')}
              >
                Periksa dulu
              </Button>
              <Button
                disabled={!file || busy !== null || (preview !== null && preview.validRows === 0)}
                loading={busy === 'commit'}
                onClick={() => void upload('commit')}
              >
                <Upload className="size-4" aria-hidden />
                Impor {preview ? `${preview.validRows} baris` : 'sekarang'}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <ImportResultView result={result} onCopyPassword={copyPassword} />
        ) : (
          <div className="space-y-4">
            <Field
              label="Berkas Excel (.xlsx)"
              htmlFor="member-import-file"
              hint="Gunakan template resmi agar nama kolom sesuai."
              required
            >
              <input
                id="member-import-file"
                type="file"
                accept=".xlsx,.xls"
                disabled={busy !== null}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                className="block w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
              />
            </Field>

            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Yang dibuat otomatis</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>Kode anggota berurutan (MBR-TAHUN-NNN).</li>
                  <li>Satu kata sandi sementara untuk seluruh batch.</li>
                  <li>Setiap akun wajib mengganti kata sandi saat pertama masuk.</li>
                </ul>
              </div>
            </div>

            {preview ? <PreviewView preview={preview} /> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewView({ preview }: { preview: PreviewState }) {
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{preview.totalRows} baris dibaca</Badge>
        <Badge tone="success">{preview.validRows} siap diimpor</Badge>
        {preview.errorRows > 0 ? (
          <Badge tone="danger">{preview.errorRows} bermasalah</Badge>
        ) : null}
        {preview.duplicateRows > 0 ? (
          <Badge tone="warning">{preview.duplicateRows} duplikat</Badge>
        ) : null}
      </div>

      {preview.validRows === 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Tidak ada baris yang bisa diimpor. Perbaiki berkas lalu unggah ulang.
        </p>
      ) : null}

      {preview.errors.length > 0 ? (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">Baris yang bermasalah</caption>
            <thead>
              <tr className="bg-muted/50 text-left text-2xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Baris</th>
                <th scope="col" className="px-3 py-2 font-semibold">Kolom</th>
                <th scope="col" className="px-3 py-2 font-semibold">Masalah</th>
              </tr>
            </thead>
            <tbody>
              {preview.errors.map((err, i) => (
                <tr key={`${err.row}-${err.field}-${i}`} className="border-t border-border/60">
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{err.row}</td>
                  <td className="px-3 py-1.5 font-medium">{err.field}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ImportResultView({
  result,
  onCopyPassword,
}: {
  result: MemberImportSummary;
  onCopyPassword: (password: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-success/30 bg-success-soft p-3">
        <p className="text-sm font-semibold text-success">
          {result.inserted} anggota berhasil dibuat
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {result.memberCodes[0] ?? '-'} sampai {result.memberCodes[result.memberCodes.length - 1] ?? '-'}
          {result.errorRows > 0 ? ` · ${result.errorRows} baris dilewati` : ''}
        </p>
      </div>

      <div className="rounded-lg border border-warning/30 bg-warning-soft p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-warning-foreground">
          <AlertTriangle className="size-4" aria-hidden />
          Kata sandi sementara — hanya tampil sekali
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 select-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
            {result.batchPassword}
          </code>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Salin kata sandi"
            onClick={() => onCopyPassword(result.batchPassword)}
          >
            <Copy className="size-3.5" aria-hidden />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Bagikan sekarang. Setelah dialog ini ditutup, kata sandi tidak dapat ditampilkan lagi —
          gunakan tombol atur ulang kata sandi per anggota bila terlanjur hilang.
        </p>
      </div>

      {result.errors.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
            Baris yang dilewati
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {result.errors.map((err, i) => (
              <li key={`${err.row}-${err.field}-${i}`}>
                Baris {err.row} · {err.field}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
