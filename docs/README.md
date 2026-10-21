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
- **Meja sirkulasi**: peminjaman langsung di loket (anggota → buku → konfirmasi) tanpa
  menunggu permohonan siswa, dengan pratinjau jatuh tempo dan pemeriksaan kuota.
- **Perpanjangan pinjaman** dengan batas jumlah per transaksi.
- **Batas waktu pengambilan**: peminjaman yang disetujui tetapi tidak diambil dalam
  N hari otomatis ditandai `pickup_expired` dan jatahnya dapat dilepas ke antrean.
- **Denda sebagai data**: keterlambatan, kerusakan, dan kehilangan dicatat sebagai baris
  `fines` yang di-snapshot, lalu dilunasi atau dibebaskan di meja petugas.
- **Antrean/reservasi** saat stok habis, dengan promosi otomatis ke status `ready`
  begitu buku dikembalikan.
- **Pemindai barcode/QR** di meja sirkulasi: satu kolom menerima kartu anggota,
  ISBN buku, atau kode transaksi sekaligus.
- **Kartu anggota ber-QR** yang dapat ditampilkan dan dicetak dari halaman anggota.
- Pantau peminjaman terlambat dan pengembalian yang menunggu verifikasi.
- Ekspor & impor data Excel (.xlsx) termasuk template impor.
- Riwayat aktivitas (audit trail).
- Laporan tambahan: buku yang tidak pernah dipinjam, anggota paling sering terlambat,
  dan rekap denda per jenis.
- **Cadangan basis data** sekali klik (unduh dump `.sql` lengkap) dan **pemulihan**
  dari berkas cadangan dengan konfirmasi ketik `PULIHKAN`.
- **Impor anggota dari Excel** dalam dua langkah (periksa dulu, baru simpan), dengan
  satu kata sandi batch dan kewajiban ganti sandi saat login pertama.
- **Hari libur**: kalender tanggal merah yang menggeser jatuh tempo otomatis.
- **Kunjungan perpustakaan**: catat kehadiran anggota (pindai kartu) maupun tamu.
- **Stok opname**: bandingkan stok sistem dengan hitung fisik, lalu terapkan selisihnya.
- **Pengumuman**: terbitkan informasi untuk semua, hanya siswa, atau hanya petugas.
- **Laporan permintaan**: judul yang paling banyak masuk daftar keinginan anggota.
- **Foto profil anggota** tampil di tabel anggota, dasbor, dan panel sirkulasi
  (membantu memastikan kartu yang dipindai memang milik orangnya).
- **Level anggota** tampil per baris di tabel anggota dan di "Anggota Teraktif",
  dihitung dari riwayat peminjaman.
- Pengaturan 15 aturan operasional (kuota, masa pinjam, persetujuan, denda harian,
  perpanjangan, batas ambil, blokir denda, biaya rusak/hilang, masa sisih antrean,
  penggeseran jatuh tempo saat libur, batas antrean, syarat ulasan, pencatatan kunjungan).

### User / Siswa
- Daftar dan login (registrasi publik **hanya** menghasilkan role siswa).
- **Lupa kata sandi** mandiri dengan token sekali pakai (berlaku 30 menit).
- Katalog editorial dengan pencarian, filter kategori/ketersediaan, sorting, pagination.
- Detail buku dengan status stok dan tombol pinjam yang mengikuti aturan bisnis.
- Ajukan peminjaman, pantau status, ajukan pengembalian.
- **Perpanjang pinjaman** sendiri selama belum terlambat dan batas belum tercapai.
- **Antre buku** saat stok habis, lihat posisi antrean, dan batalkan bila berubah pikiran.
- **Denda saya**: daftar tagihan belum lunas dan riwayat pelunasan (baca saja —
  pembayaran hanya di meja petugas).
- **Notifikasi dalam aplikasi**: persetujuan, jatuh tempo, denda baru, dan buku
  pesanan siap diambil, lengkap dengan penanda belum dibaca.
- **Kartu anggota ber-QR** di halaman profil untuk ditunjukkan di meja sirkulasi.
- **Ulasan & rating bintang** pada buku yang pernah dipinjam.
- **Daftar keinginan** sebagai penanda baca pribadi (tidak memesan stok).
- **Pengumuman** dari petugas tampil di beranda.
- **Foto profil** (JPG/PNG/WEBP/**GIF animasi**, maks. 5 MB) — unggah, ganti, atau hapus.
- **Tingkatan anggota (level)** dari jumlah buku yang benar-benar dipinjam, lengkap
  dengan bilah kemajuan, tangga level, dan **papan peringkat pembaca** di beranda.
- Riwayat peminjaman dan profil.

---

## 3. Teknologi

**Frontend**
| Teknologi | Versi | Peran |
|---|---|---|
| React | 19 | UI |
| TypeScript | 5.x | Penulisan kode |
| Vite | 7 | Build & dev server |
| Tailwind CSS | 3.4 | Styling |
| Framer Motion | 14 | Animasi |
| Lucide React | — | Ikon (SVG, tanpa emoji) |
| React Router | 7 | Navigasi |
| React Hook Form + Zod | — | Formulir & validasi |
| Recharts | 3 | Grafik |
| TanStack Query | 5 | Pengambilan data |
| Radix UI | — | Primitif aksesibel (dialog, select, tab, dll.) |
| qrcode | — | QR kartu anggota & nota |
| sonner | — | Notifikasi ringkas (toast) |

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
| Klien MySQL (`mysqldump`, `mysql`) | Opsional — hanya untuk cadangan & pemulihan; di `_vendor/` sudah tersedia |

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
(ditandai `-- [DEMO]`). Seluruh perubahan migrasi 001–006 sudah dilebur ke berkas ini,
jadi pemasangan baru cukup satu impor.

> **Perhatian:** `database.sql` memakai `USE lumen_db`, sehingga mengimpornya akan
> **menimpa** basis data `lumen_db`. Jangan jalankan pada data yang ingin dipertahankan.

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

Atau gunakan skrip pembantu di root: `start-lumen.bat` (Windows).

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

Bila `mysqldump`/`mysql` tidak berada di `_vendor/` atau `PATH`:

```dotenv
MYSQLDUMP_PATH=C:\xampp\mysql\bin\mysqldump.exe
MYSQLCLIENT_PATH=C:\xampp\mysql\bin\mysql.exe
```

> Kedua variabel hanya dipakai oleh fitur **cadangan** dan **pemulihan**. Aplikasi
> tetap berjalan normal tanpanya; endpoint cadangan akan menyebut biner mana yang
> tidak ditemukan.

---

## 7. Akun Demo

| Role | Username | Kata sandi |
|---|---|---|
| Admin / Petugas | `admin` | `Admin123!` |
| Siswa | `andira` | `Siswa123!` |
| Siswa | `bima` | `Siswa123!` |
| Siswa | `citra` | `Siswa123!` |

> Data dan kredensial di atas hanya untuk keperluan demonstrasi/ujian.
>
> Lupa kata sandi? Halaman masuk punya tautan **Lupa kata sandi?** yang membuat
> token reset sekali pakai (berlaku 30 menit) tanpa perlu bantuan petugas.

---

## 8. Cara Mengakses

1. Jalankan database, backend, dan frontend.
2. Buka **http://localhost:5173**.
3. Masuk memakai akun demo di atas.
4. Admin diarahkan ke `/admin`, siswa ke `/perpustakaan`.

**Menu baru yang bisa langsung dicoba**

| Role | Menu | Alamat |
|---|---|---|
| Admin | Meja Sirkulasi | `/admin/sirkulasi` |
| Admin | Denda | `/admin/denda` |
| Admin | Laporan | `/admin/laporan` |
| Admin | Hari Libur | `/admin/hari-libur` |
| Admin | Kunjungan | `/admin/kunjungan` |
| Admin | Stok Opname | `/admin/opname` |
| Admin | Pengumuman | `/admin/pengumuman` |
| Admin | Pengaturan (termasuk cadangan & pemulihan) | `/admin/pengaturan` |
| Siswa | Antrean Saya | `/perpustakaan/reservasi` |
| Siswa | Denda Saya | `/perpustakaan/denda` |
| Siswa | Daftar Keinginan | `/perpustakaan/daftar-keinginan` |
| Publik | Lupa kata sandi | `/lupa-sandi` |

---

## 9. Struktur Proyek

```
UKK/
├─ database.sql              # deliverable database (.sql), sudah memuat migrasi 001-007
├─ migrations/               # riwayat perubahan skema (005 = sirkulasi, 006 = operasional)
├─ start-lumen.bat           # penanda backend + frontend
├─ scripts/
│  ├─ api-test.ps1           # 251 pemeriksaan uji otomatis
│  └─ last-test-run.txt      # hasil uji terakhir
├─ backend/
│  └─ src/
│     ├─ config/             # env + pool database
│     ├─ lib/                # logger, errors, pagination, upload
│     ├─ middleware/         # auth, validate, rate limit, error
│     ├─ modules/            # auth, books, members, loans, fines,
│     │                      # reservations, notifications, backup, scan,
│     │                      # dashboard, excel, activity, settings,
│     │                      # holidays, visits, opname, reviews,
│     │                      # announcements, wishlist
│     ├─ routes/             # registrasi route
│     ├─ app.ts
│     └─ server.ts
├─ frontend/
│  └─ src/
│     ├─ components/         # ui, charts, layout, books
│     ├─ features/auth/      # AuthContext + gerbang ganti sandi
│     ├─ hooks/              # useApi (React Query)
│     ├─ layouts/            # AppShell
│     ├─ lib/                # api, motion, utils
│     ├─ pages/              # admin/, member/, katalog, login
│     ├─ providers/          # ThemeProvider
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
| `npm run lint` | oxlint (pemeriksaan cepat) |

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
| [`docs/DEPLOY.md`](DEPLOY.md) | Opsi deploy ke cloud (Render/Railway) |
| [`docs/METADATA_SERI.md`](METADATA_SERI.md) | Bukti bibliografis setiap metadata seri |
| [`database.sql`](../database.sql) | Struktur & data database |
