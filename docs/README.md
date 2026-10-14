# LUMEN — Digital School Library Management System

Aplikasi perpustakaan sekolah digital berbasis web yang berjalan sepenuhnya di
**localhost** tanpa memerlukan koneksi internet saat digunakan.

LUMEN dibuat untuk tugas **UJI KOMPETENSI KEAHLIAN (UKK) Rekayasa Perangkat Lunak**,
sesuai soal: *Pengembangan Aplikasi Peminjaman Buku* — sistem untuk memudahkan siswa dan
admin perpustakaan dalam peminjaman dan pendataan buku.

---

## 1. Ringkasan

| | |
|---|---|
| Nama aplikasi | **LUMEN** — Digital School Library Management System |
| Konsentrasi | Rekayasa Perangkat Lunak (RPL) |
| Lingkungan | Windows, lokal saja (`localhost`) |
| Basis data | MariaDB 11.4 / MySQL 8 (XAMPP compatible) |
| Akses | Dua role: **Admin / Petugas** dan **User / Siswa** |

---

## 2. Fitur Utama

### Admin / Petugas
- Dasbor statistik real-time dengan grafik tren, distribusi kategori, status transaksi,
  dan buku paling sering dipinjam.
- Kelola buku (CRUD lengkap, upload cover, aktivasi/nonaktifkan, soft delete).
- Kelola anggota (CRUD, reset kata sandi, kode anggota otomatis, cegah hapus bila ada
  transaksi aktif).
- Transaksi: setujui / tolak permohonan, serah-terima buku, terima pengembalian.
- Pantau peminjaman terlambat dan pengembalian yang menunggu verifikasi.
- Ekspor & impor data Excel (.xlsx) termasuk template impor.
- Riwayat aktivitas (audit trail).
- Pengaturan aturan operasional (kuota pinjam, masa pinjam, persetujuan, denda).

### User / Siswa
- Daftar dan login (registrasi publik **hanya** menghasilkan role siswa).
- Katalog editorial dengan pencarian, filter kategori/ketersediaan, sorting, pagination.
- Detail buku dengan status stok dan tombol pinjam yang mengikuti aturan bisnis.
- Ajukan peminjaman, pantau status, ajukan pengembalian.
- Riwayat peminjaman dan profil.

---

## 3. Teknologi

**Frontend**
| Teknologi | Versi | Peran |
|---|---|---|
| React | 18 | UI |
| TypeScript | 5.x | Penulisan kode |
| Vite | 7 | Build & dev server |
| Tailwind CSS | 3.4 | Styling |
| Framer Motion | 12 | Animasi |
| Lucide React | — | Ikon (SVG, tanpa emoji) |
| React Router | 7 | Navigasi |
| React Hook Form + Zod | — | Formulir & validasi |
| Recharts | 2 | Grafik |
| TanStack Query | 5 | Pengambilan data |

**Backend**
| Teknologi | Peran |
|---|---|
| Node.js + Express 4 | REST API |
| TypeScript | Penulisan kode |
| mysql2 | Driver MariaDB/MySQL (parameterized query) |
| Zod | Validasi input |
| bcryptjs | Hash kata sandi |
| jsonwebtoken + httpOnly cookie | Autentikasi |
| helmet, cors, express-rate-limit | Keamanan |
| exceljs | Impor/ekspor Excel |
| multer | Unggah berkas (divalidasi magic byte) |

> **Tanpa font web eksternal.** Aplikasi memakai stack font sistem lokal
> (`Iowan Old Style`/`Palatino` untuk judul, `Inter`/`Segoe UI` untuk isi) agar tetap
> berjalan saat tidak ada internet.

---

## 4. Prasyarat Sistem

| Komponen | Kebutuhan |
|---|---|
| Node.js | 18 atau lebih baru (diuji pada v24) |
| MariaDB / MySQL | 10.4+ / 8.0+ (XAMPP sudah termasuk) |
| Browser | Chrome / Edge / Firefox versi terbaru |
| RAM | 4 GB |
| Koneksi internet | **Tidak diperlukan setelah instalasi** |

---

## 5. Instalasi

### 5.1 Database

Buat database dan tabel dengan cara salah satu:

**Cara A — phpMyAdmin (XAMPP)**
1. Jalankan Apache + MySQL di XAMPP.
2. Buka `http://localhost/phpmyadmin`.
3. Pilih tab **Import** → unggah `database.sql` → **Go**.

**Cara B — Terminal**
```bash
mysql -u root -p < database.sql
```

**Cara C — lewat backend (membuat database saja)**
```bash
cd backend
npm run db:init
```

File `database.sql` sudah berisi struktur tabel, constraint, indeks, dan **seed data demo**
(ditandai `-- [DEMO]`).

### 5.2 Backend

```bash
cd backend
npm install
copy .env.example .env      # Windows
# cp .env.example .env      # Linux/macOS
npm run dev
```

Backend berjalan di **http://localhost:4000/api**.

> **Wajib:** isi `JWT_SECRET` di `.env` dengan nilai acak minimal 32 karakter.
> Generate dengan: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 5.3 Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di **http://localhost:5173** dan otomatis mem-proxy `/api` ke backend.

### 5.4 Menjalankan sekaligus

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Atau gunakan skenal pembantu di root: `start-lumen.bat` (Windows).

---

## 6. Konfigurasi Database

Isi `backend/.env`:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307          # 3306 bila memakai XAMPP
DB_USER=lumen_user
DB_PASSWORD=lumen_dev_pass
DB_NAME=lumen_db
```

Untuk XAMPP, biasanya cukup:

```dotenv
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
```

---

## 7. Akun Demo

| Role | Username | Kata sandi |
|---|---|---|
| Admin / Petugas | `admin` | `Admin123!` |
| Siswa | `andira` | `Siswa123!` |
| Siswa | `bima` | `Siswa123!` |
| Siswa | `citra` | `Siswa123!` |

> Data dan kredensial di atas hanya untuk keperluan demonstrasi/ujian.

---

## 8. Cara Mengakses

1. Jalankan database, backend, dan frontend.
2. Buka **http://localhost:5173**.
3. Masuk memakai akun demo di atas.
4. Admin diarahkan ke `/admin`, siswa ke `/perpustakaan`.

---

## 9. Struktur Proyek

```
UKK/
├─ database.sql              # deliverable database (.sql)
├─ start-lumen.bat           # penanda backend + frontend
├─ scripts/
│  ├─ api-test.ps1           # 53 skenario uji otomatis
│  └─ last-test-run.txt      # hasil uji terakhir
├─ backend/
│  └─ src/
│     ├─ config/             # env + pool database
│     ├─ lib/                # logger, errors, pagination, upload
│     ├─ middleware/         # auth, validate, rate limit, error
│     ├─ modules/            # auth, books, members, loans,
│     │                      # dashboard, excel, activity, settings
│     ├─ routes/             # registrasi route
│     ├─ app.ts
│     └─ server.ts
├─ frontend/
│  └─ src/
│     ├─ components/         # ui, charts, layout
│     ├─ features/auth/      # AuthContext
│     ├─ hooks/              # useApi (React Query)
│     ├─ layouts/            # AppShell
│     ├─ lib/                # api, motion, utils
│     ├─ pages/              # admin/, member/, katalog, login
│     ├─ routes/             # guard, error boundary
│     └─ types/
└─ docs/                     # dokumentasi UKK
```

---

## 10. Perintah yang Tersedia

**Backend**
| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan server pengembangan (auto-reload) |
| `npm run build` | Kompilasi TypeScript ke `dist/` |
| `npm start` | Jalankan versi produksi |
| `npm run typecheck` | Periksa tipe tanpa emit |
| `npm run db:init` | Inisialisasi database |

**Frontend**
| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server di port 5173 |
| `npm run build` | Build produksi ke `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run lint` | ESLint |

**Pengujian**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\api-test.ps1
```

---

## 11. Dokumentasi Lain

| Dokumen | Isi |
|---|---|
| [`docs/ERD.md`](ERD.md) | Diagram relasi antar tabel |
| [`docs/DESKRIPSI_PROGRAM.md`](DESKRIPSI_PROGRAM.md) | Tujuan, pengguna, alur kerja, arsitektur |
| [`docs/DOKUMENTASI_FUNGSI.md`](DOKUMENTASI_FUNGSI.md) | Rincian fungsi & endpoint API |
| [`docs/DEBUGGING.md`](DEBUGGING.md) | Masalah yang ditemukan & solusinya |
| [`docs/TESTING.md`](TESTING.md) | Skenario & hasil pengujian |
| [`docs/LAPORAN_EVALUASI.md`](LAPORAN_EVALUASI.md) | Evaluasi dan rencana pengembangan |
| [`docs/PANDUAN_PENGGUNA.md`](PANDUAN_PENGGUNA.md) | Panduan admin & siswa |
| [`database.sql`](../database.sql) | Struktur & data database |
