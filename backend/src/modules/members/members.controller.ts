import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { execute } from '../../config/db';
import { asyncHandler } from '../../lib/asyncHandler';
import { conflict, forbidden } from '../../lib/errors';
import { findDuplicateIdentity, generateMemberCode } from '../auth/auth.service';
import { logActivity } from '../activity/activity.service';
import {
  countActiveLoans,
  countTotalLoans,
  createMember,
  getMemberById,
  listMembers,
  setMemberPasswordHash,
  updateMember,
} from './members.service';
import type {
  CreateMemberInput,
  MemberQuery,
  ResetPasswordInput,
  UpdateMemberInput,
} from './members.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listMembers(req.query as unknown as MemberQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const member = await getMemberById(Number(req.params.id));
  res.json({ success: true, data: member });
});

/** Generates a readable temporary password, e.g. `Lum123-4f2a`. */
function generateTemporaryPassword(): string {
  return `Lum${crypto.randomInt(100, 999)}-${crypto.randomBytes(2).toString('hex')}`;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateMemberInput;

  const duplicate = await findDuplicateIdentity({
    username: input.username,
    email: input.email,
  });
  if (duplicate) {
    const field =
      duplicate.username === input.username
        ? 'Username'
        : duplicate.email === input.email
          ? 'Email'
          : 'Kode anggota';
    throw conflict(`${field} sudah digunakan. Gunakan nilai lain.`);
  }

  const memberCode = await generateMemberCode();
  const usedGeneratedPassword = !input.password;
  const plainPassword = input.password ?? generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(plainPassword, env.bcryptSaltRounds);

  const member = await createMember(input, memberCode, passwordHash);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'member.create',
    entityType: 'member',
    entityId: member.id,
    description: `Menambahkan anggota ${member.fullName} (${member.memberCode})`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: member,
    message: 'Anggota berhasil ditambahkan.',
    // Only sent when the system generated the password, so the librarian can
    // hand it over. It is never stored in plaintext anywhere.
    ...(usedGeneratedPassword ? { temporaryPassword: plainPassword } : {}),
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const input = req.body as UpdateMemberInput;
  const current = await getMemberById(id);

  if (current.role === 'admin') {
    throw forbidden('Data akun petugas tidak dapat diubah dari halaman anggota.');
  }

  if (input.email && input.email !== current.email) {
    const duplicate = await findDuplicateIdentity({ email: input.email }, id);
    if (duplicate) throw conflict('Email sudah digunakan anggota lain.');
  }

  if (input.status === 'inactive') {
    const active = await countActiveLoans(id);
    if (active > 0) {
      throw conflict(
        `Anggota masih memiliki ${active} peminjaman aktif. Selesaikan pengembalian sebelum menonaktifkan akun.`,
      );
    }
  }

  const member = await updateMember(id, input);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'member.update',
    entityType: 'member',
    entityId: id,
    description: `Memperbarui data anggota ${member.fullName}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: member, message: 'Data anggota berhasil diperbarui.' });
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const status = (req.body as { status?: 'active' | 'inactive' }).status;

  if (status !== 'active' && status !== 'inactive') {
    throw conflict('Status harus berupa active atau inactive.');
  }

  const current = await getMemberById(id);
  if (current.role === 'admin') {
    throw forbidden('Akun petugas tidak dapat dinonaktifkan dari halaman anggota.');
  }

  if (status === 'inactive') {
    const active = await countActiveLoans(id);
    if (active > 0) {
      throw conflict(
        `Anggota masih memiliki ${active} peminjaman aktif. Selesaikan pengembalian sebelum menonaktifkan akun.`,
      );
    }
  }

  const member = await updateMember(id, { status });

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'member.status',
    entityType: 'member',
    entityId: id,
    description: `${status === 'active' ? 'Mengaktifkan' : 'Menonaktifkan'} anggota ${member.fullName}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: member,
    message: status === 'active' ? 'Anggota berhasil diaktifkan.' : 'Anggota berhasil dinonaktifkan.',
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const input = req.body as ResetPasswordInput;

  const current = await getMemberById(id);
  if (current.role === 'admin') {
    throw forbidden('Kata sandi petugas tidak dapat diatur dari halaman anggota.');
  }

  const hash = await bcrypt.hash(input.newPassword, env.bcryptSaltRounds);
  await setMemberPasswordHash(id, hash);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'member.update',
    entityType: 'member',
    entityId: id,
    description: `Mengatur ulang kata sandi anggota ${current.fullName}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Kata sandi anggota berhasil diatur ulang.' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const current = await getMemberById(id);

  if (current.role === 'admin') {
    throw forbidden('Akun petugas tidak dapat dihapus dari halaman anggota.');
  }

  const active = await countActiveLoans(id);
  if (active > 0) {
    throw conflict(
      `Anggota masih memiliki ${active} peminjaman aktif. Selesaikan pengembalian terlebih dahulu.`,
    );
  }

  // `loans.user_id` is ON DELETE RESTRICT, so any history at all blocks a hard
  // delete. Deactivate instead and tell the user what actually happened.
  const history = await countTotalLoans(id);
  if (history > 0) {
    await updateMember(id, { status: 'inactive' });
    await logActivity({
      userId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'member.status',
      entityType: 'member',
      entityId: id,
      description: `Menonaktifkan anggota ${current.fullName} (memiliki ${history} riwayat transaksi)`,
      ipAddress: req.ip ?? undefined,
    });
    res.json({
      success: true,
      data: { deleted: false, softDeleted: true },
      message: `Anggota memiliki ${history} riwayat transaksi sehingga dinonaktifkan, bukan dihapus permanen.`,
    });
    return;
  }

  await execute('DELETE FROM users WHERE id = ?', [id]);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'member.delete',
    entityType: 'member',
    entityId: id,
    description: `Menghapus anggota ${current.fullName}`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: { deleted: true, softDeleted: false },
    message: 'Anggota berhasil dihapus.',
  });
});
