# Dokumentasi Fungsi dan Prosedur — LUMEN

Dokumen ini merinci setiap fungsi utama, endpoint REST API, aturan validasi, dan
prosedur (alur) transaksi.

---

## 1. Konvensi Umum

### Format Respons

**Sukses**
```json
{
  "success": true,
  "data": { },
  "meta": { "page": 1, "pageSize": 12, "total": 14, "totalPages": 2,
            "hasNext": false, "hasPrev": false },
  "message": "Buku berhasil ditambahkan."
}
```

**Gagal**
```json
{
  "success": false,
  "code": "BUSINESS_RULE",
  "message": "Anda sudah memiliki 3 buku dipinjam. Maksimal 3 buku.",
  "fields": { "email": "Format email tidak valid." }
}
```

### Kode Status

| Kode | `code` | Arti |
|---|---|---|
| 200 | — | Berhasil |
| 201 | — | Data berhasil dibuat |
| 400 | `BAD_REQUEST` | Permintaan tidak valid |
| 401 | `UNAUTHORIZED` | Belum login / sesi kedaluwarsa |
| 403 | `FORBIDDEN` | Role tidak berwenang |
| 404 | `NOT_FOUND` | Data tidak ada (atau bukan milik pemanggil) |
| 409 | `CONFLICT` | Duplikat / bentrok aturan |
| 422 | `VALIDATION_ERROR` / `BUSINESS_RULE` | Validasi atau aturan bisnis gagal |
| 429 | `TOO_MANY_REQUESTS` | Rate limit tercapai |
| 500 | `INTERNAL_ERROR` | Kesalahan server (detail disembunyikan) |

### Autentikasi

Token JWT dikirim sebagai **httpOnly cookie** `lumen_token`.
Header `Authorization: Bearer <token>` juga diterima (berguna untuk pengujian).

### Parameter List (berlaku untuk semua endpoint list)

| Parameter | Tipe | Default | Keterangan |
|---|---|---|---|
| `page` | int ≥ 1 | `1` | Nomor halaman |
| `pageSize` | int 1–100 | `12` | Jumlah data per halaman |
| `sort` | enum | varies | Kolom urut (**whitelist**) |
| `direction` | `ASC`\|`DESC` | `DESC` | Arah urut |
| `search` | string | — | Pencarian (dengan `LIKE` di-escape) |

> Nama kolom `sort` divalidasi terhadap daftar putih sebelum masuk ke `ORDER BY`,
> sehingga tidak ada jalur SQL injection lewat parameter ini.

---

## 2. Modul Autentikasi — `/api/auth`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/auth/login` | Publik | Masuk |
| POST | `/auth/register` | Publik | Daftar siswa |
| POST | `/auth/logout` | Publik | Keluar (hapus cookie) |
| GET | `/auth/me` | Login | Profil sesi saat ini |
| PATCH | `/auth/profile` | Login | Ubah profil sendiri |
| POST | `/auth/change-password` | Login | Ubah kata sandi sendiri |

### 2.1 `POST /auth/login`

**Body**
```json
{ "identifier": "admin", "password": "Admin123!" }
```
`identifier` menerima username **atau** email.

**Prosedur** (`auth.service.ts › verifyCredentials`)
1. Cari user berdasarkan username atau email.
2. Jika tidak ditemukan → tetap jalankan bcrypt terhadap hash palsu, lalu
   tolak dengan pesan yang **sama persis** dengan kasus sandi salah.
3. `bcrypt.compare` kata sandi.
4. Cek `status = 'active'`.
5. Perbarui `last_login_at`.
6. Tulis `activity_logs` (`auth.login` / `auth.login_failed`).
7. Terbitkan JWT, simpan di cookie httpOnly.

**Validasi**
- `identifier`: wajib, 1–120 karakter.
- `password`: wajib.

**Rate limit:** 20 percobaan / 15 menit / IP. Percobaan **berhasil** tidak dihitung.

**Contoh respons**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "username": "admin", "fullName": "Petugas Perpustakaan",
              "role": "admin", "className": null, "memberCode": null,
              "status": "active", "lastLoginAt": null },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 2.2 `POST /auth/register`

Membuat akun **siswa saja**. Field `role` sengaja tidak ada di skema Zod;
service meng-hardcode `role = 'user'`. **Tidak ada jalur publik untuk membuat admin.**

Kode anggota dibuat server dengan format `MBR-<tahun>-<urutan>` dan dicek
tabrakan sebelum dipakai.

**Validasi**
- `username`: 3–50, hanya `a-z A-Z 0-9 . _ -`
- `email`: format email valid
- `fullName`: 3–100
- `password`: ≥ 8, ≤ 72, harus mengandung huruf **dan** angka
- `confirmPassword`: harus sama dengan `password`

---

## 3. Modul Buku — `/api/books`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/books` | Login | Daftar buku (filter/sort/paginasi) |
| GET | `/books/:id` | Login | Detail buku |
| POST | `/books` | Admin | Tambah buku (multipart, opsional cover) |
| PATCH | `/books/:id` | Admin | Ubah buku (multipart, opsional cover) |
| PATCH | `/books/:id/status` | Admin | Aktif/nonaktif |
| DELETE | `/books/:id/cover` | Admin | Hapus cover |
| DELETE | `/books/:id` | Admin | Hapus / soft delete |

### 3.1 `GET /books`

**Query tambahan:** `categoryId`, `availability` (`all`/`available`/`unavailable`),
`status` (`all`/`active`/`inactive`).

Pencarian mencakup `title`, `author`, dan `isbn`.

### 3.2 `POST /books`

Mendukung `multipart/form-data`. Field berkas bernama **`cover`**.

**Validasi**
| Field | Aturan |
|---|---|
| `isbn` | Wajib, 10–20 karakter, pola ISBN-10/ISBN-13, unik |
| `title` | Wajib, 2–200 |
| `author` | Wajib, 2–150 |
| `publishYear` | 1000 … tahun+1 |
| `categoryId` | Harus kategori yang ada |
| `totalCopies` | 1–999 |
| `cover` | PNG/JPG/WEBP, ≤ 3 MB (divalidasi magic byte) |

**Prosedur**
1. Cek ISBN sudah dipakai → 409 bila iya.
2. Simpan cover (nama file di-random, bukan nama asli).
3. `INSERT` dengan `available_copies = total_copies` (buku baru selalu utuh).
4. Bila `INSERT` gagal → hapus berkas cover yang baru disimpan (tidak ada file yatim).

### 3.3 `PATCH /books/:id`

`total_copies` tidak boleh dikurangi lebih kecil dari jumlah yang sedang
dipinjam. Stok dihitung ulang: `available = total − dipinjam`.

### 3.4 `DELETE /books/:id`

| Kondisi | Hasil |
|---|---|
| Pernah ada transaksi | `status = 'inactive'` (soft delete), `softDeleted: true` |
| Ada eksemplar dipinjam | 409 |
| Tidak ada transaksi | `DELETE` fisik, `deleted: true` |

---

## 4. Modul Kategori — `/api/categories`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/categories` | Login | Daftar kategori + jumlah buku |
| POST | `/categories` | Admin | Tambah kategori |
| PATCH | `/categories/:id` | Admin | Ubah kategori |
| DELETE | `/categories/:id` | Admin | Hapus (ditolak bila masih ada buku) |

---

## 5. Modul Anggota — `/api/members`

Seluruh endpoint **khusus Admin**.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/members` | Daftar anggota (filter status, pencarian 4 kolom) |
| GET | `/members/:id` | Detail anggota |
| POST | `/members` | Tambah anggota |
| PATCH | `/members/:id` | Ubah data |
| PATCH | `/members/:id/status` | Aktif/nonaktif |
| POST | `/members/:id/reset-password` | Atur ulang kata sandi |
| DELETE | `/members/:id` | Hapus / nonaktifkan |

**Catatan penting**

- `password` pada pembuatan **opsional**. Bila dikosongkan, sistem membuat kata sandi
  sementara (`Lum123-4f2a`) dan **mengembalikannya satu kali** di field
  `temporaryPassword` supaya petugas bisa menyerahkannya. Kata sandi polos tidak
  pernah disimpan.
- Akun `role = 'admin'` tidak dapat diubah/dihapus dari halaman anggota.
- Menonaktifkan anggota ditolak bila masih ada peminjaman aktif.
- Menghapus anggota yang punya riwayat transaksi → dinonaktifkan (soft delete).

---

## 6. Modul Transaksi — `/api/loans`

### 6.1 Status dan Transisi

```
pending ──────────┬─► approved ──┬─► borrowed ──┬─► return_requested ─┬─► returned
                  │              │              │                      │
                  ├─► rejected   └─► cancelled  └──────────────────────┴─► borrowed
                  └─► cancelled
```

`returned`, `rejected`, dan `cancelled` adalah status akhir.
Transisi di luar daftar di atas **selalu ditolak** dengan 422.

### 6.2 Endpoint

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/loans` | Login | Daftar (admin: semua; siswa: miliknya) |
| GET | `/loans/mine` | Login | Loans milik pemanggil |
| GET | `/loans/:id` | Login | Detail (404 bila bukan miliknya) |
| POST | `/loans` | Siswa | Ajukan peminjaman |
| POST | `/loans/:id/approve` | Admin | Setujui + **cadangkan stok** |
| POST | `/loans/:id/borrow` | Admin | Tandai diserahkan (`approved→borrowed`) |
| POST | `/loans/:id/reject` | Admin | Tolak (wajib alasan) |
| POST | `/loans/:id/cancel` | Pemilik/Admin | Batalkan |
| POST | `/loans/:id/return-request` | Pemilik/Admin | Ajukan pengembalian |
| POST | `/loans/:id/return-confirm` | Admin | Verifikasi pengembalian |
| PATCH | `/loans/:id/note` | Admin | Simpan catatan |

### 6.3 `POST /loans` — Prosedur

Semua pemeriksaan berikut berjalan dalam **satu transaksi**:

```
BEGIN
  SELECT user FOR UPDATE        → akun harus ada & active & role = 'user'
  cek duplikat                  → tidak boleh sudah ada loan aktif untuk buku ini
  SELECT book FOR UPDATE        → buku harus active, available_copies > 0
  hitung kuota                  → jumlah loan (approved|borrowed|return_requested)
                                  harus < max_loan_per_user
  bila require_approval = 1  → INSERT status 'pending'  (stok tidak berubah)
  bila require_approval = 0  → INSERT status 'borrowed'
                                + UPDATE books SET available = available - 1
COMMIT
```

### 6.4 `POST /loans/:id/approve` — Prosedur

```
BEGIN
  SELECT loan FOR UPDATE        → cek canTransition(pending → approved)
  SELECT user FOR UPDATE        → masih active?
  cek kuota lagi               → masih di bawah batas?
  SELECT book FOR UPDATE        → available_copies >= quantity?
  UPDATE books  SET available_copies = available_copies - quantity
  UPDATE loans  SET status='approved', approved_at=NOW(),
                  approved_by=:admin, due_at = NOW() + :loan_duration_days DAY
COMMIT
```

Mengapa stok dikurangi **di sini**? Karena ini titik di mana perpustakaan
"berjanji" menyediakan eksemplar. Dengan mengunci baris buku (`FOR UPDATE`),
dua approval yang datang bersamaan akan saling menunggu, dan yang kedua
melihat `available_copies = 0` lalu ditolak. Ini yang diuji pada skenario [10].

### 6.5 `POST /loans/:id/return-confirm` — Prosedur

```
BEGIN
  SELECT loan FOR UPDATE        → cek canTransition(borrowed|return_requested → returned)
  UPDATE books SET available_copies = LEAST(available_copies + qty, total_copies)
  UPDATE loans SET status='returned', returned_at=NOW(), returned_by=:admin,
                  return_condition=:c, return_note=:n
COMMIT
```

`LEAST(..., total_copies)` adalah pengaman tambahan: meski request terduplikasi,
stok tidak mungkin melebihi jumlah fisiknya.

### 6.6 Perhitungan Keterlambatan

`daysLate` = selisih hari antara `due_at` dan (`returned_at` bila sudah kembali,
atau waktu sekarang bila masih dipinjam). Denda = `daysLate × late_fee_per_day`.

Tanggal dibaca dari database sebagai string `YYYY-MM-DD HH:mm:ss` **waktu lokal**
(konfigurasi `dateStrings: true`), sehingga tidak terjadi pergeseran satu hari.

### 6.7 Isolasi Data

Siswa hanya dapat melihat transaksinya sendiri:

```ts
// controller
const scope = req.user.role === 'admin' ? undefined : req.user.id;
await listLoans(query, scope);
```

Untuk akses per-transaksi, servlet mengembalikan **404** (bukan 403) bila
transaksi ada tetapi milik orang lain — supaya siswa tidak bisa menebak
id transaksi orang lain.

---

## 7. Modul Dasbor — `/api/dashboard`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/dashboard/admin/overview` | Admin | Angka ringkasan |
| GET | `/dashboard/admin/charts` | Admin | Data grafik |
| GET | `/dashboard/member/overview` | Login | Ringkasan pribadi |

### 7.1 `GET /dashboard/admin/overview`

Semua angka berasal dari agregat SQL nyata:

| Angka | Sumber |
|---|---|
| `totalTitles` | `COUNT(*)` buku aktif |
| `totalCopies` | `SUM(total_copies)` buku aktif |
| `availableCopies` | `SUM(available_copies)` buku aktif |
| `borrowedCopies` | `SUM(total_copies − available_copies)` |
| `activeMembers` | `SUM(role='user' AND status='active')` |
| `pendingApprovals` | `SUM(status='pending')` |
| `overdueLoans` | `SUM(status IN ('borrowed','return_requested') AND due_at < NOW())` |
| `returnRequests` | `SUM(status='return_requested')` |
| `returnedThisMonth` | Pengembalian sejak awal bulan berjalan |

### 7.2 `GET /dashboard/admin/charts`

Query: `from`, `to` (`YYYY-MM-DD`), `bucket` = `day` | `week` | `month`.

Mengembalikan `trend`, `categories`, `statuses`, `topBooks`, `topMembers`.
Filter tanggal benar-benar masuk ke klausa `WHERE ... BETWEEN`, sehingga
rentang kosong menghasilkan `trend: []` dan grafik menampilkan empty state.

---

## 8. Modul Excel — `/api/excel` (Admin)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/excel/template` | Unduh template impor buku |
| GET | `/excel/export/books` | Ekspor buku (mengikuti filter) |
| GET | `/excel/export/members` | Ekspor anggota |
| GET | `/excel/export/loans` | Ekspor transaksi/laporan |
| POST | `/excel/import/books?mode=validate` | Validasi tanpa menyimpan |
| POST | `/excel/import/books?mode=commit` | Simpan baris yang valid |

**Kolom template:** ISBN, Judul, Penulis, Penerbit, Tahun Terbit, Kategori,
Lokasi Rak, Jumlah Eksemplar, Deskripsi.

**Proteksi formula injection:** nilai teks yang diawali `=`, `+`, `-`, `@`, tab,
atau CR diberi awalan `'` agar tidak dievaluasi saat file dibuka.

**Validasi baris:** setiap baris divalidasi dengan skema Zod yang sama seperti
formulir. duplikasi ISBN di dalam file maupun terhadap database ditandai.
Respons `mode=validate` berisi `errors[]` berisi `{ row, field, message }`.

`mode=commit` berjalan dalam satu transaksi — jika satu baris gagal di level SQL,
seluruh impor dibatalkan.

Batas ekspor: **5000 baris** untuk mencegah server kehabisan memori.

---

## 9. Modul Aktivitas — `/api/activity` (Admin)

`GET /activity` dengan `search`, `action`, `page`, `pageSize`.

Menampilkan jejak audit: aktor, aksi, deskripsi, waktu, IP, dan metadata JSON.
Log ditulis dengan `try/catch` sehingga kegagalan pencatatan tidak pernah
membatalkan operasi bisnis yang sudah berhasil.

---

## 10. Modul Pengaturan — `/api/settings`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/settings` | Login | Baca aturan |
| PUT | `/settings` | Admin | Ubah aturan |

`require_approval` dan `allow_self_return` dikirim sebagai boolean dan disimpan
sebagai string `'1'` / `'0'`.

---

## 11. Daftar Fungsi Backend (ringkasan)

| Fungsi | Berkas | Peran |
|---|---|---|
| `getPool`, `query`, `queryOne`, `execute` | `config/db.ts` | Akses SQL terpusat |
| `withTransaction` | `config/db.ts` | Transaksi + rollback otomatis |
| `assertDatabaseConnection` | `config/db.ts` | Cek koneksi saat boot |
| `verifyCredentials` | `modules/auth/auth.service.ts` | Login |
| `registerMember` / `generateMemberCode` | `modules/auth/auth.service.ts` | Registrasi |
| `listBooks` / `createBook` / `updateBook` | `modules/books/books.service.ts` | CRUD buku |
| `deleteBook` | `modules/books/books.service.ts` | Soft/hard delete |
| `bulkCreateBooks` | `modules/books/books.service.ts` | Impor massal (transaksi) |
| `listMembers` / `createMember` | `modules/members/members.service.ts` | CRUD anggota |
| `requestLoan` | `modules/loans/loans.service.ts` | Pengajuan peminjaman |
| `approveLoan` | `modules/loans/loans.service.ts` | Approval + reservasi stok |
| `confirmBorrow` / `rejectLoan` / `cancelLoan` | `modules/loans/loans.service.ts` | Transisi status |
| `requestReturn` / `confirmReturn` | `modules/loans/loans.service.ts` | Pengembalian |
| `canTransition` | `modules/loans/loans.types.ts` | Penjaga state machine |
| `getAdminOverview` / `getTransactionTrend` | `modules/dashboard/dashboard.service.ts` | Statistik & grafik |
| `buildBooksWorkbook` / `parseBooksWorkbook` | `modules/excel/excel.service.ts` | Excel |
| `sanitiseCell` | `modules/excel/excel.service.ts` | Anti formula injection |
| `logActivity` | `modules/activity/activity.service.ts` | Audit trail |
| `requireAuth` / `requireRole` | `middleware/auth.ts` | Otorisasi |
| `validateBody` / `validateQuery` | `middleware/validate.ts` | Validasi Zod |
| `storeCover` | `lib/upload.ts` | Unggah aman (magic byte) |

---

## 12. Daftar Fungsi Frontend (ringkasan)

| Fungsi | Berkas | Peran |
|---|---|---|
| `request` | `lib/api.ts` | Klien fetch + penanganan error |
| `downloadFile` | `lib/api.ts` | Unduh ekspor (cookie ikut) |
| `useAuth` | `features/auth/AuthContext.tsx` | Status sesi & role |
| `useBooks`, `useLoans`, `useMyLoans`, … | `hooks/useApi.ts` | Query React Query |
| `useApiMutation` | `hooks/useApi.ts` | Mutasi + invalidasi cache |
| `useListParams` | `hooks/useApi.ts` | Filter tersinkron URL |
| `useDebounced` | `hooks/useApi.ts` | Debounce pencarian |
| `AppShell` | `layouts/AppShell.tsx` | Sidebar, header, notifikasi |
| `ProtectedRoute` | `routes/guards.tsx` | Gerbang rute + redirect role |
| `ErrorBoundary` | `routes/ErrorBoundary.tsx` | Perlindungan dari render error |
| `CountUp` | `components/ui/book-cover.tsx` | Angka beranimasi |
| `BookCover` | `components/ui/book-cover.tsx` | Cover + fallback lokal |
| Motion presets | `lib/motion.ts` | Bahasa animasi terpusat |
