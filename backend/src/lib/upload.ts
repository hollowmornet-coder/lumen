import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env';
import { badRequest } from './errors';

export const UPLOAD_ROOT = path.resolve(process.cwd(), env.uploadDir);
export const COVER_DIR = path.join(UPLOAD_ROOT, 'covers');

/** Magic-byte signatures. Extension and client-supplied MIME are NOT trusted. */
const SIGNATURES: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  {
    ext: 'png',
    mime: 'image/png',
    test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b) =>
      b.length > 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
  for (const sig of SIGNATURES) {
    if (sig.test(buffer)) return { ext: sig.ext, mime: sig.mime };
  }
  return null;
}

/** Uploads are held in memory so we can verify the bytes before writing to disk. */
export const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(badRequest('Berkas cover harus berupa gambar.'));
      return;
    }
    cb(null, true);
  },
});

/** Excel import: keep in memory (max 5 MB), accept only real xlsx/xls by content later. */
export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/octet-stream' ||
      /\.xlsx?$/i.test(file.originalname);
    if (!ok) {
      cb(badRequest('Berkas harus berformat .xlsx atau .xls.'));
      return;
    }
    cb(null, true);
  },
});

/**
 * SQL backup upload.
 *
 * Browsers send `.sql` as `application/octet-stream`, `application/sql` or even
 * `text/plain` depending on the OS, so the extension is the only reliable hint
 * at this stage. The real validation is `inspectDump`, which reads the content.
 */
export const sqlUpload = multer({
  storage: multer.memoryStorage(),
  // A full dump with cover rows can be large, but 64 MB is far beyond any
  // realistic school library and still bounds memory use.
  limits: { fileSize: 64 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /\.sql$/i.test(file.originalname) ||
      file.mimetype === 'application/sql' ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'text/plain';
    if (!ok) {
      cb(badRequest('Berkas cadangan harus berformat .sql.'));
      return;
    }
    cb(null, true);
  },
});

export interface StoredFile {
  relativePath: string;
  absolutePath: string;
  mime: string;
  size: number;
}

/**
 * Validates the buffer's real content type and writes it to `uploads/covers`
 * using a random filename (the original name is never used on disk).
 */
export async function storeCover(buffer: Buffer): Promise<StoredFile> {
  const detected = detectImageType(buffer);
  if (!detected) {
    throw badRequest('Format gambar tidak dikenali. Gunakan PNG, JPG, atau WEBP.');
  }

  await fs.mkdir(COVER_DIR, { recursive: true });

  const filename = `${crypto.randomBytes(16).toString('hex')}.${detected.ext}`;
  const absolutePath = path.join(COVER_DIR, filename);
  await fs.writeFile(absolutePath, buffer);

  return {
    relativePath: `/uploads/covers/${filename}`,
    absolutePath,
    mime: detected.mime,
    size: buffer.length,
  };
}

/** Best-effort delete of a previously stored cover. Never throws. */
export async function removeStoredFile(relativePath: string | null): Promise<void> {
  if (!relativePath) return;
  try {
    // Only ever delete inside the covers directory; refuse path traversal.
    const target = path.resolve(process.cwd(), relativePath.replace(/^\/+/, ''));
    if (!target.startsWith(COVER_DIR + path.sep)) return;
    await fs.unlink(target);
  } catch {
    /* file already gone - nothing to do */
  }
}
