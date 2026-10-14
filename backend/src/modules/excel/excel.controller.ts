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
  buildLoansWorkbook,
  buildMembersWorkbook,
  buildTemplateWorkbook,
  parseBooksWorkbook,
} from './excel.service';

function sendWorkbook(res: Response, buffer: Buffer, filename: string): void {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
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
