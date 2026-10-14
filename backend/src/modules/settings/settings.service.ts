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
}

const DEFAULTS: LibrarySettings = {
  maxLoanPerUser: 3,
  loanDurationDays: 7,
  requireApproval: true,
  allowSelfReturn: true,
  lateFeePerDay: 1000,
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
] as const;
