import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { backdropVariants, dialogVariants } from '@/lib/motion';
import { buttonVariants } from './button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Modal built on Radix (focus trap, Escape to close, aria wiring) with a
 * short scale + fade enter. Scrolling is locked while it is open.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <AnimatePresence>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 bg-navy-950/45 backdrop-blur-[2px]"
          />
        </DialogPrimitive.Overlay>

        <DialogPrimitive.Content asChild {...props}>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              variants={dialogVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={cn(
                'relative w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto scrollbar-thin rounded-2xl',
                'glass-strong',
                SIZES[size],
                className,
              )}
            >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="space-y-1">
                <DialogPrimitive.Title className="font-display text-lg font-semibold text-foreground">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Tutup dialog"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="px-6 py-5">{children}</div>

            {footer ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
          </div>
        </DialogPrimitive.Content>
      </AnimatePresence>
    </DialogPrimitive.Portal>
  );
}

/* ------------------------------------------------------------------
   Confirmation dialog for destructive / irreversible actions.
   ------------------------------------------------------------------ */

export const ConfirmDialog = AlertDialogPrimitive.Root;
export const ConfirmTrigger = AlertDialogPrimitive.Trigger;

interface ConfirmContentProps {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
}

export function ConfirmContent({
  title,
  description,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger',
  onConfirm,
  children,
}: ConfirmContentProps) {
  const [busy, setBusy] = React.useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialogPrimitive.Portal>
      <AnimatePresence>
        <AlertDialogPrimitive.Overlay asChild forceMount>
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-[2px]"
          />
        </AlertDialogPrimitive.Overlay>

        <AlertDialogPrimitive.Content asChild>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              variants={dialogVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative w-[calc(100vw-2rem)] max-w-md rounded-2xl p-6 glass-strong"
            >
            <AlertDialogPrimitive.Title className="font-display text-lg font-semibold">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description asChild>
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </div>
            </AlertDialogPrimitive.Description>

            <div className="mt-2" onClick={(e) => e.preventDefault()}>
              {children}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <button type="button" className={cn(buttonVariants({ variant: 'outline' }))} disabled={busy}>
                  {cancelLabel}
                </button>
              </AlertDialogPrimitive.Cancel>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                aria-busy={busy || undefined}
                className={cn(buttonVariants({ variant: tone === 'danger' ? 'danger' : 'primary' }))}
              >
                {busy ? 'Memproses...' : confirmLabel}
              </button>
            </div>
          </motion.div>
          </div>
        </AlertDialogPrimitive.Content>
      </AnimatePresence>
    </AlertDialogPrimitive.Portal>
  );
}
