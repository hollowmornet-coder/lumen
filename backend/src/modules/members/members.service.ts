import { execute, query, queryOne, type RowDataPacket } from '../../config/db';
import { notFound } from '../../lib/errors';
import { escapeLike, paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { toPublicUser, type AuthUserRow, type PublicUser } from '../auth/auth.types';
import type { CreateMemberInput, MemberQuery, UpdateMemberInput } from './members.schema';

interface MemberRow extends RowDataPacket, AuthUserRow {
  created_at: string;
  active_loans?: number;
  total_loans?: number;
}

export interface Member extends PublicUser {
  createdAt: string;
  activeLoans: number;
  totalLoans: number;
}

function toMember(row: MemberRow): Member {
  return {
    ...toPublicUser(row),
    createdAt: row.created_at,
    activeLoans: Number(row.active_loans ?? 0),
    totalLoans: Number(row.total_loans ?? 0),
  };
}

function buildFilters(q: MemberQuery) {
  const where: string[] = [];
  const args: unknown[] = [];

  if (q.role !== 'all') {
    where.push('u.role = ?');
    args.push(q.role);
  }
  if (q.status !== 'all') {
    where.push('u.status = ?');
    args.push(q.status);
  }
  if (q.search) {
    where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.member_code LIKE ? OR u.email LIKE ?)');
    const like = `%${escapeLike(q.search)}%`;
    args.push(like, like, like, like);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

const MEMBER_SELECT = `
  SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.status,
         u.class_name, u.phone, u.member_code, u.last_login_at, u.created_at,
         COALESCE(SUM(l.status IN ('borrowed','return_requested')), 0) AS active_loans,
         COUNT(l.id) AS total_loans
    FROM users u
    LEFT JOIN loans l ON l.user_id = u.id
`;

export async function listMembers(params: MemberQuery): Promise<Paginated<Member>> {
  const { whereSql, args } = buildFilters(params);
  const listQuery = parseListQuery(
    {
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort,
      direction: params.direction,
    },
    ['full_name', 'username', 'member_code', 'created_at', 'last_login_at'],
    'created_at',
  );

  const totalRow = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
    args,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  const rows = await query<MemberRow>(
    `${MEMBER_SELECT} ${whereSql}
     GROUP BY u.id, u.username, u.email, u.password_hash, u.full_name, u.role,
              u.status, u.class_name, u.phone, u.member_code, u.last_login_at, u.created_at
     ORDER BY u.${listQuery.sort} ${listQuery.direction}, u.id DESC
     LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toMember), total, listQuery);
}

export async function getMemberById(id: number): Promise<Member> {
  const member = await getMemberOrNull(id);
  if (!member) throw notFound('Anggota tidak ditemukan.');
  return member;
}

export async function getMemberOrNull(id: number): Promise<Member | null> {
  const row = await queryOne<MemberRow>(
    `${MEMBER_SELECT} WHERE u.id = ?
     GROUP BY u.id, u.username, u.email, u.password_hash, u.full_name, u.role,
              u.status, u.class_name, u.phone, u.member_code, u.last_login_at, u.created_at`,
    [id],
  );
  return row ? toMember(row) : null;
}

/** Counts loans that still hold a copy of a book. Used before deactivation. */
export async function countActiveLoans(userId: number): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM loans
      WHERE user_id = ? AND status IN ('borrowed','return_requested')`,
    [userId],
  );
  return Number(row?.total ?? 0);
}

/** Counts ALL loans ever linked to a member, not just active ones. */
export async function countTotalLoans(userId: number): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM loans WHERE user_id = ?',
    [userId],
  );
  return Number(row?.total ?? 0);
}

export async function getMemberPasswordHash(id: number): Promise<string | null> {
  const row = await queryOne<RowDataPacket & { password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
    [id],
  );
  return row?.password_hash ?? null;
}

export async function touchMember(id: number): Promise<void> {
  await execute('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
}

export async function createMember(
  input: CreateMemberInput,
  memberCode: string,
  passwordHash: string,
): Promise<Member> {
  const result = await execute(
    `INSERT INTO users
       (member_code, username, email, password_hash, full_name, role, class_name, phone, address, status)
     VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?, ?)`,
    [
      memberCode,
      input.username,
      input.email,
      passwordHash,
      input.fullName,
      input.className || null,
      input.phone || null,
      input.address || null,
      input.status ?? 'active',
    ],
  );
  return getMemberById(result.insertId);
}

export async function updateMember(id: number, input: UpdateMemberInput): Promise<Member> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.fullName !== undefined) {
    sets.push('full_name = ?');
    params.push(input.fullName);
  }
  if (input.email !== undefined) {
    sets.push('email = ?');
    params.push(input.email);
  }
  if (input.className !== undefined) {
    sets.push('class_name = ?');
    params.push(input.className || null);
  }
  if (input.phone !== undefined) {
    sets.push('phone = ?');
    params.push(input.phone || null);
  }
  if (input.address !== undefined) {
    sets.push('address = ?');
    params.push(input.address || null);
  }
  if (input.status !== undefined) {
    sets.push('status = ?');
    params.push(input.status);
  }

  if (sets.length > 0) {
    params.push(id);
    await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getMemberById(id);
}

export async function setMemberPasswordHash(id: number, hash: string): Promise<void> {
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
}
