# Deskripsi Program — LUMEN

Dokumen ini menjelaskan tujuan, pengguna, alur kerja, fitur, dan arsitektur aplikasi.

---

## 1. Tujuan Aplikasi

Digitalisasi proses peminjaman dan pendataan buku di sekolah dengan mengganti
proses manual berbasis buku catatan menjadi sistem yang:

1. **Terhubung ke database** — data yang asli dan persisten, bukan data dummy di frontend.
2. **Berjalan lokal** — seluruh aplikasi berjalan di `localhost` tanpa internet.
3. **Terbaca oleh kedua pihak** — petugas mengelola, siswaônico memakai.
4. **Konsisten** — stok buku tidak pernah menjadi negatif atau melebihi total.
5. **Mudah diaudit** — setiap tindakan penting tercatat di `activity_logs`.

### Masalah yang diselesaikan

| Sebelum (manual) |Sesudah (LUMEN) |
|---|---|
| Buku catatan peminjaman mudah hilang | Data tersimpan permanen di database |
| Sulit mengetahui stok buku terkini | Stok tampil real-time di katalog |
| Sulit mencari buku (hanya rak) | Pencarian judul/penulis/ISBN |
| Tidak ada riwayat keterlambatan | Deteksi otomatis lewat jatuh tempo |
| Sulit membuat laporan | Ekspor Excel + dasbor grafik |

---

## 2. Pengguna

### 2.1 Admin / Petugas Perpustakaan
-Bertanggung jawab mengelola koleksi, anggota, dan transaksi.
- Login melalui form yang sama, dialihkan ke `/admin`.
- Kewenangan: seluruh endpoint modul `books`, `members`, `loans` (bagian workflow),
  `excel`, `activity`, `settings`, dan `dashboard/admin/*`.

### 2.2 User / Siswa
- Mendaftar secara mandiri melalui `/daftar`.
- Hanya dapat: melihat katalog, mengajukan peminjaman, mengajukan pengembalian,
  melihat riwayat miliknya sendiri, mengubah profilnya.
- **Tidak dapat** mengelola buku/anggota, mengubah role, atau melihat data anggota lain.

### 2.3 Prinsip otorisasi

> Menyembunyikan tombol di frontend **bukan** mekanisme keamanan.

Setiap endpoint sensitif memanggil `requireAuth` dan/atau `requireAdmin` di sisi
server. Contoh pengujian nyata ada di `scripts/api-test.ps1` bagian `[3] Otorisasi`.

---

## 3. Alur Kerja

### 3.1 Alur Peminjaman

```
Siswa                          Backend                         Database
  │                                │                                │
  │ 1. Login                       │                                │
  ├───────────────────────────────►│  verifikasi bcrypt             │
  │◄───────────────────────────────┤  set cookie httpOnly           │
  │                                │                                │
  │ 2. Buka katalog, pilih buku    │                                │
  ├───────────────────────────────►│  GET /books?search=...         │
  │◄───────────────────────────────┤  hasil + meta pagination       │
  │                                │                                │
  │ 3. POST /loans { bookId }      │                                │
  ├───────────────────────────────►│  BEGIN                          │
  │                                ├──── SELECT user FOR UPDATE ────►│
  │                                ├──── cek duplikat ──────────────►│
  │                                ├──── SELECT book FOR UPDATE ────►│
  │                                ├──── cek stok & kuota ──────────►│
  │                                ├──── INSERT loans (pending) ────►│
  │                                │  COMMIT                        │
  │◄───────────────────────────────┤ 201 "menunggu persetujuan"      │
  │                                │                                │
  │         Petugas menyetujui     │                                │
  │                                │  BEGIN                          │
  │                                ├──── SELECT loan FOR UPDATE ────►│
  │                                ├──── SELECT book FOR UPDATE ────►│
  │                                ├──── UPDATE books (stok - 1) ───►│
  │                                ├──── UPDATE loans (approved,    │
  │                                │        due_at = now + N hari)  │
  │                                │  COMMIT                        │
  │                                │                                │
  │ 4. Petugas serahkan buku      │                                │
  ├───────────────────────────────►│  approved → borrowed           │
  │◄───────────────────────────────┤  (stok TIDAK berubah lagi)      │
```

**Kapan stok berkurang?** Saat **approve**, bukan saat request. Dengan begitu
eksemplar sudah "dipesan" untuk peminjam sehingga dua siswa tidak bisa
mendapatkan eksemplar terakhir yang sama.

**Kapan stok bertambah?** Saat pengembalian dikonfirmasi petugas.

### 3.2 Alur Pengembalian

```
Siswa                                Petugas
  │  POST /loans/:id/return-request     │
  ├───────────────────────────────────►│  borrowed → return_requested
  │◄───────────────────────────────────┤ (stok BELUM bertambah)
  │                                    │
  │  Serahkan buku ke loket             │
  │───────────────────────────────────►│  POST /loans/:id/return-confirm
  │                                     │  { condition, note }
  │                                     │  BEGIN
  │                                     ├── UPDATE books (stok + 1,
  │                                     │         LEAST(..., total))
  │                                     ├── UPDATE loans (returned,
  │                                     │         returned_at = NOW())
  │                                     │  COMMIT
  │◄───────────────────────────────────┤ 200 (catat hari keterlambatan)
```

Stok **tidak** bertambah saat siswa mengajukan pengembalian, tetapi hanya setelah
petugas memverifikasi buku. Ini mencegah stok bertambah tanpa buku benar-benar
kembali.

### 3.3 Alur Penghapusan Aman

```
Coba hapus buku
   │
   ├─ Sudah pernah ada transaksi?  ──YA──►  status = 'inactive' (soft delete)
   │                                        pesan: "dinonaktifkan, bukan dihapus"
   └──BELUM──►  DELETE FROM books  ✔
```

---

## 4. Fitur

### 4.1 Modul Autentikasi
- Login dengan username **atau** email.
- Kata sandi di-hash dengan **bcrypt** (cost 10), tidak pernah dikembalikan API.
- Pesan error identik untuk "user tidak ada" dan "sandi salah" agar tidak bisa
  dipakai menebak username yang valid.
- Token JWT disimpan di **httpOnly cookie** (bukan `localStorage`), sehingga tidak
  bisa dicuri oleh skrip XSS.
- Rate limit 20 percobaan / 15 menit per IP pada endpoint login & registrasi.
- Registrasi publik hanya menghasilkan role `user`; kode anggota dibuat server.

### 4.2 Modul Buku
CRUD lengkap, upload cover, filter, sorting, pagination server-side, soft delete.
Validasi ISBN-10/ISBN-13 dan pencegahan duplikasi.

Cover memiliki **fallback lokal**: bila tidak ada gambar, sistem membuat sampul
tipografi deterministik dari judul (tanpa memanggil layanan gambar eksternal).

### 4.3 Modul Anggota
CRUD, kode anggota berurutan (`MBR-<tahun>-<urutan>`), reset kata sandi, paginasi.
Anggota yang memiliki riwayat transaksi tidak dapat dihapus fisik.

### 4.4 Modul Transaksi
Mesin status dengan transisi yang didefinisikan eksplisit:

```ts
pending          → approved | rejected | cancelled
approved         → borrowed  | cancelled
borrowed         → return_requested | returned
return_requested → returned  | borrowed
returned         → (akhir)
rejected         → (akhir)
cancelled        → (akhir)
```

Transisi yang tidak tercantum **tidak mungkin** terjadi karena selalu dicek
terhadap tabel ini.

### 4.5 Modul Dasbor
Statistik dihitung dari query agregat (`COUNT`, `SUM`, `CASE WHEN`) — bukan
angka dummy. Filter rentang tanggal benar-benar mengubah `WHERE` klausa.

### 4.6 Modul Excel
- Ekspor buku / anggota / transaksi ke `.xlsx`.
- Impor buku dari template dengan validasi per baris dan laporan kesalahan.
- **Perlindungan formula injection**: nilai teks yang diawali `=`, `+`, `-`, `@`
  diberi awalan tanda kutip tunggal.
- Impor berjalan dalam satu transaksi: gagal di tengah ⇒ seluruh impor dibatalkan.

### 4.7 Modul Aktivitas
Audit trail untuk login, CRUD, dan setiap transisi transaksi.

---

## 5. Arsitektur

### 5.1 Gambaran Umum

```
┌──────────────────────────────────────────────────────────────┐
│  Browser  (http://localhost:5173)                            │
│  ┌────────────┐ ┌─────────────┐ ┌──────────────────────────┐ │
│  │  Pages     │ │  Hooks      │ │  Components              │ │
│  │  (Route-   │ │ (React Query)│ │  ui / charts / layout    │ │
│  │   level    │ │             │ │                          │ │
│  │  lazy load)│ └──────┬──────┘ └──────────────────────────┘ │
│  └────────────┘        │                                      │
│                        │  fetch (credentials: include)       │
└────────────────────────┼─────────────────────────────────────┘
                         │  /api/*  (Vite dev proxy)
┌────────────────────────▼─────────────────────────────────────┐
│  Express  (http://localhost:4000)                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ helmet · cors · cookieParser · express.json            │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ routes/index.ts                                        │  │
│  │  └─ /auth  /books  /categories  /members  /loans       │  │
│  │     /dashboard  /activity  /settings  /excel           │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ middleware:  auth (JWT+role) · validate (Zod)          │  │
│  │               rateLimit · error (pusat)                │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ controllers  → services  → config/db (mysql2 pool)     │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ lib: logger · errors · pagination · upload             │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────┘
                         │  mysql2 (parameterized query)
┌────────────────────────▼─────────────────────────────────────┐
│  MariaDB 11.4  (127.0.0.1:3307 / lumen_db)                   │
│  users · categories · books · loans · activity_logs · settings│
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Pola Layer (Backend)

```
routes/  ──►  controller  ──►  service  ──►  config/db
 (URL)        (req/res)        (bisnis)       (SQL)
```

- **Route** mendefinisikan URL dan urutan middleware.
- **Controller** hanya menangani HTTP: validasi sudah selesai di middleware,
  service dipanggil, hasil dikirim sebagai JSON.
- **Service** berisi seluruh logika bisnis dan transaksi database. Tidak
  bergantung pada Express, sehingga dapat diuji terpisah.
- **config/db** adalah satu-satunya tempat SQL mentah ditulis.

### 5.3 Struktur (Frontend)

```
pages/          Halaman (level route, lazy-loaded)
layouts/        AppShell (sidebar + header)
components/
  ui/           Primitif: Button, Input, Dialog, Table, Badge, ...
  charts/       Wrapper Recharts
  layout/       PageHeader, PageBody
features/auth/  AuthContext + hook
hooks/          useApi — semua query & mutasi
lib/            api client, motion presets, utils
routes/         guards, ErrorBoundary
types/          Definisi tipe TypeScript
```

### 5.4 State di Sisi Server

Seluruh data bisnis berasal dari server. **Tidak ada** data produksi yang
disimpan di `localStorage`. Satu-satunya state di browser adalah:

- cookie sesi `lumen_token` (httpOnly, dikelola server),
- cache React Query (di memori, dapat dibuang tanpa kehilangan data).

### 5.5 Strategi Keamanan

| Ancaman | Mitigasi |
|---|---|
| SQL Injection | Seluruh query memakai *prepared statement* (`?`), nama kolom sort dari *whitelist* |
| XSS | React meng-escape teks; cookie httpOnly tidak dapat dibaca skrip |
| Broken access control | `requireAuth` + `requireRole` + pemeriksaan kepemilikan di service |
| Password lemah | bcrypt cost 10, validasi kekuatan (min 8, huruf + angka) |
| Brute force | `express-rate-limit` pada endpoint autentikasi |
| enumerated account | Pesan error login dibuat identik |
| Upload berbahaya | Validasi *magic byte* (bukan ekstensi), nama file di-random, batas ukuran |
| Formula injection | Awalan tanda kutip pada nilai Excel berisiko formula |
| Kebocoran info internal | Error 500 tidak pernah mengembalikan stack trace |
| Path traversal | Penghapusan berkas dibatasi ke direktori `uploads/covers` |

---

## 6. Kebijakan Operasional

Aturan ini **disimpan di database** (tabel `settings`) dan dapat diubah admin
lewat halaman Pengaturan — tidak di-hardcode.

| Aturan | Default | Dampak |
|---|---|---|
| `max_loan_per_user` | 3 | Peminjaman ke-4 ditolak |
| `loan_duration_days` | 7 | `due_at = NOW() + 7 hari` |
| `require_approval` | 1 | Permohonan menunggu persetujuan |
| `allow_self_return` | 1 | Siswa boleh mengajukan pengembalian |
| `late_fee_per_day` | 1000 | Denda dihitung dari `daysLate` |

### Menghitung keterlambatan

```ts
const diffDays = Math.floor((endTime - dueAt) / 86_400_000);
const daysLate = diffDays > 0 ? diffDays : 0;
const lateFee  = daysLate * settings.lateFeePerDay;
```

`endTime` adalah waktu pengembalian jika sudah kembali, atau waktu sekarang jika
masih dipinjam. Tanggal dibaca sebagai string `YYYY-MM-DD HH:mm:ss` waktu lokal
(`dateStrings: true`) untuk menghindari selisih satu hari akibat konversi zona waktu.

---

## 7. Keterbatasan yang Diketahui

Didaftarkan dengan jujur di `docs/LAPORAN_EVALUASI.md`:

1. **Validasi ISBN hanya format**, bukan checksum. Katalog sekolah sering memuat
   ISBN cetakan lokal yang gagal checksum.
2. **Tidak ada verifikasi email** saat pendaftaran.
3. **Tidak ada pemulihan kata sandi** mandiri — harus lewat petugas.
4. **Gambar cover tidak dikompresi** di server.
5. **Rate limiter memakai store in-memory**, sehingga akan reset bila server
   dimulai ulang.
