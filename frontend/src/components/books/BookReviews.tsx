import * as React from 'react';
import { MessageSquareQuote, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { StarRating } from '@/components/ui/star-rating';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import {
  useApiMutation,
  useMyReview,
  useMyLoans,
  useReviews,
  useReviewStats,
} from '@/hooks/useApi';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import type { Review } from '@/types';

/**
 * Reviews and ratings for one title.
 *
 * Two rules shape this component:
 *
 *  1. One review per member per book. The form therefore edits the existing row
 *     instead of adding another, which is why the button reads "Perbarui" once
 *     a review exists.
 *  2. The "must have borrowed it" policy lives on the server. The UI only hides
 *     the form when the member clearly has no loan history, and the server
 *     message is surfaced if the two ever disagree.
 */
export function BookReviews({ bookId }: { bookId: number }) {
  const { isAdmin } = useAuth();
  const reviews = useReviews({ bookId, pageSize: 20 });
  const stats = useReviewStats(bookId);
  const mine = useMyReview(bookId);
  const myLoans = useMyLoans({ pageSize: 50 });

  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  // Hydrate the form from an existing review exactly once per fetch, so typing
  // is never overwritten by a background refetch.
  const hydratedRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const current = mine.data;
    if (!current) {
      if (hydratedRef.current !== null) {
        hydratedRef.current = null;
        setRating(0);
        setComment('');
      }
      return;
    }
    if (hydratedRef.current === current.id) return;
    hydratedRef.current = current.id;
    setRating(current.rating);
    setComment(current.comment ?? '');
  }, [mine.data]);

  const hasBorrowed = (myLoans.data?.items ?? []).some(
    (loan) =>
      loan.bookId === bookId &&
      ['borrowed', 'return_requested', 'returned'].includes(loan.status),
  );

  const save = useApiMutation<{ rating: number; comment: string }, Review>({
    mutationFn: async (body) =>
      (
        await api.post<Review>(`/reviews/book/${bookId}`, {
          rating: body.rating,
          comment: body.comment.trim() || undefined,
        })
      ).data,
    successMessage: 'Ulasan tersimpan.',
    invalidate: [
      ['reviews'],
      ['reviews', 'stats', bookId],
      ['reviews', 'mine', bookId],
    ],
    onSuccess: () => setEditing(false),
  });

  const remove = useApiMutation<number, unknown>({
    mutationFn: async (id) => (await api.delete(`/reviews/${id}`)).data,
    successMessage: 'Ulasan dihapus.',
    invalidate: [
      ['reviews'],
      ['reviews', 'stats', bookId],
      ['reviews', 'mine', bookId],
    ],
    onSuccess: () => {
      setRating(0);
      setComment('');
      setEditing(false);
    },
  });

  const items = reviews.data?.items ?? [];
  const average = stats.data?.average ?? 0;
  const total = stats.data?.total ?? 0;

  const canWrite = !isAdmin && (hasBorrowed || Boolean(mine.data));

  return (
    <section className="panel p-5" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="reviews-heading" className="font-display text-base font-semibold">
            Ulasan &amp; Rating
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pendapat pembaca yang pernah meminjam buku ini.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StarRating value={average} readOnly size="sm" label={`Rata-rata ${average} dari 5`} />
          <span className="font-display text-lg font-semibold tabular-nums">
            {average.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">({total})</span>
        </div>
      </div>

      {/* ---------- Distribution ---------- */}
      {total > 0 && stats.data ? (
        <ul className="mt-3 space-y-1" aria-label="Sebaran rating">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = stats.data.distribution[String(star)] ?? 0;
            const pct = total === 0 ? 0 : (count / total) * 100;
            return (
              <li key={star} className="flex items-center gap-2 text-2xs text-muted-foreground">
                <span className="w-8 shrink-0 tabular-nums">{star}★</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-warning"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* ---------- Write / edit ---------- */}
      {canWrite ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          {mine.data && !editing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <StarRating value={mine.data.rating} readOnly size="sm" />
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {mine.data.comment || <em>Tanpa komentar</em>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Ubah ulasan
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Hapus ulasan Anda"
                  onClick={() => remove.mutate(mine.data!.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (rating === 0) return;
                save.mutate({ rating, comment });
              }}
              className="space-y-3"
            >
              <Field label="Penilaian Anda" htmlFor={`rating-${bookId}`}>
                <div id={`rating-${bookId}`}>
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>
              </Field>

              <Field
                label="Komentar"
                htmlFor={`comment-${bookId}`}
                hint="Opsional, maksimal 1000 karakter."
              >
                <Textarea
                  id={`comment-${bookId}`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Apa yang membuat buku ini berkesan?"
                />
              </Field>

              <div className="flex items-center justify-end gap-2">
                {editing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                  >
                    Batal
                  </Button>
                ) : null}
                <Button type="submit" size="sm" loading={save.isPending} disabled={rating === 0}>
                  {mine.data ? 'Perbarui ulasan' : 'Kirim ulasan'}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : !isAdmin ? (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Ulasan hanya dapat ditulis setelah Anda meminjam buku ini. Setelah dikembalikan, tombol
          ulasan akan muncul di sini.
        </p>
      ) : null}

      {/* ---------- List ---------- */}
      <div className="mt-4">
        {reviews.isLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Memuat ulasan...</p>
        ) : reviews.isError ? (
          <ErrorState
            message={reviews.error instanceof Error ? reviews.error.message : undefined}
            onRetry={() => void reviews.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title="Belum ada ulasan"
            description="Jadilah yang pertama menuliskan pendapat tentang buku ini."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                canDelete={isAdmin || review.userId === mine.data?.userId}
                onDelete={() => remove.mutate(review.id)}
                deleting={remove.isPending}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ReviewRow({
  review,
  canDelete,
  onDelete,
  deleting,
}: {
  review: Review;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{review.memberName}</span>
            {review.className ? (
              <Badge tone="neutral" className="text-2xs">
                {review.className}
              </Badge>
            ) : null}
            <StarRating value={review.rating} readOnly size="sm" />
          </div>
          {review.comment ? (
            <p className={cn('mt-1 whitespace-pre-line text-sm text-muted-foreground')}>
              {review.comment}
            </p>
          ) : null}
          <p className="mt-1 text-2xs text-muted-foreground">{formatDate(review.createdAt)}</p>
        </div>

        {canDelete ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Hapus ulasan"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </li>
  );
}
