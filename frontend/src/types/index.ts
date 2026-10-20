export type Role = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive';
export type BookStatus = 'active' | 'inactive';

export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'borrowed'
  | 'return_requested'
  | 'returned'
  | 'cancelled';

/**
 * `overdue` and `pickup_expired` are DERIVED by the server, never stored:
 * a loan is late when `due_at` has passed, and a hold is dead when
 * `pickup_deadline` has passed. Keeping them out of the column means the
 * answer is always computed against the current clock.
 */
export type DisplayStatus = LoanStatus | 'overdue' | 'pickup_expired';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  className: string | null;
  phone: string | null;
  memberCode: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  /**
   * True for accounts created by the bulk Excel importer, which all share one
   * batch password. The app shows a blocking "change your password" gate.
   */
  mustChangePassword: boolean;
}

export interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishYear: number | null;
  categoryId: number | null;
  categoryName: string | null;
  description: string | null;
  shelfLocation: string | null;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  /** Copies physically present but unusable. Part of total, never available. */
  damagedCopies: number;
  coverPath: string | null;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  bookCount: number;
}

export interface Member extends User {
  createdAt: string;
  activeLoans: number;
  totalLoans: number;
}

/**
 * Result of scanning a card or barcode at the circulation desk.
 *
 * The server decides what the code meant; the UI only reacts. That keeps one
 * interpretation of "MBR-…" vs "978-…" instead of duplicating the rule here.
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

export interface Loan {
  id: number;
  loanCode: string;
  userId: number;
  bookId: number;
  quantity: number;
  /** How many times this loan has been extended. */
  renewCount: number;
  status: LoanStatus;
  displayStatus: DisplayStatus;
  requestedAt: string;
  approvedAt: string | null;
  /** Last moment the member may collect the book; only for `approved`. */
  pickupDeadline: string | null;
  borrowedAt: string | null;
  dueAt: string | null;
  returnRequestedAt: string | null;
  returnedAt: string | null;
  rejectedReason: string | null;
  returnCondition: string | null;
  returnNote: string | null;
  adminNote: string | null;
  daysLate: number | null;
  lateFee: number | null;
  /** Money this member still owes across ALL loans, fines included. */
  unpaidFines: number;
  book: {
    id: number;
    title: string;
    author: string;
    isbn: string;
    coverPath: string | null;
    categoryId: number | null;
    categoryName: string | null;
    availableCopies: number;
  };
  member: {
    id: number;
    fullName: string;
    username: string;
    memberCode: string | null;
  };
}

export type FineKind = 'late' | 'damaged' | 'lost';
export type FineStatus = 'unpaid' | 'paid' | 'waived';

export interface Fine {
  id: number;
  loanId: number;
  loanCode: string;
  userId: number;
  kind: FineKind;
  amount: number;
  status: FineStatus;
  settledAt: string | null;
  note: string | null;
  createdAt: string;
  book: { id: number; title: string };
  member: { id: number; fullName: string; memberCode: string | null };
}

export interface FineSummary {
  unpaidCount: number;
  unpaidTotal: number;
  paidTotal: number;
  waivedTotal: number;
}

export type ReservationStatus = 'waiting' | 'ready' | 'fulfilled' | 'expired' | 'cancelled';

export interface Reservation {
  id: number;
  bookId: number;
  userId: number;
  status: ReservationStatus;
  /** 1-based place in the queue while `waiting`; null otherwise. */
  queuePosition: number | null;
  readyAt: string | null;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
  book: {
    id: number;
    title: string;
    author: string;
    coverPath: string | null;
    availableCopies: number;
  };
  member: { id: number; fullName: string; memberCode: string | null };
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NeverBorrowedBook {
  id: number;
  title: string;
  author: string;
  categoryName: string | null;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
}

export interface LateMember {
  id: number;
  fullName: string;
  memberCode: string | null;
  overdueCount: number;
  totalLateDays: number;
  unpaidFines: number;
}

export interface FineReport {
  byKind: Array<{ kind: string; count: number; total: number; unpaid: number }>;
  byMonth: Array<{ period: string; charged: number; collected: number }>;
  totals: { charged: number; collected: number; outstanding: number; waived: number };
}

export interface AdminReports {
  range: { from: string; to: string };
  neverBorrowed: NeverBorrowedBook[];
  lateMembers: LateMember[];
  fines: FineReport;
}

export interface AdminOverview {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  /** Copies flagged as damaged; counted in `totalCopies`, never available. */
  damagedCopies: number;
  activeMembers: number;
  totalMembers: number;
  pendingApprovals: number;
  overdueLoans: number;
  returnRequests: number;
  activeLoans: number;
  totalLoans: number;
  returnedThisMonth: number;
  categories: number;
  /** Approved holds whose pickup window has passed. */
  pickupExpired: number;
  unpaidFinesTotal: number;
  unpaidFinesCount: number;
  queueWaiting: number;
}

export interface MemberOverview {
  activeLoans: number;
  pendingRequests: number;
  overdueLoans: number;
  totalBorrowed: number;
  returnRequested: number;
  maxLoanPerUser: number;
  remainingQuota: number;
  allowSelfReturn: boolean;
  requireApproval: boolean;
  unpaidFines: number;
  unpaidFineCount: number;
  waitingReservations: number;
  readyReservations: number;
  /** Cap on extensions per loan; 0 means renewal is disabled. */
  maxRenewals: number;
}

export interface TrendPoint {
  period: string;
  label: string;
  borrowed: number;
  returned: number;
}

export interface CategorySlice {
  name: string;
  value: number;
  totalCopies: number;
}

export interface StatusSlice {
  status: string;
  value: number;
}

export interface TopBook {
  id: number;
  title: string;
  author: string;
  coverPath: string | null;
  borrowCount: number;
}

export interface TopMember {
  id: number;
  fullName: string;
  memberCode: string | null;
  borrowCount: number;
  activeCount: number;
  overdueCount: number;
}

export interface DashboardCharts {
  range: { from: string; to: string; bucket: 'day' | 'week' | 'month' };
  trend: TrendPoint[];
  categories: CategorySlice[];
  statuses: StatusSlice[];
  topBooks: TopBook[];
  topMembers: TopMember[];
}

export interface ActivityItem {
  id: number;
  actorName: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  description: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface SettingItem {
  key: string;
  value: string;
  description: string | null;
}

export interface LibraryRules {
  maxLoanPerUser: number;
  loanDurationDays: number;
  requireApproval: boolean;
  allowSelfReturn: boolean;
  lateFeePerDay: number;
  maxRenewals: number;
  pickupWindowDays: number;
  fineBlockBorrow: boolean;
  damagedFee: number;
  lostFee: number;
  reservationHoldDays: number;
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportSummary {
  dryRun?: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  inserted?: number;
  errors: ImportRowError[];
}

/** Shared query-string shape for every paginated list. */
export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  direction?: 'ASC' | 'DESC';
}

/* ------------------------------------------------------------------
   Authors & book series
   ------------------------------------------------------------------ */

export interface AuthorSummary {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  nationality: string | null;
  /** Distinct titles held. NOT copies. */
  titleCount: number;
  /** Physical copies across those titles. */
  copyCount: number;
  /** Copies on the shelf right now. */
  availableCopies: number;
  seriesCount: number;
  /** Distinct books that belong to a series. */
  seriesTitleCount: number;
}

export interface SeriesSummary {
  id: number;
  authorId: number;
  authorName: string;
  authorSlug: string;
  name: string;
  slug: string;
  description: string | null;
  verification: 'verified' | 'unverified';
  sourceUrl: string | null;
  verifiedAt: string | null;
  /** Titles in the series, whether we own them or not. */
  totalItems: number;
  /** Of those, how many are on our shelves. */
  ownedItems: number;
  availableCopies: number;
}

export interface SeriesBookItem {
  position: number;
  note: string | null;
  /** false = in the bibliography but not in our catalogue. */
  inLibrary: boolean;
  book: {
    id: number;
    title: string;
    author: string;
    isbn: string;
    coverPath: string | null;
    categoryName: string | null;
    publishYear: number | null;
    shelfLocation: string | null;
    availableCopies: number;
    totalCopies: number;
  } | null;
}

export interface LooseBook {
  id: number;
  title: string;
  author: string;
  isbn: string;
  coverPath: string | null;
  categoryName: string | null;
  publishYear: number | null;
  shelfLocation: string | null;
  availableCopies: number;
  totalCopies: number;
}

export interface AuthorDetail {
  author: AuthorSummary;
  series: SeriesSummary[];
  looseBooks: LooseBook[];
  seriesTitleCount: number;
}

export interface SeriesDetail {
  series: SeriesSummary;
  items: SeriesBookItem[];
}

// =====================================================================
//  Operasional lanjutan (migrasi 006)
// =====================================================================

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export type VisitPurpose = 'read' | 'borrow' | 'return' | 'study' | 'other';

export interface Visit {
  id: number;
  userId: number | null;
  memberName: string;
  memberCode: string | null;
  className: string | null;
  guestName: string | null;
  purpose: VisitPurpose;
  visitDate: string;
  createdAt: string;
}

export interface VisitSummary {
  today: number;
  thisMonth: number;
  uniqueToday: number;
  byPurpose: Array<{ purpose: string; total: number }>;
}

export interface Opname {
  id: number;
  bookId: number;
  bookTitle: string;
  isbn: string;
  expected: number;
  counted: number;
  difference: number;
  note: string | null;
  appliedAt: string | null;
  appliedBy: number | null;
  appliedByName: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
}

export interface Review {
  id: number;
  bookId: number;
  bookTitle?: string;
  userId: number;
  memberName: string;
  memberCode: string | null;
  className: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  average: number;
  total: number;
  distribution: Record<string, number>;
}

export type AnnouncementAudience = 'all' | 'user' | 'admin';

export interface Announcement {
  id: number;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  pinned: boolean;
  expiresAt: string | null;
  /** Derived in SQL from NOW(), like `overdue`. */
  expired: boolean;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  id: number;
  bookId: number;
  title: string;
  author: string;
  coverPath: string | null;
  categoryName: string | null;
  availableCopies: number;
  totalCopies: number;
  createdAt: string;
}

export interface WishlistDemand {
  bookId: number;
  title: string;
  author: string;
  wishCount: number;
  availableCopies: number;
  totalCopies: number;
}

export interface BulkApproveResult {
  approved: Loan[];
  failed: Array<{ id: number; reason: string }>;
}

export interface RestoreReport {
  bytes: number;
  tables: string[];
  durationMs: number;
}

export interface MemberImportSummary {
  inserted: number;
  memberCodes: string[];
  batchPassword: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: ImportRowError[];
}
