import { query, type RowDataPacket } from '../../config/db';
import { notify } from './notifications.service';

/**
 * Materialises reminders for one member.
 *
 * Reminders are DERIVED from `due_at`, never scheduled. The alternative - a
 * cron job that writes "your book is due in 2 days" - needs the server to be
 * running on exactly the right morning; if it is not, the reminder silently
 * never happens. Computing it on read means the message appears the first time
 * the member opens the app after crossing the threshold, which is precisely
 * when it is useful.
 *
 * `dedupe_key` makes this idempotent: the same loan cannot produce the same
 * reminder twice, no matter how often this runs.
 */
export async function generateReminders(userId: number): Promise<void> {
  const rows = await query<
    RowDataPacket & {
      id: number;
      title: string;
      due_at: string | null;
      days_left: number | null;
    }
  >(
    `SELECT l.id, b.title, l.due_at,
            DATEDIFF(l.due_at, NOW()) AS days_left
       FROM loans l
       JOIN books b ON b.id = l.book_id
      WHERE l.user_id = ?
        AND l.status IN ('borrowed','return_requested')
        AND l.due_at IS NOT NULL
        AND DATEDIFF(l.due_at, NOW()) <= 2`,
    [userId],
  );

  for (const row of rows) {
    const daysLeft = Number(row.days_left ?? 0);
    const dueDate = row.due_at?.slice(0, 10) ?? '';

    if (daysLeft < 0) {
      await notify({
        userId,
        type: 'loan.overdue',
        title: 'Buku terlambat dikembalikan',
        body: `"${row.title}" sudah lewat ${Math.abs(daysLeft)} hari dari jatuh tempo. Kembalikan segera agar denda tidak bertambah.`,
        link: '/perpustakaan/pinjaman',
        dedupeKey: `due-overdue-${row.id}-${dueDate}`,
      });
    } else if (daysLeft === 0) {
      await notify({
        userId,
        type: 'loan.due_soon',
        title: 'Jatuh tempo hari ini',
        body: `"${row.title}" harus dikembalikan hari ini.`,
        link: '/perpustakaan/pinjaman',
        dedupeKey: `due-today-${row.id}-${dueDate}`,
      });
    } else {
      await notify({
        userId,
        type: 'loan.due_soon',
        title: `Jatuh tempo ${daysLeft} hari lagi`,
        body: `"${row.title}" jatuh tempo pada ${dueDate}.`,
        link: '/perpustakaan/pinjaman',
        dedupeKey: `due-soon-${row.id}-${dueDate}`,
      });
    }
  }

  // Approved-but-not-collected holds get one nudge while there is still time.
  const holds = await query<
    RowDataPacket & { id: number; title: string; pickup_deadline: string | null }
  >(
    `SELECT l.id, b.title, l.pickup_deadline
       FROM loans l
       JOIN books b ON b.id = l.book_id
      WHERE l.user_id = ?
        AND l.status = 'approved'
        AND l.pickup_deadline IS NOT NULL
        AND l.pickup_deadline < DATE_ADD(NOW(), INTERVAL 1 DAY)`,
    [userId],
  );

  for (const hold of holds) {
    await notify({
      userId,
      type: 'loan.approved',
      title: 'Segera ambil buku Anda',
      body: `"${hold.title}" menunggu di meja petugas. Batas ambil ${hold.pickup_deadline?.slice(0, 16) ?? '-'}.`,
      link: '/perpustakaan/pinjaman',
      dedupeKey: `pickup-reminder-${hold.id}`,
    });
  }
}
