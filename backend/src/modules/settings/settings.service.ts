import { query, queryOne, type RowDataPacket } from '../../config/db';

interface SettingRow extends RowDataPacket {
  setting_key: string;
  setting_value: string;
  description: string | null;
}

export interface LibrarySettings {
  maxLoanPerUser: number;
  loanDurationDays: number;
  requireApproval: boolean;
  allowSelfReturn: boolean;
  lateFeePerDay: number;
  /** How many times a single loan may be renewed. 0 disables renewal. */
  maxRenewals: number;
  /** Days a member has to collect a book after approval. */
  pickupWindowDays: number;
  /** Blocks new borrows while the member has an unpaid fine. */
  fineBlockBorrow: boolean;
  /** Flat charge when a book comes back damaged. */
  damagedFee: number;
  /** Flat charge when a book is reported lost. */
  lostFee: number;
  /** Days a copy is held for the next person in the reservation queue. */
  reservationHoldDays: number;
  /** Pushes due dates past Sundays and holidays instead of landing on them. */
  dueDateSkipHolidays: boolean;
  /** Maximum active queue entries one member may hold. */
  maxReservationsPerUser: number;
  /** Only members with a completed loan may review a book. */
  reviewRequiresLoan: boolean;
  /** Whether the desk records library visits. */
  visitTrackingEnabled: boolean;
}

const DEFAULTS: LibrarySettings = {
  maxLoanPerUser: 3,
  loanDurationDays: 7,
  requireApproval: true,
  allowSelfReturn: true,
  lateFeePerDay: 1000,
  maxRenewals: 1,
  pickupWindowDays: 2,
  fineBlockBorrow: true,
  damagedFee: 5000,
  lostFee: 50000,
  reservationHoldDays: 2,
  dueDateSkipHolidays: true,
  maxReservationsPerUser: 3,
  reviewRequiresLoan: true,
  visitTrackingEnabled: true,
};

/** Reads all rules at once so a loan decision uses one consistent snapshot. */
export async function getSettings(): Promise<LibrarySettings> {
  const rows = await query<SettingRow>('SELECT setting_key, setting_value, description FROM settings');
  const map = new Map(rows.map((r) => [r.setting_key, r.setting_value]));

  const num = (key: string, fallback: number) => {
    const v = map.get(key);
    if (v === undefined) return fallback;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = (key: string, fallback: boolean) => {
    const v = map.get(key);
    if (v === undefined) return fallback;
    return v === '1' || v.toLowerCase() === 'true';
  };

  return {
    maxLoanPerUser: num('max_loan_per_user', DEFAULTS.maxLoanPerUser),
    loanDurationDays: num('loan_duration_days', DEFAULTS.loanDurationDays),
    requireApproval: bool('require_approval', DEFAULTS.requireApproval),
    allowSelfReturn: bool('allow_self_return', DEFAULTS.allowSelfReturn),
    lateFeePerDay: num('late_fee_per_day', DEFAULTS.lateFeePerDay),
    maxRenewals: num('max_renewals', DEFAULTS.maxRenewals),
    pickupWindowDays: num('pickup_window_days', DEFAULTS.pickupWindowDays),
    fineBlockBorrow: bool('fine_block_borrow', DEFAULTS.fineBlockBorrow),
    damagedFee: num('damaged_fee', DEFAULTS.damagedFee),
    lostFee: num('lost_fee', DEFAULTS.lostFee),
    reservationHoldDays: num('reservation_hold_days', DEFAULTS.reservationHoldDays),
    dueDateSkipHolidays: bool('due_date_skip_holidays', DEFAULTS.dueDateSkipHolidays),
    maxReservationsPerUser: num('max_reservations_per_user', DEFAULTS.maxReservationsPerUser),
    reviewRequiresLoan: bool('review_requires_loan', DEFAULTS.reviewRequiresLoan),
    visitTrackingEnabled: bool('visit_tracking_enabled', DEFAULTS.visitTrackingEnabled),
  };
}

export async function getRawSettings(): Promise<Array<{
  key: string;
  value: string;
  description: string | null;
}>> {
  const rows = await query<SettingRow>(
    'SELECT setting_key, setting_value, description FROM settings ORDER BY setting_key ASC',
  );
  return rows.map((r) => ({
    key: r.setting_key,
    value: r.setting_value,
    description: r.description,
  }));
}

export async function updateSetting(key: string, value: string): Promise<void> {
  await queryOne<RowDataPacket>(
    'UPDATE settings SET setting_value = ? WHERE setting_key = ?',
    [value, key],
  );
}

export const SETTING_KEYS = [
  'max_loan_per_user',
  'loan_duration_days',
  'require_approval',
  'allow_self_return',
  'late_fee_per_day',
  'max_renewals',
  'pickup_window_days',
  'fine_block_borrow',
  'damaged_fee',
  'lost_fee',
  'reservation_hold_days',
  'due_date_skip_holidays',
  'max_reservations_per_user',
  'review_requires_loan',
  'visit_tracking_enabled',
] as const;
