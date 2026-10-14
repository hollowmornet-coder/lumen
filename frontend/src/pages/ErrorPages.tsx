import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageBody } from '@/components/layout/PageHeader';

export function NotFoundPage() {
  return (
    <PageBody className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-display text-6xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="font-display text-xl font-semibold">Halaman tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground">
          Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button asChild>
            <Link to="/">
              <Home className="size-4" aria-hidden />
              Kembali ke beranda
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/katalog">
              <Search className="size-4" aria-hidden />
              Buka katalog
            </Link>
          </Button>
        </div>
      </div>
    </PageBody>
  );
}

export function ForbiddenPage() {
  return (
    <PageBody className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-display text-6xl font-semibold tracking-tight text-destructive">403</p>
        <h1 className="font-display text-xl font-semibold">Akses ditolak</h1>
        <p className="text-sm text-muted-foreground">
          Anda tidak memiliki izin untuk membuka halaman ini. Hubungi petugas perpustakaan jika
          Anda merasa ini keliru.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button asChild>
            <Link to="/">
              <Home className="size-4" aria-hidden />
              Kembali ke beranda
            </Link>
          </Button>
        </div>
      </div>
    </PageBody>
  );
}
