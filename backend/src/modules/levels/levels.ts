/**
 * Tingkatan (level) anggota berdasarkan frekuensi peminjaman.
 *
 * Level TIDAK disimpan di database. Ia fungsi murni dari satu angka yang
 * dihitung SQL: berapa kali anggota benar-benar menerima buku
 * (`loans.borrowed_at IS NOT NULL`). Alasannya sama dengan `overdue`:
 * angka turunan yang disimpan cepat atau lambat akan berbohong, karena
 * setiap jalur yang mengubah riwayat harus ingat memperbaruinya juga.
 *
 * Kurva ini sengaja tinggal di kode, bukan di tabel `settings`. Ia tidak
 * mengubah hasil transaksi apa pun (tidak seperti denda atau kuota), jadi
 * memasukkannya ke `settings` hanya akan menambah permukaan konfigurasi
 * tanpa manfaat operasional. Kalau kurva diubah, seluruh anggota langsung
 * memakai kurva baru tanpa migrasi data.
 */

export interface LevelTier {
  /** 1-based, dipakai untuk "Level 3". */
  level: number;
  name: string;
  /** Peminjaman minimum untuk mencapai level ini. */
  minLoans: number;
  /** Warna badge di UI; dipetakan ke tone komponen Badge. */
  tone: 'neutral' | 'info' | 'cyan' | 'violet' | 'success' | 'warning';
  /** Satu kalimat yang menjelaskan arti level ini. */
  blurb: string;
}

export const LEVEL_TIERS: readonly LevelTier[] = [
  {
    level: 1,
    name: 'Pemula',
    minLoans: 0,
    tone: 'neutral',
    blurb: 'Baru bergabung. Setiap peminjaman menambah pengalamanmu.',
  },
  {
    level: 2,
    name: 'Pembaca',
    minLoans: 5,
    tone: 'info',
    blurb: 'Sudah rutin meminjam. Rak favoritmu mulai terbentuk.',
  },
  {
    level: 3,
    name: 'Kutu Buku',
    minLoans: 15,
    tone: 'cyan',
    blurb: 'Peminjam aktif. Petugas sudah hafal judul yang kamu cari.',
  },
  {
    level: 4,
    name: 'Pustakawan Muda',
    minLoans: 30,
    tone: 'violet',
    blurb: 'Sangat aktif. Kamu tahu isi rak lebih baik dari katalog.',
  },
  {
    level: 5,
    name: 'Legenda Literasi',
    minLoans: 60,
    tone: 'warning',
    blurb: 'Puncak tingkatan. Namamu layak dipajang di papan pengumuman.',
  },
] as const;

export const MAX_LEVEL = LEVEL_TIERS.length;

export interface MemberLevel {
  level: number;
  name: string;
  tone: LevelTier['tone'];
  blurb: string;
  /** Peminjaman yang dihitung (pernah benar-benar dipinjam). */
  totalBorrowed: number;
  /** Peminjaman minimum level saat ini. */
  currentMin: number;
  /** Peminjaman minimum level berikutnya; null bila sudah di puncak. */
  nextMin: number | null;
  /** Nama level berikutnya; null bila sudah di puncak. */
  nextName: string | null;
  /** Sisa peminjaman untuk naik level; 0 bila sudah di puncak. */
  remaining: number;
  /** 0-100, kemajuan di dalam level saat ini. 100 bila sudah di puncak. */
  progress: number;
}

/** Menghitung level dari jumlah peminjaman. Angka negatif dianggap 0. */
export function resolveLevel(totalBorrowed: number): MemberLevel {
  const count = Number.isFinite(totalBorrowed) ? Math.max(0, Math.floor(totalBorrowed)) : 0;

  let tier = LEVEL_TIERS[0];
  for (const candidate of LEVEL_TIERS) {
    if (count >= candidate.minLoans) tier = candidate;
  }

  const next = LEVEL_TIERS.find((t) => t.minLoans > tier.minLoans) ?? null;

  if (!next) {
    return {
      level: tier.level,
      name: tier.name,
      tone: tier.tone,
      blurb: tier.blurb,
      totalBorrowed: count,
      currentMin: tier.minLoans,
      nextMin: null,
      nextName: null,
      remaining: 0,
      progress: 100,
    };
  }

  const span = next.minLoans - tier.minLoans;
  const done = count - tier.minLoans;

  return {
    level: tier.level,
    name: tier.name,
    tone: tier.tone,
    blurb: tier.blurb,
    totalBorrowed: count,
    currentMin: tier.minLoans,
    nextMin: next.minLoans,
    nextName: next.name,
    remaining: Math.max(0, next.minLoans - count),
    progress: span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 100,
  };
}
