import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Top-level error boundary.
 *
 * Without this, a render-time exception in any page would blank the screen
 * with no way back. Catching it here keeps the app recoverable.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep the detail in the console for debugging; the UI stays generic.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center bg-background px-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive-soft">
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
          </div>
          <h1 className="font-display text-xl font-semibold">Terjadi kesalahan</h1>
          <p className="text-sm text-muted-foreground">
            Aplikasi gagal menampilkan halaman ini. Muat ulang halaman untuk mencoba kembali.
          </p>
          {import.meta.env.DEV ? (
            <pre className="scrollbar-thin max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-left text-2xs text-destructive">
              {this.state.error.message}
            </pre>
          ) : null}
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" aria-hidden />
            Muat ulang
          </Button>
        </div>
      </div>
    );
  }
}
