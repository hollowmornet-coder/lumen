export type Role = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive';

export interface AuthUserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  status: UserStatus;
  class_name: string | null;
  phone: string | null;
  member_code: string | null;
  avatar_path: string | null;
  last_login_at: string | null;
  must_change_password: number;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  className: string | null;
  phone: string | null;
  memberCode: string | null;
  /** Relative path of the uploaded photo, or null when none was set. */
  avatarPath: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  /**
   * Set for accounts created by the Excel importer, which share one batch
   * password. The client shows a "change your password" gate when true.
   */
  mustChangePassword: boolean;
}

export function toPublicUser(row: AuthUserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    className: row.class_name,
    phone: row.phone,
    memberCode: row.member_code,
    avatarPath: row.avatar_path ?? null,
    status: row.status,
    lastLoginAt: row.last_login_at,
    mustChangePassword: Boolean(row.must_change_password),
  };
}
