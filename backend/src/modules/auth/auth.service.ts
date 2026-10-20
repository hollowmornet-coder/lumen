import bcrypt from 'bcryptjs';
import { execute, queryOne, type RowDataPacket } from '../../config/db';
import { env } from '../../config/env';
import { conflict, unauthorized } from '../../lib/errors';
import { toPublicUser, type AuthUserRow, type PublicUser } from './auth.types';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from './auth.schema';

interface DuplicateRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  member_code: string | null;
}

/** Auth-only projection (never returns password_hash to controllers). */
export async function findAuthUserById(id: number): Promise<AuthUserRow | null> {
  return queryOne<AuthUserRow & RowDataPacket>(
    `SELECT id, username, email, password_hash, full_name, role, status,
            class_name, phone, member_code, last_login_at, must_change_password
       FROM users
      WHERE id = ?`,
    [id],
  );
}

export async function findAuthUserByIdentifier(identifier: string): Promise<AuthUserRow | null> {
  return queryOne<AuthUserRow & RowDataPacket>(
    `SELECT id, username, email, password_hash, full_name, role, status,
            class_name, phone, member_code, last_login_at, must_change_password
       FROM users
      WHERE username = ? OR email = ?
      LIMIT 1`,
    [identifier, identifier],
  );
}

/**
 * Verifies credentials.
 *
 * Both "user not found" and "wrong password" produce the identical error so we
 * cannot be used to enumerate valid usernames. When the user does not exist we
 * still run a bcrypt comparison against a dummy hash to keep the response time
 * roughly constant.
 */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function verifyCredentials(
  identifier: string,
  password: string,
): Promise<PublicUser> {
  const user = await findAuthUserByIdentifier(identifier);

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw unauthorized('Username atau kata sandi salah.');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw unauthorized('Username atau kata sandi salah.');

  if (user.status !== 'active') {
    throw unauthorized('Akun Anda dinonaktifkan. Hubungi petugas perpustakaan.');
  }

  await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  return toPublicUser(user);
}

/**
 * Generates the next sequential member code, e.g. `MBR-2026-004`.
 *
 * The code is NOT accepted from the client: a student must never be able to
 * choose their own identity number. We retry on collision so this stays safe
 * even if two registrations land at the same moment.
 */
export async function generateMemberCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MBR-${year}-`;

  const row = await queryOne<RowDataPacket & { n: number }>(
    `SELECT COUNT(*) AS n FROM users WHERE member_code LIKE ?`,
    [`${prefix}%`],
  );
  let next = Number(row?.n ?? 0) + 1;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${prefix}${String(next).padStart(3, '0')}`;
    const clash = await queryOne<RowDataPacket & { id: number }>(
      'SELECT id FROM users WHERE member_code = ? LIMIT 1',
      [candidate],
    );
    if (!clash) return candidate;
    next += 1;
  }
  throw conflict('Gagal membuat kode anggota. Silakan coba lagi.');
}

export async function registerMember(input: RegisterInput): Promise<PublicUser> {
  const memberCode = await generateMemberCode();

  const duplicate = await queryOne<DuplicateRow>(
    `SELECT id, username, email, member_code
       FROM users
      WHERE username = ? OR email = ? OR member_code = ?`,
    [input.username, input.email, memberCode],
  );

  if (duplicate) {
    const field =
      duplicate.username === input.username
        ? 'username'
        : duplicate.email === input.email
          ? 'email'
          : 'kode anggota';
    throw conflict(
      `Data sudah digunakan. ${field.charAt(0).toUpperCase() + field.slice(1)} tidak dapat diduplikasi.`,
    );
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);

  // role is hard-coded to 'user'. Public registration can never mint an admin.
  const result = await execute(
    `INSERT INTO users (member_code, username, email, password_hash, full_name, role, class_name, phone, status)
     VALUES (?, ?, ?, ?, ?, 'user', ?, ?, 'active')`,
    [
      memberCode,
      input.username,
      input.email,
      passwordHash,
      input.fullName,
      input.className || null,
      input.phone || null,
    ],
  );

  const created = await findAuthUserById(result.insertId);
  if (!created) throw conflict('Gagal membuat akun.');
  return toPublicUser(created);
}

export async function updateProfile(userId: number, input: UpdateProfileInput): Promise<PublicUser> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.fullName !== undefined) {
    sets.push('full_name = ?');
    params.push(input.fullName);
  }
  if (input.className !== undefined) {
    sets.push('class_name = ?');
    params.push(input.className || null);
  }
  if (input.phone !== undefined) {
    sets.push('phone = ?');
    params.push(input.phone || null);
  }

  if (sets.length > 0) {
    params.push(userId);
    await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  const updated = await findAuthUserById(userId);
  if (!updated) throw unauthorized('Akun tidak ditemukan.');
  return toPublicUser(updated);
}

export async function changePassword(userId: number, input: ChangePasswordInput): Promise<void> {
  const user = await findAuthUserById(userId);
  if (!user) throw unauthorized('Akun tidak ditemukan.');

  const ok = await bcrypt.compare(input.currentPassword, user.password_hash);
  if (!ok) throw unauthorized('Kata sandi saat ini salah.');

  const passwordHash = await bcrypt.hash(input.newPassword, env.bcryptSaltRounds);
  // Clearing the flag is part of the same write: a batch-imported account that
  // changes its password must stop being nagged immediately.
  await execute(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [passwordHash, userId],
  );
}

/** Used by the admin member module to check for collisions before insert. */
export async function findDuplicateIdentity(
  identity: { username?: string; email?: string; memberCode?: string },
  excludeUserId?: number,
): Promise<DuplicateRow | null> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (identity.username) {
    conditions.push('username = ?');
    params.push(identity.username);
  }
  if (identity.email) {
    conditions.push('email = ?');
    params.push(identity.email);
  }
  if (identity.memberCode) {
    conditions.push('member_code = ?');
    params.push(identity.memberCode);
  }
  if (conditions.length === 0) return null;

  let sql = `SELECT id, username, email, member_code FROM users WHERE (${conditions.join(' OR ')})`;
  if (excludeUserId) {
    sql += ' AND id <> ?';
    params.push(excludeUserId);
  }
  sql += ' LIMIT 1';

  return queryOne<DuplicateRow>(sql, params);
}
