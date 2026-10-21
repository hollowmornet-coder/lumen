import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Medal, Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeaderboard } from '@/hooks/useApi';
import { cn, formatNumber } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types';

const MEDALS = [Crown, Trophy, Medal] as const;

/**
 * Top readers of the library.
 *
 * Only members who have actually borrowed appear (the server excludes the
 * rest), so an empty board honestly means "nobody has borrowed yet" rather
 * than "everyone is rank 1". The signed-in member's own row is highlighted.
 */
export function LeaderboardCard({ limit = 8, className }: { limit?: number; className?: string }) {
  const board = useLeaderboard(limit);
  const { user } = useAuth();
  const reduce = useReducedMotion();

  return (
    <section className={cn('panel overflow-hidden', className)} aria-label="Peringkat pembaca">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Peringkat Pembaca
          </h2>
          <p className="text-xs text-muted-foreground">
            Diurutkan dari jumlah buku yang benar-benar dipinjam
          </p>
        </div>
        <Trophy className="size-4 text-warning" aria-hidden />
      </header>

      {board.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : board.isError ? (
        <p className="px-5 py-6 text-xs text-muted-foreground">
          Peringkat belum dapat dimuat.
        </p>
      ) : !board.data || board.data.length === 0 ? (
        <p className="px-5 py-6 text-xs leading-relaxed text-muted-foreground">
          Belum ada yang meminjam buku. Pinjaman pertama Anda akan langsung tercatat di sini.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {board.data.map((entry: LeaderboardEntry, index) => {
            const isMe = entry.id === user?.id;
            const Medal = MEDALS[index];

            return (
              <motion.li
                key={entry.id}
                initial={reduce ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: reduce ? 0 : index * 0.03 }}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  isMe && 'bg-electric-soft',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                    index < 3
                      ? 'bg-warning-soft text-warning'
                      : 'bg-muted text-muted-foreground',
                  )}
                  aria-label={`Peringkat ${entry.rank}`}
                >
                  {Medal ? <Medal className="size-3.5" aria-hidden /> : entry.rank}
                </span>

                <Avatar name={entry.fullName} src={entry.avatarPath} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {entry.fullName}
                    {isMe ? (
                      <span className="ml-1.5 text-2xs font-normal text-muted-foreground">
                        (Anda)
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <LevelBadge level={entry.level} showNumber={false} />
                    {entry.className ? (
                      <span className="truncate text-2xs text-muted-foreground">
                        {entry.className}
                      </span>
                    ) : null}
                  </div>
                </div>

                <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                  {formatNumber(entry.totalBorrowed)}
                </span>
              </motion.li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
