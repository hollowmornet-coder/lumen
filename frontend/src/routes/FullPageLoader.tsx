import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { EASE_OUT } from '@/lib/motion';

/** Branded loader used while the session is being restored. */
export function FullPageLoader({ label = 'Menyiapkan perpustakaan...' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="flex flex-col items-center gap-3"
      >
        <div className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-glow">
          <BookOpen className="size-6 text-white" aria-hidden />
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-primary/50" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </motion.div>
    </div>
  );
}
