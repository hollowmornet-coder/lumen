import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { badRequest } from '../../lib/errors';
import { listCategories } from '../books/categories.service';
import { bulkCreateBooks, listBooks } from '../books/books.service';
import type { BookQuery } from '../books/books.schema';
import { listMembers } from '../members/members.service';
import type { MemberQuery } from '../members/members.schema';
import { listLoans } from '../loans/loans.service';
import type { LoanQuery } from '../loans/loans.schema';
import { getSettings } from '../settings/settings.service';
import { logActivity } from '../activity/activity.service';
import {
  buildBooksWorkbook,
  buildFinesWorkbook,
  buildLoansWorkbook,
  buildMembersTemplateWorkbook,
  buildMembersWorkbook,
  buildTemplateWorkbook,
  generateBatchPassword,
  parseBooksWorkbook,
  parseMembersWorkbook,
} from './excel.service';
import { bulkCreateMembers, findExistingIdentities } from '../members/members.service';
import { listFines } from '../fines/fines.service';
import type { FineQuery } from '../fines/fines.schema';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

function sendWorkbook(res: Response, buffer: Buffer, filename: string): void {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
}

/** Local calendar date for the filename; UTC would name a morning export "yesterday". */
function stamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Excel exports are capped so a huge request cannot exhaust server memory. */
const MAX_EXPORT_ROWS = 5000;

export const exportBooks = asyncHandler(async (req: Request, res: Response) => {
  const result = await listBooks({
    ...(req.query as unknown as BookQuery),
    page: 1,
    pageSize: MAX_EXPORT_ROWS,
  });

  if (result.meta.total > MAX_EXPORT_ROWS) {
    throw badRequest(
      `Data melebihi batas ${MAX_EXPORT_ROWS} baris. Persempit dengan filter sebelum mengekspor.`,
    );
  }

  const buffer = await buildBooksWorkbook(result.items);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'data.export',
    entityType: 'book',
    description: `Mengekspor ${result.items.length} data buku ke Excel`,
    ipAddress: req.ip ?? undefined,
  });
  sendWorkbook(res, buffer, `lumen-buku-${stamp()}.xlsx`);
});

export const exportMembers = asyncHandler(async (req: Request, res: Response) => {
  const result = await listMembers({
    ...(req.query as unknown as MemberQuery),
    page: 1,
    pageSize: MAX_EXPORT_ROWS,
  });

  if (result.meta.total > MAX_EXPORT_ROWS) {
    throw badRequest(
      `Data melebihi batas ${MAX_EXPORT_ROWS} baris. Persempit dengan filter sebelum mengekspor.`,
    );
  }

  const buffer = await buildMembersWorkbook(result.items);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'data.export',
    entityType: 'member',
    description: `Mengekspor ${result.items.length} data anggota ke Excel`,
    ipAddress: req.ip ?? undefined,
  });
  sendWorkbook(res, buffer, `lumen-anggota-${stamp()}.xlsx`);
});

export const exportLoans = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as LoanQuery;
  const result = await listLoans(query);
  const settings = await getSettings();

  const rangeLabel = query.from || query.to ? `${query.from ?? '-'} s/d ${query.to ?? '-'}` : 'Semua periode';

  const buffer = await buildLoansWorkbook(result.items, settings, rangeLabel);
  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'data.export',
    entityType: 'loan',
    description: `Mengekspor ${result.items.length} transaksi ke Excel`,
    ipAddress: req.ip ?? undefined,
  });
  sendWorkbook(res, buffer, `lumen-transaksi-${stamp()}.xlsx`);
});

export const downloadTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const buffer = await buildTemplateWorkbook();
  sendWorkbook(res, buffer, 'lumen-template-impor-buku.xlsx');
});

export const downloadMemberTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const buffer = await buildMembersTemplateWorkbook();
  sendWorkbook(res, buffer, 'lumen-template-impor-anggota.xlsx');
});

/**
 * Import books from an uploaded workbook.
 *
 * `mode=validate` only reports what would happen. `mode=commit` writes the
 * valid rows inside a single transaction, so a failure leaves the catalogue
 * untouched.
 */
export const importBooks = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw badRequest('Tidak ada berkas yang diunggah.');

  const mode = (req.query.mode as string) ?? 'commit';
  if (mode !== 'validate' && mode !== 'commit') {
    throw badRequest('Mode harus berupa validate atau commit.');
  }

  const categories = await listCategories();
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  const parsed = await parseBooksWorkbook(req.file.buffer, categoryMap);

  if (mode === 'validate') {
    res.json({
      success: true,
      data: {
        dryRun: true,
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        errorRows: parsed.errorRows,
        duplicateRows: parsed.duplicateRows,
        errors: parsed.errors.slice(0, 100),
      },
      message: 'Validasi selesai. Tidak ada data yang disimpan.',
    });
    return;
  }

  if (parsed.data.length === 0) {
    res.status(422).json({
      success: false,
      code: 'IMPORT_FAILED',
      message: 'Tidak ada baris valid untuk disimpan.',
      data: {
        totalRows: parsed.totalRows,
        validRows: 0,
        errorRows: parsed.errorRows,
        duplicateRows: parsed.duplicateRows,
        errors: parsed.errors.slice(0, 100),
      },
    });
    return;
  }

  // bulkCreateBooks runs in one transaction: all-or-nothing.
  const { inserted } = await bulkCreateBooks(parsed.data);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'book.import',
    entityType: 'book',
    description: `Mengimpor ${inserted} buku dari Excel (${parsed.errors.length} baris bermasalah dilewati)`,
    metadata: { inserted, errorRows: parsed.errorRows, duplicateRows: parsed.duplicateRows },
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: {
      inserted,
      totalRows: parsed.totalRows,
      validRows: parsed.validRows,
      errorRows: parsed.errorRows,
      duplicateRows: parsed.duplicateRows,
      errors: parsed.errors.slice(0, 100),
    },
    message: `${inserted} buku berhasil diimpor.${parsed.errorRows > 0 ? ` ${parsed.errorRows} baris bermasalah dilewati.` : ''}`,
  });
});

/**
 * Import members from an uploaded workbook.
 *
 * Mirrors the book importer: `validate` reports, `commit` writes. Accounts that
 * collide with an existing username or email are reported per row rather than
 * aborting the whole batch, because a class list usually contains one or two
 * students who already registered themselves.
 */
export const importMembers = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw badRequest('Tidak ada berkas yang diunggah.');

  const mode = (req.query.mode as string) ?? 'commit';
  if (mode !== 'validate' && mode !== 'commit') {
    throw badRequest('Mode harus berupa validate atau commit.');
  }

  const parsed = await parseMembersWorkbook(req.file.buffer);

  // Collisions with existing accounts are only knowable from the database, so
  // they are filtered here rather than inside the parser.
  const existing = await findExistingIdentities(
    parsed.data.map((r) => r.username),
    parsed.data.map((r) => r.email),
  );

  const accepted = parsed.data.filter(
    (r) =>
      !existing.usernames.has(r.username.toLowerCase()) &&
      !existing.emails.has(r.email.toLowerCase()),
  );
  const collisions = parsed.data.length - accepted.length;

  const summary = {
    totalRows: parsed.totalRows,
    validRows: accepted.length,
    errorRows: parsed.errorRows + collisions,
    duplicateRows: parsed.duplicateRows + collisions,
    errors: parsed.errors.slice(0, 100),
  };

  if (mode === 'validate') {
    res.json({
      success: true,
      data: { dryRun: true, ...summary },
      message: 'Validasi selesai. Tidak ada data yang disimpan.',
    });
    return;
  }

  if (accepted.length === 0) {
    res.status(422).json({
      success: false,
      code: 'IMPORT_FAILED',
      message: 'Tidak ada baris valid untuk disimpan.',
      data: { ...summary, validRows: 0 },
    });
    return;
  }

  // One hash for the whole batch: bcrypt at 10 rounds costs ~80 ms, so 500
  // individual hashes would block the request for ~40 s. Every imported
  // account is flagged `must_change_password` to compensate.
  const batchPassword = generateBatchPassword();
  const passwordHash = await bcrypt.hash(batchPassword, env.bcryptSaltRounds);

  const { inserted, memberCodes } = await bulkCreateMembers(accepted, passwordHash);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'member.import',
    entityType: 'member',
    description: `Mengimpor ${inserted} anggota dari Excel (${summary.errorRows} baris bermasalah dilewati)`,
    metadata: { inserted, errorRows: summary.errorRows, duplicateRows: summary.duplicateRows },
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: {
      inserted,
      memberCodes,
      ...summary,
      /**
       * Returned exactly once, in the response body. It is never stored in
       * plaintext and never logged; if the librarian loses it, the per-member
       * reset flow is the way back.
       */
      batchPassword,
    },
    message: `${inserted} anggota berhasil diimpor. Bagikan kata sandi sementara sebelum menutup halaman ini.`,
  });
});

/**
 * Fine ledger export.
 *
 * Reuses `listFines` so the export always matches what the admin sees on screen,
 * including the period filter and the same ordering.
 */
export const exportFines = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as FineQuery;
  const result = await listFines({ ...query, page: 1, pageSize: MAX_EXPORT_ROWS });

  if (result.meta.total > MAX_EXPORT_ROWS) {
    throw badRequest(
      `Data melebihi batas ${MAX_EXPORT_ROWS} baris. Persempit periode sebelum mengekspor.`,
    );
  }

  const rows = result.items.map((f) => ({
    createdAt: f.createdAt,
    memberName: f.member.fullName,
    memberCode: f.member.memberCode,
    className: f.member.className,
    kind: f.kind,
    amount: f.amount,
    status: f.status,
    settledAt: f.settledAt,
    loanCode: f.loanCode,
    bookTitle: f.book.title,
    note: f.note,
  }));

  const buffer = await buildFinesWorkbook(rows, { from: query.from, to: query.to });

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'data.export',
    entityType: 'fine',
    description: `Mengekspor ${rows.length} data denda ke Excel`,
    ipAddress: req.ip ?? undefined,
  });

  sendWorkbook(res, buffer, `lumen-denda-${stamp()}.xlsx`);
});
