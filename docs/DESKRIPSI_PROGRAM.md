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
- Bertanggung jawab mengelola koleksi, anggota, dan transaksi.
- Login melalui form yang sama, dialihkan ke `/admin`.
- Kewenangan: seluruh endpoint modul `books`, `members`, `loans` (bagian workflow),
  `excel`, `activity`, `settings`, `dashboard/admin/*`, `fines`, `reservations`,
  `backup`, `scan`, `holidays`, `visits`, `opnames`, `announcements`, dan
  `wishlist` (laporan permintaan).

### 2.2 User / Siswa
- Mendaftar secara mandiri melalui `/daftar`.
- Hanya dapat: melihat katalog, mengajukan peminjaman, mengajukan pengembalian,
  melihat riwayat miliknya sendiri, mengubah profilnya.
- Dapat pula: mengantre buku, memperpanjang pinjaman, membaca denda & notifikasi
  miliknya, menulis ulasan, menyimpan daftar keinginan, dan membaca pengumuman.
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
  │                                     ├── kondisi 'good'  → stok + 1
  │                                     ├── kondisi 'rusak' → damaged + 1
  │                                     ├── kondisi 'hilang'→ total − 1
  │                                     ├── INSERT fines (snapshot)
  │                                     ├── UPDATE loans (returned)
  │                                     ├── promosikan antrean → 'ready'
  │                                     │  COMMIT
  │◄───────────────────────────────────┤ 200 (denda + posisi antrean)
```

Stok **tidak** bertambah saat siswa mengajukan pengembalian, tetapi hanya setelah
petugas memverifikasi buku. Ini mencegah stok bertambah tanpa buku benar-benar
kembali.

Kondisi buku menentukan ke mana eksemplar itu pergi:

| Kondisi | `available_copies` | `damaged_copies` | `total_copies` | Denda |
|---|---|---|---|---|
| Baik | +1 | — | — | hanya keterlambatan |
| Rusak | — | +1 | — | `damaged_fee` + keterlambatan |
| Hilang | — | — | −1 | `lost_fee` + keterlambatan |

Buku rusak tetap milik perpustakaan, jadi `total_copies` tidak berubah — hanya
pindah dari "bisa dipinjam" ke "tidak bisa dipinjam". Buku hilang benar-benar
lenyap dari inventaris, sehingga totalnya berkurang.

### 3.3 Alur Peminjaman di Meja Sirkulasi

```
Petugas                              Backend
  │ 1. pindai kartu anggota            │
  ├────────────────────────────────────►│  GET /scan?code=MBR-…
  │                                      │  → kind: member, lalu GET /members/:id
  │ 2. pindai barcode buku              │
  ├────────────────────────────────────►│  GET /scan?code=978-…
  │                                      │  → kind: book, lalu GET /books/:id
  │ 3. konfirmasi                       │
  ├────────────────────────────────────►│  POST /loans/counter
  │                                      │  BEGIN
  │                                      ├── cek denda belum lunas
  │                                      ├── cek kuota anggota
  │                                      ├── kunci baris buku
  │                                      ├── INSERT loans (borrowed)
  │                                      └── stok − 1
  │◄────────────────────────────────────┤ 201 + jatuh tempo + kode transaksi
```

Jalur ini tidak mengharuskan siswa membuat permohonan lebih dulu. Yang dijaga tetap
sama: kuota, ketersediaan stok, dan gerbang denda. Bedanya hanya siapa yang menekan
tombol.

Pemindai bekerja seperti papan ketik: ia mengetik kode lalu menekan Enter. Karena
itu satu kolom dapat menerima **tiga jenis kode** sekaligus — kartu anggota,
barcode ISBN, dan nota transaksi — dan server yang menentukan jenisnya. Meminta
petugas memilih "mode" sebelum memindai akan menambah satu klik pada setiap
peminjaman, dan itulah yang membuat staf berhenti memakai pemindai.

### 3.4 Alur Antrean Buku

```
Stok habis
   │
   ├─ Siswa menekan "Antre buku"  ──►  reservations (waiting, posisi dari created_at)
   │
   ├─ Buku dikembalikan           ──►  antrean terdepan → 'ready'
   │                                   + notifikasi "siap diambil"
   │                                   + expires_at = NOW() + reservation_hold_days
   │
   ├─ Diambil & dipinjamkan       ──►  'fulfilled'
   ├─ Dibatalkan siswa            ──►  'cancelled', posisi di belakang bergeser
   └─ Lewat expires_at            ──►  'expired', kesempatan pindah ke berikutnya
```

Posisi antrean **tidak disimpan**. Ia dihitung dari urutan `created_at` setiap kali
dibaca, sehingga pembatalan di tengah tidak memerlukan UPDATE massal untuk
menggeser semua orang di belakangnya.

### 3.5 Alur Penghapusan Aman

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
- **Reset kata sandi mandiri**: token sekali pakai berlaku 30 menit, yang disimpan
  hanya hash SHA-256-nya. Kedua langkah (`forgot-password`, `reset-password`)
  dibatasi rate limit — yang pertama menahan pembuatan token massal, yang kedua
  menahan percobaan menebak token.
- **Wajib ganti kata sandi**: akun yang dibuat lewat impor Excel ditandai
  `must_change_password`. Selama tanda itu aktif, aplikasi hanya menampilkan
  layar ganti kata sandi — tidak bisa ditutup dengan Escape atau klik latar.
  Mengganti kata sandi sendiri maupun reset oleh petugas membersihkan tanda itu.

### 4.2 Modul Buku
CRUD lengkap, upload cover, filter, sorting, pagination server-side, soft delete.
Validasi ISBN-10/ISBN-13 dan pencegahan duplikasi.

Cover memiliki **fallback lokal**: bila tidak ada gambar, sistem membuat sampul
tipografi deterministik dari judul (tanpa memanggil layanan gambar eksternal).

Stok dipecah tiga: `total_copies`, `available_copies`, dan `damaged_copies`
(sejak migrasi 005). Eksemplar rusak tetap inventaris tetapi tidak dapat dipinjam.

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

Di atas mesin status itu ada empat kemampuan tambahan:

- **Meja sirkulasi** — petugas membuat peminjaman langsung tanpa permohonan siswa,
  dengan dukungan pemindai kartu anggota dan barcode buku.
- **Perpanjangan** — menambah `due_at` sebanyak N hari, dibatasi `max_renewals`
  dan ditolak bila sudah terlambat.
- **Batas pengambilan** — `pickup_deadline` disimpan saat approve; lewat tenggat,
  transaksi tampil `pickup_expired` dan dapat dilepas.
- **Denda** — keterlambatan/kerusakan/kehilangan dicatat sebagai baris `fines`.

### 4.5 Modul Denda
Denda adalah **data**, bukan angka tampilan. Saat pengembalian dikonfirmasi, nominal
dihitung sekali lalu disimpan. Tarif boleh berubah kapan saja tanpa menulis ulang
tagihan lama.

| Jenis | Nominal | Kapan |
|---|---|---|
| `late` | `daysLate × late_fee_per_day` | Setiap hari lewat jatuh tempo |
| `damaged` | `damaged_fee` | Kondisi kembali = rusak |
| `lost` | `lost_fee` | Buku dinyatakan hilang |

Pelunasan dan pembebasan dilakukan admin di meja petugas. `UNIQUE (loan_id, kind)`
+ `INSERT IGNORE` membuat klik ganda tidak menggandakan tagihan.

### 4.6 Modul Reservasi
Antrean saat stok habis. Posisi dihitung dari `created_at`; promosi ke `ready`
terjadi otomatis ketika buku kembali, disertai notifikasi dan tenggat
`reservation_hold_days`.

Jumlah antrean aktif dibatasi `max_reservations_per_user`. Posisi antrean dihitung
dengan subquery berkorelasi di dalam query daftar, sehingga satu halaman antrean
tetap satu query — bukan satu query per baris.

### 4.7 Modul Notifikasi
Notifikasi dalam aplikasi untuk persetujuan, jatuh tempo, denda baru, dan buku
pesanan yang siap diambil. Pengingat jatuh tempo **dibuat saat dibaca** dengan
`dedupe_key` unik, sehingga tidak butuh cron dan tidak pernah dobel.

### 4.8 Modul Dasbor
Statistik dihitung dari query agregat (`COUNT`, `SUM`, `CASE WHEN`) — bukan
angka dummy. Filter rentang tanggal benar-benar mengubah `WHERE` klausa.

Laporan tambahan: buku yang tidak pernah dipinjam, anggota paling sering terlambat,
dan rekap denda per jenis.

### 4.9 Modul Excel
- Ekspor buku / anggota / transaksi / denda ke `.xlsx`.
- Impor buku dari template dengan validasi per baris dan laporan kesalahan.
- Impor anggota dari template: satu kata sandi batch, kode anggota berurutan dalam
  satu transaksi, dan `must_change_password` untuk setiap akun baru.
- Alur dua langkah: `mode=validate` (tidak menulis) lalu `mode=commit`.
- **Perlindungan formula injection**: nilai teks yang diawali `=`, `+`, `-`, `@`
  diberi awalan tanda kutip tunggal.
- Impor berjalan dalam satu transaksi: gagal di tengah ⇒ seluruh impor dibatalkan.

### 4.10 Modul Cadangan
Unduh dump `.sql` lengkap lewat `mysqldump` di server, dan pulihkan kembali dari
berkas tersebut. Sengaja manual: berkas yang benar-benar disimpan petugas lebih
berguna daripada job terjadwal yang menulis ke folder yang tidak pernah diperiksa.

Pemulihan dijaga konfirmasi literal `PULIHKAN` dan pemeriksaan isi berkas sebelum
satu tabel pun disentuh.

### 4.11 Modul Aktivitas
Audit trail untuk login, CRUD, dan setiap transisi transaksi.

### 4.12 Modul Operasional Harian (migrasi 006)
- **Hari libur** — kalender tanggal merah yang menggeser jatuh tempo; hari Minggu
  selalu dilewati, Sabtu tetap dianggap hari kerja.
- **Kunjungan** — kehadiran anggota (pindai kartu) dan tamu, dengan ringkasan harian.
- **Stok opname** — snapshot `expected` saat sesi dibuka, lalu penerapan selisih
  ke stok tanpa mengganggu eksemplar yang sedang dipinjam.
- **Ulasan & rating** — satu ulasan per anggota per buku, dengan syarat
  `review_requires_loan`.
- **Daftar keinginan** — penanda baca pribadi yang tidak memesan stok, plus laporan
  judul paling diminati untuk pengadaan.
- **Pengumuman** — audiens `all`/`user`/`admin`, disaring di SQL, dengan kedaluwarsa
  yang diturunkan dari `NOW()`.

---

## 5. Arsitektur

### 5.1 Gambaran Umum

```
┌──────────────────────────────────────────────────────────────┐
│  Browser  (http://localhost:5173)                            │
│  ┌────────────┐ ┌─────────────┐ ┌──────────────────────────┐ │
│  │  Pages     │ │  Hooks      │ │  Components              │ │
│  │  (Route-   │ │ (React Query)│ │  ui / charts / layout    │ │
│  │   level    │ │             │ │  / books                 │ │
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
│  │  └─ /auth  /books  /categories  /collections  /members  │  │
│  │     /loans  /fines  /reservations  /notifications       │  │
│  │     /reviews  /wishlist  /announcements  /holidays      │  │
│  │     /visits  /opnames  /backup  /scan  /dashboard       │  │
│  │     /activity  /settings  /excel                        │  │
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
│  users · categories · books · loans · fines · reservations   │
│  notifications · password_resets · activity_logs · settings  │
│  authors · book_series · book_series_items                   │
│  holidays · library_visits · stock_opnames · book_reviews    │
│  announcements · wishlists                                   │
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
  layout/       PageHeader, PageBody, NotificationCenter
  books/        Ulasan & rating buku
features/auth/  AuthContext + hook + gerbang wajib ganti sandi
hooks/          useApi — semua query & mutasi
lib/            api client, motion presets, utils
providers/      ThemeProvider (mode gelap)
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
| Token reset bocor | Yang disimpan hanya SHA-256; token asli tidak pernah masuk database |
| Upload berbahaya | Validasi *magic byte* (bukan ekstensi), nama file di-random, batas ukuran |
| Formula injection | Awalan tanda kutip pada nilai Excel berisiko formula |
| Kebocoran info internal | Error 500 tidak pernah mengembalikan stack trace |
| Path traversal | Penghapusan berkas dibatasi ke direktori `uploads/covers` |
| Dump basis data disalahgunakan | `/api/backup/database` hanya untuk admin |

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
| `max_renewals` | 1 | Perpanjangan ke-2 ditolak; `0` mematikan fitur |
| `pickup_window_days` | 2 | `pickup_deadline = NOW() + 2 hari` saat approve |
| `fine_block_borrow` | 1 | Denda belum lunas memblokir pinjaman baru |
| `damaged_fee` | 5000 | Denda tetap untuk buku rusak |
| `lost_fee` | 50000 | Denda tetap untuk buku hilang |
| `reservation_hold_days` | 2 | Tenggat antrean `ready` sebelum pindah |
| `due_date_skip_holidays` | 1 | Jatuh tempo digeser melewati libur/Minggu |
| `max_reservations_per_user` | 3 | Antrean aktif ke-4 ditolak |
| `review_requires_loan` | 1 | Ulasan hanya dari anggota yang pernah meminjam |
| `visit_tracking_enabled` | 1 | Pencatatan kunjungan perpustakaan aktif |

### Menghitung keterlambatan

Perhitungan dilakukan di SQL agar jam penulis dan pemeriksa satu sumber:

```sql
DATEDIFF(returned_at, due_at) AS days_late
```

Lalu di service:

```ts
const daysLate = Math.max(0, Number(row.days_late ?? 0));
const lateFee  = daysLate * setting.lateFeePerDay;
if (lateFee > 0) await createFine({ loanId, kind: 'late', amount: lateFee });
```

`returned_at` adalah waktu pengembalian yang dicatat server. Tanggal dibaca sebagai
string `YYYY-MM-DD HH:mm:ss` waktu lokal (`dateStrings: true`) untuk menghindari
selisih satu hari akibat konversi zona waktu.

Mengubah `late_fee_per_day` **tidak** mengubah denda yang sudah tercatat: nominalnya
sudah menjadi baris data di tabel `fines`.

### Menggeser jatuh tempo melewati hari libur

Bila `due_date_skip_holidays = 1`, tanggal jatuh tempo yang jatuh pada hari Minggu
atau tanggal di tabel `holidays` digeser ke hari kerja berikutnya. Perhitungannya
dilakukan di SQL dengan recursive CTE (`WITH RECURSIVE seq`), lalu tanggal akhir
tetap dibentuk oleh SQL:

```sql
DATE_ADD(NOW(), INTERVAL ? DAY)
```

Jendela pencarian dibatasi 30 hari agar tidak ada kemungkinan loop tak berujung
bila seluruh kalender ditandai libur. Aturan yang sama dipakai untuk
`pickup_deadline` saat approve. Sabtu **tidak** digeser secara otomatis — bila
perpustakaan tutup Sabtu, tambahkan Sabtu sebagai hari libur di kalender.

Hal yang sama berlaku untuk perhitungan "sekarang": `CURDATE()`, `NOW()`, dan
`DATE_ADD` di SQL — bukan `new Date()` di Node.

---

## 7. Keterbatasan yang Diketahui

Didaftarkan dengan jujur di `docs/LAPORAN_EVALUASI.md`:

1. **Validasi ISBN hanya format**, bukan checksum. Katalog sekolah sering memuat
   ISBN cetakan lokal yang gagal checksum.
2. **Tidak ada verifikasi email** saat pendaftaran.
3. **Token reset kata sandi ditampilkan di layar**, bukan dikirim lewat email —
   instalasi ini belum punya server surat. Petugas menyerahkannya langsung.
4. **Gambar cover tidak dikompresi** di server.
5. **Rate limiter memakai store in-memory**, sehingga akan reset bila server
   dimulai ulang.
6. **Tidak ada notifikasi push/email** — notifikasi hanya muncul di dalam aplikasi.
7. **Cadangan tidak terjadwal** — diunduh manual oleh petugas.
8. **Antrean dibatasi `max_reservations_per_user`** (default 3), tetapi batas ini
   dapat dinaikkan admin sampai 20 — bukan batas keras.
9. **Pemindai membutuhkan perangkat** — kolom pindai menerima input dari barcode
   scanner USB/Bluetooth. Kamera ponsel belum dipakai sebagai pemindai, tetapi
   kode tetap dapat diketik manual.
10. **Penggeseran jatuh tempo tidak melewati Sabtu** — hanya Minggu dan tanggal di
    tabel `holidays`. Bila perpustakaan tutup Sabtu, tambahkan Sabtu sebagai hari
    libur di kalender.
11. **Pemulihan database memutus sesi** — data pengguna diganti isi dump, sehingga
    token lama merujuk baris yang sudah tidak ada. Semua pengguna perlu masuk ulang.
12. **Kata sandi impor dibagikan sekali** — satu kata sandi untuk satu batch. Bila
    terlanjur hilang, jalan keluarnya adalah atur ulang per anggota.
13. **Ulasan tidak dimoderasi** — komentar yang kurang pantas baru hilang setelah
    petugas menghapusnya. Tidak ada filter kata otomatis.
