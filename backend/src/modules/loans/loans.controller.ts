import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { forbidden } from '../../lib/errors';
import { logActivity } from '../activity/activity.service';
import {
  adminUpdateNote,
  approveLoan,
  cancelLoan,
  confirmBorrow,
  confirmReturn as confirmReturnAction,
  getLoanById,
  listLoans,
  listMyLoans,
  rejectLoan,
  requestLoan,
  requestReturn as requestReturnAction,
} from './loans.service';
import type {
  ConfirmReturnInput,
  LoanQuery,
  RejectLoanInput,
  RequestLoanInput,
} from './loans.schema';

/** Non-admins are silently scoped to their own rows. */
function scopeOf(req: Request): number | undefined {
  return req.user!.role === 'admin' ? undefined : req.user!.id;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listLoans(req.query as unknown as LoanQuery, scopeOf(req));
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const result = await listMyLoans(req.user!.id, req.query as unknown as LoanQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const loan = await getLoanById(Number(req.params.id), scopeOf(req));
  res.json({ success: true, data: loan });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RequestLoanInput;
  const result = await requestLoan(req.user!.id, body.bookId, body.note);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'loan.request',
    entityType: 'loan',
    entityId: result.loan.id,
    description: `${req.user!.fullName} mengajukan peminjaman "${result.loan.book.title}"`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: result.loan,
    message: result.requiresApproval
      ? 'Permohonan peminjaman terkirim. Menunggu persetujuan petugas.'
      : 'Buku berhasil dipinjam. Selamat membaca!',
  });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const note = (req.body as { note?: string }).note;
  const loan = await approveLoan(id, req.user!.id, note);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'loan.approve',
    entityType: 'loan',
    entityId: id,
    description: `Menyetujui peminjaman "${loan.book.title}" untuk ${loan.member.fullName}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: loan,
    message: loan.status === 'approved'
      ? 'Permohonan disetujui. Satu eksemplar telah dicadangkan untuk peminjam.'
      : 'Peminjaman dikonfirmasi.',
  });
});

export const borrow = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const loan = await confirmBorrow(id);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'loan.approve',
    entityType: 'loan',
    entityId: id,
    description: `Buku "${loan.book.title}" diserahkan ke ${loan.member.fullName}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: loan, message: 'Buku ditandai sudah dipinjam.' });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as RejectLoanInput;
  const loan = await rejectLoan(id, req.user!.id, body);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'loan.reject',
    entityType: 'loan',
    entityId: id,
    description: `Menolak peminjaman "${loan.book.title}" untuk ${loan.member.fullName}`,
    metadata: { reason: body.reason },
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: loan, message: 'Permohonan ditolak.' });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const isAdmin = req.user!.role === 'admin';
  const loan = await cancelLoan(id, req.user!.id, isAdmin);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'loan.cancel',
    entityType: 'loan',
    entityId: id,
    description: `Membatalkan peminjaman "${loan.book.title}"`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: loan, message: 'Permohonan peminjaman dibatalkan.' });
});

export const requestReturn = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const isAdmin = req.user!.role === 'admin';
  const loan = await requestReturnAction(id, req.user!.id, isAdmin);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'loan.return_request',
    entityType: 'loan',
    entityId: id,
    description: `Mengajukan pengembalian "${loan.book.title}"`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: loan,
    message: 'Permintaan pengembalian terkirim. Serahkan buku kepada petugas untuk verifikasi.',
  });
});

export const confirmReturn = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as ConfirmReturnInput;
  const loan = await confirmReturnAction(id, req.user!.id, body);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'loan.return_confirm',
    entityType: 'loan',
    entityId: id,
    description: `Menerima pengembalian "${loan.book.title}" dari ${loan.member.fullName}`,
    metadata: { condition: body.condition ?? 'good', daysLate: loan.daysLate },
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: loan,
    message:
      loan.daysLate && loan.daysLate > 0
        ? `Pengembalian tercatat. Buku terlambat ${loan.daysLate} hari.`
        : 'Pengembalian berhasil dicatat.',
  });
});

export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const note = (req.body as { note?: string }).note ?? '';
  if (note.length > 255) throw forbidden('Catatan terlalu panjang.');
  const loan = await adminUpdateNote(id, note);
  res.json({ success: true, data: loan, message: 'Catatan disimpan.' });
});
