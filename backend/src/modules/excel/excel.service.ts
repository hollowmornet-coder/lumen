import ExcelJS from 'exceljs';
import { createBookSchema, type CreateBookInput } from '../books/books.schema';
import { createMemberSchema } from '../members/members.schema';
import type { Book } from '../books/books.types';
import type { Member } from '../members/members.service';
import type { Loan } from '../loans/loans.service';
import { findBooksByIsbnList } from '../books/books.service';
import type { LibrarySettings } from '../settings/settings.service';

/**
 * Excel files can contain formulas. If a cell value starts with `=`, `+`, `-`
 * or `@`, a spreadsheet app will evaluate it when the file is opened.
 * Prefixing with an apostrophe forces the value to be treated as plain text.
 * This is the standard CSV/Excel injection guard.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

export function sanitiseCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'YA' : 'TIDAK';

  let text = String(value);
  if (text.length > 0 && FORMULA_TRIGGERS.includes(text[0])) {
    text = `'${text}`;
  }
  // Excel hard-limits a cell to 32,767 characters.
  return text.slice(0, 32_767);
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1C1917' },
};

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 22;
}

function newWorkbook(creator: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = creator;
  wb.created = new Date();
  return wb;
}

// =====================================================================
//  EXPORT
// =====================================================================

export async function buildBooksWorkbook(books: Book[]): Promise<Buffer> {
  const wb = newWorkbook('LUMEN - Sistem Perpustakaan Sekolah Digital');
  const ws = wb.addWorksheet('Buku', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'ISBN', key: 'isbn', width: 20 },
    { header: 'Judul', key: 'title', width: 38 },
    { header: 'Penulis', key: 'author', width: 24 },
    { header: 'Penerbit', key: 'publisher', width: 20 },
    { header: 'Tahun', key: 'publishYear', width: 10 },
    { header: 'Kategori', key: 'categoryName', width: 20 },
    { header: 'Lokasi Rak', key: 'shelfLocation', width: 14 },
    { header: 'Total Eksemplar', key: 'totalCopies', width: 16 },
    { header: 'Tersedia', key: 'availableCopies', width: 12 },
    { header: 'Dipinjam', key: 'borrowedCopies', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Deskripsi', key: 'description', width: 50 },
  ];
  styleHeader(ws.getRow(1));

  for (const b of books) {
    ws.addRow({
      isbn: sanitiseCell(b.isbn),
      title: sanitiseCell(b.title),
      author: sanitiseCell(b.author),
      publisher: sanitiseCell(b.publisher),
      publishYear: b.publishYear ?? null,
      categoryName: sanitiseCell(b.categoryName),
      shelfLocation: sanitiseCell(b.shelfLocation),
      totalCopies: b.totalCopies,
      availableCopies: b.availableCopies,
      borrowedCopies: b.borrowedCopies,
      status: b.status === 'active' ? 'Aktif' : 'Nonaktif',
      description: sanitiseCell(b.description),
    });
  }

  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columnCount } };
  return toBuffer(wb);
}

export async function buildMembersWorkbook(members: Member[]): Promise<Buffer> {
  const wb = newWorkbook('LUMEN - Sistem Perpustakaan Sekolah Digital');
  const ws = wb.addWorksheet('Anggota', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Kode Anggota', key: 'memberCode', width: 18 },
    { header: 'Nama Lengkap', key: 'fullName', width: 28 },
    { header: 'Username', key: 'username', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Kelas', key: 'className', width: 14 },
    { header: 'Telepon', key: 'phone', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Pinjaman Aktif', key: 'activeLoans', width: 16 },
    { header: 'Total Peminjaman', key: 'totalLoans', width: 18 },
    { header: 'Terakhir Masuk', key: 'lastLoginAt', width: 20 },
  ];
  styleHeader(ws.getRow(1));

  for (const m of members) {
    ws.addRow({
      memberCode: sanitiseCell(m.memberCode),
      fullName: sanitiseCell(m.fullName),
      username: sanitiseCell(m.username),
      email: sanitiseCell(m.email),
      className: sanitiseCell(m.className),
      phone: sanitiseCell(m.phone),
      status: m.status === 'active' ? 'Aktif' : 'Nonaktif',
      activeLoans: m.activeLoans,
      totalLoans: m.totalLoans,
      lastLoginAt: sanitiseCell(m.lastLoginAt),
    });
  }

  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columnCount } };
  return toBuffer(wb);
}

export async function buildLoansWorkbook(
  loans: Loan[],
  settings: LibrarySettings,
  rangeLabel: string,
): Promise<Buffer> {
  const wb = newWorkbook('LUMEN - Sistem Perpustakaan Sekolah Digital');
  const ws = wb.addWorksheet('Transaksi', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Kode Transaksi', key: 'loanCode', width: 24 },
    { header: 'Anggota', key: 'member', width: 26 },
    { header: 'Kode Anggota', key: 'memberCode', width: 18 },
    { header: 'Judul Buku', key: 'title', width: 34 },
    { header: 'ISBN', key: 'isbn', width: 20 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Diajukan', key: 'requestedAt', width: 20 },
    { header: 'Disetujui', key: 'approvedAt', width: 20 },
    { header: 'Dipinjam', key: 'borrowedAt', width: 20 },
    { header: 'Jatuh Tempo', key: 'dueAt', width: 20 },
    { header: 'Dikembalikan', key: 'returnedAt', width: 20 },
    { header: 'Hari Telat', key: 'daysLate', width: 12 },
    { header: 'Denda', key: 'lateFee', width: 14 },
    { header: 'Kondisi', key: 'condition', width: 14 },
  ];
  styleHeader(ws.getRow(1));

  const STATUS_LABEL: Record<string, string> = {
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    borrowed: 'Dipinjam',
    return_requested: 'Ajukan Kembali',
    returned: 'Selesai',
    cancelled: 'Dibatalkan',
    overdue: 'Terlambat',
  };
  const CONDITION_LABEL: Record<string, string> = {
    good: 'Baik',
    damaged: 'Rusak',
    lost: 'Hilang',
  };

  for (const l of loans) {
    ws.addRow({
      loanCode: sanitiseCell(l.loanCode),
      member: sanitiseCell(l.member.fullName),
      memberCode: sanitiseCell(l.member.memberCode),
      title: sanitiseCell(l.book.title),
      isbn: sanitiseCell(l.book.isbn),
      status: STATUS_LABEL[l.displayStatus] ?? l.displayStatus,
      requestedAt: sanitiseCell(l.requestedAt),
      approvedAt: sanitiseCell(l.approvedAt),
      borrowedAt: sanitiseCell(l.borrowedAt),
      dueAt: sanitiseCell(l.dueAt),
      returnedAt: sanitiseCell(l.returnedAt),
      daysLate: l.daysLate ?? 0,
      lateFee: l.lateFee ?? 0,
      condition: l.returnCondition ? (CONDITION_LABEL[l.returnCondition] ?? l.returnCondition) : '',
    });
  }

  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columnCount } };

  // A small summary sheet makes the export usable as a report on its own.
  const info = wb.addWorksheet('Ringkasan');
  info.columns = [
    { header: 'Laporan', key: 'k', width: 32 },
    { header: 'Nilai', key: 'v', width: 28 },
  ];
  styleHeader(info.getRow(1));
  info.addRow({ k: 'Periode', v: rangeLabel });
  info.addRow({ k: 'Jumlah transaksi', v: loans.length });
  info.addRow({ k: 'Denda keterlambatan / hari', v: settings.lateFeePerDay });
  info.addRow({ k: 'Dicetak pada', v: new Date().toLocaleString('id-ID') });

  return toBuffer(wb);
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const data = await wb.xlsx.writeBuffer();
  return Buffer.from(data);
}

export interface FineExportRow {
  createdAt: string;
  memberName: string;
  memberCode: string | null;
  className: string | null;
  kind: string;
  amount: number;
  status: string;
  settledAt: string | null;
  loanCode: string;
  bookTitle: string;
  note: string | null;
}

const FINE_KIND_LABEL: Record<string, string> = {
  late: 'Keterlambatan',
  damaged: 'Rusak',
  lost: 'Hilang',
};

const FINE_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Belum dibayar',
  paid: 'Lunas',
  waived: 'Dibebaskan',
};

/**
 * Fine ledger for a period.
 *
 * The summary sheet is what a treasurer actually signs: total collected, total
 * waived, and total still owed. Totals are computed from the rows passed in, so
 * they always describe exactly the data in the sheet.
 */
export async function buildFinesWorkbook(
  fines: FineExportRow[],
  range: { from?: string; to?: string },
): Promise<Buffer> {
  const wb = newWorkbook('LUMEN - Sistem Perpustakaan Sekolah Digital');
  const ws = wb.addWorksheet('Denda', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Tanggal', key: 'createdAt', width: 20 },
    { header: 'Kode Anggota', key: 'memberCode', width: 18 },
    { header: 'Nama Anggota', key: 'memberName', width: 26 },
    { header: 'Kelas', key: 'className', width: 12 },
    { header: 'Jenis Denda', key: 'kind', width: 16 },
    { header: 'Jumlah', key: 'amount', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Dibayar Pada', key: 'settledAt', width: 20 },
    { header: 'Kode Pinjam', key: 'loanCode', width: 20 },
    { header: 'Buku', key: 'bookTitle', width: 34 },
    { header: 'Catatan', key: 'note', width: 30 },
  ];
  styleHeader(ws.getRow(1));

  for (const f of fines) {
    ws.addRow({
      createdAt: sanitiseCell(f.createdAt),
      memberCode: sanitiseCell(f.memberCode),
      memberName: sanitiseCell(f.memberName),
      className: sanitiseCell(f.className),
      kind: FINE_KIND_LABEL[f.kind] ?? f.kind,
      amount: f.amount,
      status: FINE_STATUS_LABEL[f.status] ?? f.status,
      settledAt: sanitiseCell(f.settledAt),
      loanCode: sanitiseCell(f.loanCode),
      bookTitle: sanitiseCell(f.bookTitle),
      note: sanitiseCell(f.note),
    });
  }

  const paid = fines.filter((f) => f.status === 'paid');
  const waived = fines.filter((f) => f.status === 'waived');
  const unpaid = fines.filter((f) => f.status === 'unpaid');
  const sum = (rows: FineExportRow[]) => rows.reduce((acc, f) => acc + f.amount, 0);

  const rangeLabel =
    range.from || range.to
      ? `${range.from ?? 'awal'} s.d. ${range.to ?? 'sekarang'}`
      : 'Seluruh periode';

  const info = wb.addWorksheet('Ringkasan');
  info.columns = [
    { header: 'Laporan', key: 'k', width: 32 },
    { header: 'Nilai', key: 'v', width: 28 },
  ];
  styleHeader(info.getRow(1));
  info.addRow({ k: 'Periode', v: rangeLabel });
  info.addRow({ k: 'Jumlah baris denda', v: fines.length });
  info.addRow({ k: 'Lunas (Rp)', v: sum(paid) });
  info.addRow({ k: 'Dibebaskan (Rp)', v: sum(waived) });
  info.addRow({ k: 'Belum dibayar (Rp)', v: sum(unpaid) });
  info.addRow({ k: 'Dicetak pada', v: new Date().toLocaleString('id-ID') });

  return toBuffer(wb);
}

// =====================================================================
//  TEMPLATE + IMPORT
// =====================================================================

export const IMPORT_HEADERS = [
  'ISBN',
  'Judul',
  'Penulis',
  'Penerbit',
  'Tahun Terbit',
  'Kategori',
  'Lokasi Rak',
  'Jumlah Eksemplar',
  'Deskripsi',
] as const;

export async function buildTemplateWorkbook(): Promise<Buffer> {
  const wb = newWorkbook('LUMEN - Sistem Perpustakaan Sekolah Digital');
  const ws = wb.addWorksheet('Data Buku', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.addRow(IMPORT_HEADERS as unknown as string[]);
  styleHeader(ws.getRow(1));

  ws.columns = [
    { width: 20 }, { width: 38 }, { width: 24 }, { width: 20 },
    { width: 14 }, { width: 20 }, { width: 14 }, { width: 18 }, { width: 40 },
  ];

  // Two example rows so the format is obvious. They are clearly labelled and
  // are NOT inserted into the database - the import reads the real rows only.
  const example = ws.addRow([
    '978-602-03-0001-1', 'Contoh Judul Buku', 'Contoh Penulis', 'Contoh Penerbit',
    2024, 'Fiksi', 'F-01-01', 2, 'Deskripsi singkat buku (opsional).',
  ]);
  example.font = { italic: true, color: { argb: 'FF9CA3AF' } };

  const guide = wb.addWorksheet('Panduan');
  guide.columns = [
    { header: 'Kolom', key: 'col', width: 22 },
    { header: 'Wajib', key: 'req', width: 10 },
    { header: 'Keterangan', key: 'desc', width: 70 },
  ];
  styleHeader(guide.getRow(1));
  const docs: Array<[string, string, string]> = [
    ['ISBN', 'Wajib', 'ISBN-10 atau ISBN-13. Harus unik, format dengan/tanpa tanda hubung.'],
    ['Judul', 'Wajib', 'Judul buku, minimal 2 karakter.'],
    ['Penulis', 'Wajib', 'Nama penulis, minimal 2 karakter.'],
    ['Penerbit', 'Opsional', 'Nama penerbit.'],
    ['Tahun Terbit', 'Opsional', 'Angka antara 1000 dan tahun depan.'],
    ['Kategori', 'Opsional', 'Harus sama dengan nama kategori yang sudah ada di sistem.'],
    ['Lokasi Rak', 'Opsional', 'Contoh: F-01-01.'],
    ['Jumlah Eksemplar', 'Wajib', 'Angka minimal 1.'],
    ['Deskripsi', 'Opsional', 'Maksimal 2000 karakter.'],
  ];
  for (const [col, req, desc] of docs) {
    guide.addRow({ col, req, desc });
  }

  return toBuffer(wb);
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}export interface ImportResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: ImportRowError[];
  data: CreateBookInput[];
  categoryMap: Map<string, number>;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim();
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

/**
 * Parses and validates an uploaded workbook.
 *
 * Performs NO database writes. The caller decides what to do with `data`, which
 * keeps "validate" and "commit" as separate, testable steps.
 */
export async function parseBooksWorkbook(
  buffer: Buffer,
  categoryMap: Map<string, number>,
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  // exceljs bundles its own @types/node, so the Buffer generics differ from the
  // ones in this project. The bytes are identical; the cast is types-only.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const ws = wb.getWorksheet('Data Buku') ?? wb.worksheets[0];
  if (!ws) {
    return {
      totalRows: 0, validRows: 0, errorRows: 1, duplicateRows: 0,
      errors: [{ row: 0, field: '-', message: 'File tidak memiliki lembar kerja.' }],
      data: [], categoryMap,
    };
  }

  const headerRow = ws.getRow(1);
  const headerIndex = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const text = cellText(cell.value).toLowerCase().replace(/\s+/g, ' ').trim();
    headerIndex.set(text, colNumber);
  });

  const missing = IMPORT_HEADERS.filter((h) => !headerIndex.has(h.toLowerCase()));
  if (missing.length > 0) {
    return {
      totalRows: 0, validRows: 0, errorRows: 1, duplicateRows: 0,
      errors: [{
        row: 1,
        field: 'Header',
        message: `Kolom wajib tidak ditemukan: ${missing.join(', ')}. Gunakan template resmi.`,
      }],
      data: [], categoryMap,
    };
  }

  const at = (row: ExcelJS.Row, header: string): ExcelJS.CellValue =>
    row.getCell(headerIndex.get(header.toLowerCase()) as number).value;

  const errors: ImportRowError[] = [];
  const data: CreateBookInput[] = [];
  const seenIsbn = new Map<string, number>();

  let rowNumber = 0;
  let duplicateRows = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowIdx) => {
    if (rowIdx === 1) return;
    rowNumber += 1;

    const isbn = cellText(at(row, 'ISBN'));
    const title = cellText(at(row, 'Judul'));
    const author = cellText(at(row, 'Penulis'));

    // Skip fully blank rows silently.
    if (!isbn && !title && !author) return;

    const rowErrors: ImportRowError[] = [];

    if (seenIsbn.has(isbn)) {
      duplicateRows += 1;
      rowErrors.push({
        row: rowIdx,
        field: 'ISBN',
        message: `ISBN duplikat di dalam file (sama dengan baris ${seenIsbn.get(isbn)}).`,
      });
    }

    const publishYearRaw = cellText(at(row, 'Tahun Terbit'));
    const copiesRaw = cellText(at(row, 'Jumlah Eksemplar'));
    const categoryName = cellText(at(row, 'Kategori'));

    let categoryId: number | null = null;
    if (categoryName) {
      const found = categoryMap.get(categoryName.toLowerCase());
      if (found === undefined) {
        rowErrors.push({
          row: rowIdx,
          field: 'Kategori',
          message: `Kategori "${categoryName}" tidak ditemukan. Buat kategorinya terlebih dahulu.`,
        });
      } else {
        categoryId = found;
      }
    }

    const yearNum = publishYearRaw === '' ? undefined : Number(publishYearRaw);
    if (publishYearRaw !== '' && Number.isNaN(yearNum)) {
      rowErrors.push({ row: rowIdx, field: 'Tahun Terbit', message: 'Tahun terbit harus berupa angka.' });
    }

    const copiesNum = copiesRaw === '' ? undefined : Number(copiesRaw);
    if (copiesRaw !== '' && (Number.isNaN(copiesNum) || !Number.isInteger(copiesNum))) {
      rowErrors.push({
        row: rowIdx,
        field: 'Jumlah Eksemplar',
        message: 'Jumlah eksemplar harus bilangan bulat.',
      });
    }

    const candidate = {
      isbn,
      title,
      author,
      publisher: cellText(at(row, 'Penerbit')) || null,
      publishYear: yearNum ?? null,
      categoryId,
      description: cellText(at(row, 'Deskripsi')) || null,
      shelfLocation: cellText(at(row, 'Lokasi Rak')) || null,
      totalCopies: copiesNum ?? 1,
    };

    const parsed = createBookSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        rowErrors.push({
          row: rowIdx,
          field: issue.path.join('.') || '-',
          message: issue.message,
        });
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      data.push(parsed.data as CreateBookInput);
      seenIsbn.set(isbn, rowIdx);
    }
  });

  // Flag ISBNs that already exist in the database.
  const existing = await findBooksByIsbnList(data.map((d) => d.isbn));
  if (existing.size > 0) {
    const filtered: CreateBookInput[] = [];
    let dbDupes = 0;
    for (const item of data) {
      if (existing.has(item.isbn)) {
        dbDupes += 1;
        errors.push({
          row: 0,
          field: 'ISBN',
          message: `ISBN ${item.isbn} sudah terdaftar di database (buku: "${item.title}").`,
        });
      } else {
        filtered.push(item);
      }
    }
    duplicateRows += dbDupes;
    return {
      totalRows: data.length + duplicateRows,
      validRows: filtered.length,
      errorRows: errors.length,
      duplicateRows,
      errors,
      data: filtered,
      categoryMap,
    };
  }

  return {
    totalRows: data.length + duplicateRows,
    validRows: data.length,
    errorRows: errors.length,
    duplicateRows,
    errors,
    data,
    categoryMap,
  };
}

// =====================================================================
//  MEMBER IMPORT
// =====================================================================

export const MEMBER_IMPORT_HEADERS = [
  'Nama Lengkap',
  'Username',
  'Email',
  'Kelas',
  'Telepon',
  'Alamat',
] as const;

export interface MemberImportRow {
  fullName: string;
  username: string;
  email: string;
  className: string | null;
  phone: string | null;
  address: string | null;
}

export interface MemberImportResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: ImportRowError[];
  data: MemberImportRow[];
}

/**
 * Generates the same style of temporary password the single-member flow uses:
 * readable, but not guessable.
 *
 * One password is generated for the WHOLE batch rather than one per row.
 * bcrypt costs ~80 ms per hash at the configured cost; 500 individual hashes
 * would block a request for 40 seconds. A shared batch password keeps the
 * import fast, and every imported account is still forced to change it on
 * first use.
 */
export function generateBatchPassword(): string {
  const digits = String(Math.floor(Math.random() * 9000) + 1000);
  return `Lum${digits}-${Math.random().toString(36).slice(2, 6)}`;
}

export function buildMembersTemplateWorkbook(): Promise<Buffer> {
  const wb = newWorkbook('LUMEN - Sistem Perpustakaan Sekolah Digital');
  const ws = wb.addWorksheet('Data Anggota', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Nama Lengkap', key: 'fullName', width: 28 },
    { header: 'Username', key: 'username', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Kelas', key: 'className', width: 14 },
    { header: 'Telepon', key: 'phone', width: 18 },
    { header: 'Alamat', key: 'address', width: 40 },
  ];
  styleHeader(ws.getRow(1));

  ws.addRow({
    fullName: 'Andira Putri',
    username: 'andira.putri',
    email: 'andira.putri@sekolah.sch.id',
    className: 'XI RPL 1',
    phone: '081234567890',
    address: 'Jl. Merdeka No. 10',
  });

  const guide = wb.addWorksheet('Petunjuk');
  guide.columns = [
    { header: 'Kolom', key: 'col', width: 20 },
    { header: 'Wajib', key: 'req', width: 10 },
    { header: 'Keterangan', key: 'desc', width: 70 },
  ];
  styleHeader(guide.getRow(1));

  const docs: Array<[string, string, string]> = [
    ['Nama Lengkap', 'Wajib', 'Minimal 3 karakter.'],
    ['Username', 'Wajib', 'Unik. Huruf, angka, titik, garis bawah, atau strip.'],
    ['Email', 'Wajib', 'Unik dan harus valid.'],
    ['Kelas', 'Opsional', 'Contoh: XI RPL 1.'],
    ['Telepon', 'Opsional', 'Nomor yang bisa dihubungi.'],
    ['Alamat', 'Opsional', 'Maksimal 255 karakter.'],
  ];
  for (const [col, req, desc] of docs) {
    guide.addRow({ col, req, desc });
  }

  guide.addRow({});
  guide.addRow({ col: 'Kata sandi', req: '-', desc: 'Dibuat otomatis per anggota dan ditampilkan sekali setelah impor.' });
  guide.addRow({ col: 'Kode anggota', req: '-', desc: 'Dibuat otomatis dengan format MBR-TAHUN-NNN.' });

  return toBuffer(wb);
}

/**
 * Validates an uploaded member workbook.
 *
 * Like `parseBooksWorkbook`, this performs no writes. Duplicate usernames and
 * emails inside the file are caught here; collisions with existing accounts are
 * caught by the caller, which can query the database.
 */
export async function parseMembersWorkbook(buffer: Buffer): Promise<MemberImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const ws = wb.getWorksheet('Data Anggota') ?? wb.worksheets[0];
  if (!ws) {
    return {
      totalRows: 0, validRows: 0, errorRows: 1, duplicateRows: 0,
      errors: [{ row: 0, field: '-', message: 'File tidak memiliki lembar kerja.' }],
      data: [],
    };
  }

  const headerIndex = new Map<string, number>();
  ws.getRow(1).eachCell((cell, colNumber) => {
    const text = cellText(cell.value).toLowerCase().replace(/\s+/g, ' ').trim();
    headerIndex.set(text, colNumber);
  });

  const missing = MEMBER_IMPORT_HEADERS.filter((h) => !headerIndex.has(h.toLowerCase()));
  if (missing.length > 0) {
    return {
      totalRows: 0, validRows: 0, errorRows: 1, duplicateRows: 0,
      errors: [{
        row: 1,
        field: 'Header',
        message: `Kolom wajib tidak ditemukan: ${missing.join(', ')}. Gunakan template resmi.`,
      }],
      data: [],
    };
  }

  const at = (row: ExcelJS.Row, header: string): ExcelJS.CellValue => {
    const col = headerIndex.get(header.toLowerCase());
    return col === undefined ? null : row.getCell(col).value;
  };

  const errors: ImportRowError[] = [];
  const data: MemberImportRow[] = [];
  const seenUsername = new Map<string, number>();
  const seenEmail = new Map<string, number>();
  let duplicateRows = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowIdx) => {
    if (rowIdx === 1) return;

    const fullName = cellText(at(row, 'Nama Lengkap'));
    const username = cellText(at(row, 'Username'));
    const email = cellText(at(row, 'Email'));

    // Fully blank rows are formatting noise, not errors.
    if (!fullName && !username && !email) return;

    const rowErrors: ImportRowError[] = [];

    const usernameKey = username.toLowerCase();
    if (usernameKey && seenUsername.has(usernameKey)) {
      duplicateRows += 1;
      rowErrors.push({
        row: rowIdx,
        field: 'Username',
        message: `Username duplikat di dalam file (sama dengan baris ${seenUsername.get(usernameKey)}).`,
      });
    }
    const emailKey = email.toLowerCase();
    if (emailKey && seenEmail.has(emailKey)) {
      duplicateRows += 1;
      rowErrors.push({
        row: rowIdx,
        field: 'Email',
        message: `Email duplikat di dalam file (sama dengan baris ${seenEmail.get(emailKey)}).`,
      });
    }

    // Reuse the same Zod rules as the single-member form so the two paths can
    // never drift apart.
    const parsed = createMemberSchema.safeParse({
      fullName,
      username,
      email,
      className: cellText(at(row, 'Kelas')) || undefined,
      phone: cellText(at(row, 'Telepon')) || undefined,
      address: cellText(at(row, 'Alamat')) || undefined,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        rowErrors.push({
          row: rowIdx,
          field: issue.path.join('.') || '-',
          message: issue.message,
        });
      }
    }

    // Duplicate rows are recorded above; a row that also failed validation has
    // already contributed its own issues. Only a clean parse is inserted.
    if (rowErrors.length > 0 || !parsed.success) {
      errors.push(...rowErrors);
      return;
    }

    const valid = parsed.data;
    data.push({
      fullName: valid.fullName,
      username: valid.username,
      email: valid.email,
      className: valid.className ?? null,
      phone: valid.phone ?? null,
      address: valid.address ?? null,
    });
    seenUsername.set(usernameKey, rowIdx);
    seenEmail.set(emailKey, rowIdx);
  });

  return {
    totalRows: data.length + duplicateRows,
    validRows: data.length,
    errorRows: errors.length,
    duplicateRows,
    errors,
    data,
  };
}
