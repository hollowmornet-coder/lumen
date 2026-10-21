import { queryOne, type RowDataPacket } from '../../config/db';
import { resolveLevel, type MemberLevel } from '../levels/levels';

/**
 * What a scanned code turned out to be.
 *
 * The desk scanner does not know in advance whether the librarian pointed it at
 * a member card or a book barcode, and requiring them to pick a mode first is
 * exactly the kind of friction that makes staff stop using a scanner. So one
 * endpoint resolves either, and the UI reacts to the answer.
 */
export type ScanTarget =
  | {
      kind: 'member';
      id: number;
      memberCode: string | null;
      username: string;
      fullName: string;
      className: string | null;
      status: string;
      /** Photo shown at the desk so staff can verify the person, not just the card. */
      avatarPath: string | null;
      /** Derived level, so the desk shows the same badge as everywhere else. */
      level: MemberLevel;
    }
  | {
      kind: 'book';
      id: number;
      isbn: string;
      title: string;
      author: string;
      availableCopies: number;
      totalCopies: number;
    }
  | {
      kind: 'loan';
      id: number;
      loanCode: string;
      status: string;
      memberName: string;
      bookTitle: string;
      dueAt: string | null;
    };

/**
 * Resolves a scanned string to a member, a book, or a loan slip.
 *
 * Matching rules, in order:
 *
 *  1. `MBR-…` is always a member code.
 *  2. `LN-…` is always a loan code (the slip printed at the desk).
 *  3. A 10- or 13-digit string (hyphens stripped) is always an ISBN.
 *  4. Anything else is tried as each of the three, so a bare numeric member
 *     code still works.
 *
 * The code itself is never interpolated into SQL; every branch uses a
 * placeholder.
 */
export async function resolveScan(rawCode: string): Promise<ScanTarget | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const upper = code.toUpperCase();
  const digitsOnly = code.replace(/[-\s]/g, '');

  const looksLikeMember = upper.startsWith('MBR');
  const looksLikeLoan = upper.startsWith('LN-');
  const looksLikeIsbn = /^(?:\d{9}[\dX]|\d{13})$/i.test(digitsOnly);

  if (looksLikeMember) return findMember(code);
  if (looksLikeLoan) return findLoan(code);
  if (looksLikeIsbn) return findBook(code, digitsOnly);

  // Unknown shape: try the book first (barcodes are the most common thing at
  // the desk), then the loan slip, then the member card.
  const book = await findBook(code, digitsOnly);
  if (book) return book;
  const loan = await findLoan(code);
  if (loan) return loan;
  return findMember(code);
}

async function findMember(code: string): Promise<ScanTarget | null> {
  const row = await queryOne<
    RowDataPacket & {
      id: number;
      member_code: string | null;
      username: string;
      full_name: string;
      class_name: string | null;
      status: string;
      avatar_path: string | null;
      total_borrowed: number;
    }
  >(
    `SELECT u.id, u.member_code, u.username, u.full_name, u.class_name, u.status,
            u.avatar_path,
            (SELECT COUNT(*) FROM loans l
              WHERE l.user_id = u.id AND l.borrowed_at IS NOT NULL) AS total_borrowed
       FROM users u
      WHERE u.role = 'user'
        AND (u.member_code = ? OR u.username = ?)
      LIMIT 1`,
    [code, code],
  );

  if (!row) return null;

  return {
    kind: 'member',
    id: row.id,
    memberCode: row.member_code,
    username: row.username,
    fullName: row.full_name,
    className: row.class_name,
    status: row.status,
    avatarPath: row.avatar_path ?? null,
    level: resolveLevel(Number(row.total_borrowed ?? 0)),
  };
}

async function findBook(code: string, digitsOnly: string): Promise<ScanTarget | null> {
  const row = await queryOne<
    RowDataPacket & {
      id: number;
      isbn: string;
      title: string;
      author: string;
      available_copies: number;
      total_copies: number;
    }
  >(
    // ISBN is stored with whatever hyphens the librarian typed, so the
    // comparison strips separators from the column too. `REPLACE` on an
    // indexed column prevents index use, but this table is small and the query
    // is a single-row lookup by primary key range; correctness wins here.
    `SELECT id, isbn, title, author, available_copies, total_copies
       FROM books
      WHERE isbn = ?
         OR REPLACE(REPLACE(isbn, '-', ''), ' ', '') = ?
      LIMIT 1`,
    [code, digitsOnly],
  );

  if (!row) return null;

  return {
    kind: 'book',
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    availableCopies: row.available_copies,
    totalCopies: row.total_copies,
  };
}

async function findLoan(code: string): Promise<ScanTarget | null> {
  const row = await queryOne<
    RowDataPacket & {
      id: number;
      loan_code: string;
      status: string;
      due_at: string | null;
      member_name: string;
      book_title: string;
    }
  >(
    `SELECT l.id, l.loan_code, l.status, l.due_at,
            u.full_name AS member_name,
            b.title     AS book_title
       FROM loans l
       JOIN users u ON u.id = l.user_id
       JOIN books b ON b.id = l.book_id
      WHERE l.loan_code = ?
      LIMIT 1`,
    [code],
  );

  if (!row) return null;

  return {
    kind: 'loan',
    id: row.id,
    loanCode: row.loan_code,
    status: row.status,
    memberName: row.member_name,
    bookTitle: row.book_title,
    dueAt: row.due_at,
  };
}
