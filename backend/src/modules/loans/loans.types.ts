export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'borrowed'
  | 'return_requested'
  | 'returned'
  | 'cancelled';

/**
 * `overdue` is a *derived* display status, never a stored column.
 *
 * A loan is overdue when it is currently out with the member and the due date
 * has passed. Storing it would require a scheduled job to keep flipping rows
 * and would drift whenever the server clock moved.
 */
export type DisplayStatus = LoanStatus | 'overdue';

export const STORED_STATUSES: LoanStatus[] = [
  'pending',
  'approved',
  'rejected',
  'borrowed',
  'return_requested',
  'returned',
  'cancelled',
];

/** Statuses where the book is physically out with the member. */
export const OUT_WITH_MEMBER: LoanStatus[] = ['borrowed', 'return_requested'];

/** Statuses where a copy is reserved and available_copies has been decremented. */
export const STOCK_RESERVED: LoanStatus[] = ['approved', 'borrowed', 'return_requested'];

/**
 * The single source of truth for valid state transitions.
 * Every mutation checks this map, so an illegal jump (e.g. returned -> borrowed)
 * is impossible to express.
 */
export const ALLOWED_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['borrowed', 'cancelled'],
  rejected: [],
  borrowed: ['return_requested', 'returned'],
  return_requested: ['returned', 'borrowed'],
  returned: [],
  cancelled: [],
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Counts as "currently holding a copy" for the max-loan rule. */
export function holdsCopy(status: LoanStatus): boolean {
  return STOCK_RESERVED.includes(status);
}
