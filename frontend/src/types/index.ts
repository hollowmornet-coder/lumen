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

export type DisplayStatus = LoanStatus | 'overdue';

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

export interface Loan {
  id: number;
  loanCode: string;
  userId: number;
  bookId: number;
  quantity: number;
  status: LoanStatus;
  displayStatus: DisplayStatus;
  requestedAt: string;
  approvedAt: string | null;
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

export interface AdminOverview {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  activeMembers: number;
  totalMembers: number;
  pendingApprovals: number;
  overdueLoans: number;
  returnRequests: number;
  activeLoans: number;
  totalLoans: number;
  returnedThisMonth: number;
  categories: number;
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
