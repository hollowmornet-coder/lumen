import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { execute, queryOne, type RowDataPacket } from '../../config/db';
import { env } from '../../config/env';
import { BusinessRuleError, notFound } from '../../lib/errors';

const TOKEN_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a single-use reset token.
 *
 * Only the SHA-256 hash is stored, so a leaked database dump cannot be turned
 * into working reset links. Any earlier unused token for the same user is
 * invalidated first: a member who asks twice should not end up with two live
 * links, and "the newest request wins" is the least surprising rule.
 *
 * The plaintext token is returned to the caller once. In a deployment with
 * mail, that is what would be emailed; here the librarian hands it over.
 */
export async function issueResetToken(
  identifier: string,
): Promise<{ token: string; expiresAt: string; user: { id: number; fullName: string; username: string } }> {
  const user = await queryOne<
    RowDataPacket & { id: number; full_name: string; username: string; status: string }
  >(
    `SELECT id, full_name, username, status FROM users
      WHERE username = ? OR email = ? OR member_code = ?
      LIMIT 1`,
    [identifier, identifier, identifier],
  );

  // Deliberately vague: an unknown identifier must not reveal whether an
  // account exists. The caller treats "not found" as a generic failure.
  if (!user) throw notFound('Akun dengan data tersebut tidak ditemukan.');
  if (user.status !== 'active') {
    throw new BusinessRuleError('Akun Anda dinonaktifkan. Hubungi petugas perpustakaan.', 'ACCOUNT_INACTIVE');
  }

  await execute('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL', [user.id]);

  const token = crypto.randomBytes(24).toString('hex');

  // The expiry is computed by MySQL, not by JS. `toISOString()` yields UTC while
  // the column is compared against local-time `NOW()`, so a JS-computed value
  // was already "in the past" on any server east of Greenwich - the token
  // expired the instant it was issued.
  await execute(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [user.id, hashToken(token), TOKEN_TTL_MINUTES],
  );

  const stored = await queryOne<RowDataPacket & { expires_at: string }>(
    'SELECT expires_at FROM password_resets WHERE token_hash = ? LIMIT 1',
    [hashToken(token)],
  );

  return {
    token,
    expiresAt: stored?.expires_at ?? '',
    user: { id: user.id, fullName: user.full_name, username: user.username },
  };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const row = await queryOne<RowDataPacket & { id: number; user_id: number; expires_at: string; used_at: string | null }>(
    `SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1`,
    [hashToken(token)],
  );

  if (!row) throw new BusinessRuleError('Token reset tidak valid.', 'INVALID_TOKEN');
  if (row.used_at) throw new BusinessRuleError('Token reset sudah pernah dipakai.', 'TOKEN_USED');

  // Compared in SQL for the same reason the expiry is written in SQL: one clock.
  const live = await queryOne<RowDataPacket & { id: number }>(
    `SELECT id FROM password_resets
      WHERE id = ? AND used_at IS NULL AND expires_at > NOW()`,
    [row.id],
  );
  if (!live) {
    throw new BusinessRuleError('Token reset sudah kedaluwarsa. Minta token baru.', 'TOKEN_EXPIRED');
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);

  await execute(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [passwordHash, row.user_id],
  );
  await execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [row.id]);

  // Any other outstanding token for this account is now pointless.
  await execute(
    'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [row.user_id],
  );
}

/** Admin convenience: reset by user id, returns the token to hand over. */
export async function issueResetTokenForUser(
  userId: number,
): Promise<{ token: string; expiresAt: string }> {
  const user = await queryOne<RowDataPacket & { id: number; username: string; email: string }>(
    'SELECT id, username, email FROM users WHERE id = ?',
    [userId],
  );
  if (!user) throw notFound('Anggota tidak ditemukan.');

  const result = await issueResetToken(user.username);
  return { token: result.token, expiresAt: result.expiresAt };
}
