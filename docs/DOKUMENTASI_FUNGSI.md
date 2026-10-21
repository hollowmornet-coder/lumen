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
| POST | `/auth/avatar` | Login | Unggah foto profil (multipart) |
| DELETE | `/auth/avatar` | Login | Hapus foto profil |
| POST | `/auth/change-password` | Login | Ubah kata sandi sendiri |
| POST | `/auth/forgot-password` | Publik | Minta token reset (rate limited) |
| POST | `/auth/reset-password` | Publik | Tukar token dengan sandi baru |

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

### 2.3 `POST /auth/forgot-password` — Reset mandiri langkah 1

**Body**
```json
{ "identifier": "bima" }
```

`identifier` menerima username, email, **atau** kode anggota.

Prosedur (`password-reset.service.ts › issueResetToken`):
1. Cari pengguna lewat username, email, atau kode anggota. Bila tidak ada → 404
   dengan pesan umum; akun nonaktif ditolak `ACCOUNT_INACTIVE`.
2. Hapus token lama yang belum terpakai milik pengguna itu — permintaan terbaru
   yang berlaku, sehingga tidak pernah ada dua tautan hidup sekaligus.
3. Buat token acak 24 byte (hex 48 karakter).
4. Simpan **hanya** SHA-256 dari token, beserta
   `expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE)`.

Kedaluwarsa dihitung oleh MySQL, bukan JavaScript. `toISOString()` menghasilkan UTC
sementara kolom dibandingkan dengan `NOW()` waktu lokal — di server UTC+7 token
langsung dianggap kedaluwarsa begitu dibuat. Menyerahkan penulisan dan pemeriksaan
waktu ke satu jam yang sama menghilangkan seluruh kelas bug ini.

Karena instalasi ini belum punya server surat, token dikembalikan di body respons
agar petugas dapat menyerahkannya. Pada pemasangan berjaringan, bagian itu diganti
pengiriman email dan respons tidak lagi memuat token.

### 2.4 `POST /auth/reset-password` — Reset mandiri langkah 2

**Body**
```json
{ "token": "<48 karakter>", "newPassword": "Siswa456!", "confirmPassword": "Siswa456!" }
```

Token diperiksa di SQL (`used_at IS NULL AND expires_at > NOW()`), lalu ditandai
terpakai dan kata sandi di-hash ulang dengan bcrypt. Token yang sama tidak dapat
dipakai dua kali (`TOKEN_USED`).

### 2.5 `POST /auth/avatar` — Unggah foto profil

`multipart/form-data`, field berkas bernama **`avatar`**. Berlaku untuk kedua role
(siswa maupun petugas).

**Format & batas**

| Aspek | Nilai |
|---|---|
| Format | PNG, JPG, WEBP, **GIF** (animasi didukung) |
| Ukuran maksimal | 5 MB (`AVATAR_MAX_UPLOAD_BYTES`, env `AVATAR_MAX_UPLOAD_MB`) |
| Lokasi simpan | `uploads/avatars/<32 hex>.<ext>` |
| Nama berkas | Dibuat server; nama asli dari klien tidak pernah dipakai |

**Prosedur** (`auth.controller.ts › uploadAvatar`)
1. `avatarUpload` menolak MIME yang bukan `image/*` dan berkas > 5 MB.
2. `storeAvatar()` memeriksa **magic bytes** — ekstensi dan MIME dari klien tidak
   dipercaya. SVG sengaja tidak diterima karena bisa memuat skrip (XSS).
3. Berkas ditulis ke disk dengan nama acak, **byte asli tanpa re-encode** sehingga
   GIF tetap beranimasi.
4. `users.avatar_path` diperbarui, lalu berkas lama dihapus (best-effort).
5. Respons berisi `PublicUser` terbaru (termasuk `avatarPath`) agar klien dapat
   langsung memakai `setUser`.

Bila `UPDATE` gagal, berkas baru yang sudah tertulis ikut dihapus sehingga tidak
ada berkas yatim.

**Respons 200**
```json
{
  "success": true,
  "data": { "id": 2, "fullName": "Andira Prameswari", "avatarPath": "/uploads/avatars/3f9a….gif", "...": "…" },
  "message": "Foto profil berhasil diperbarui."
}
```

**Kegagalan**

| Kondisi | Status | Kode |
|---|---|---|
| Bukan gambar / magic bytes tidak cocok | 400 | `BAD_REQUEST` |
| Berkas > 5 MB | 400 | `UPLOAD_ERROR` |
| Tanpa sesi | 401 | `UNAUTHORIZED` |
| Terlalu sering mengunggah | 429 | `TOO_MANY_REQUESTS` |

### 2.6 `DELETE /auth/avatar` — Hapus foto profil

Mengosongkan `avatar_path` dan menghapus berkasnya. **Idempoten**: memanggilnya
saat anggota belum punya foto tetap menghasilkan `200`.

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
| POST | `/loans/counter` | Admin | Peminjaman langsung di loket |
| POST | `/loans/:id/approve` | Admin | Setujui + **cadangkan stok** |
| POST | `/loans/:id/borrow` | Admin | Tandai diserahkan (`approved→borrowed`) |
| POST | `/loans/:id/reject` | Admin | Tolak (wajib alasan) |
| POST | `/loans/:id/cancel` | Pemilik/Admin | Batalkan |
| POST | `/loans/:id/release` | Admin | Lepas jatah yang lewat batas ambil |
| POST | `/loans/:id/renew` | Pemilik/Admin | Perpanjang jatuh tempo |
| POST | `/loans/:id/return-request` | Pemilik/Admin | Ajukan pengembalian |
| POST | `/loans/:id/return-confirm` | Admin | Verifikasi pengembalian |
| POST | `/loans/bulk-approve` | Admin | Setujui banyak permohonan sekaligus |
| PATCH | `/loans/:id/note` | Admin | Simpan catatan |

Filter `status` pada `GET /loans` menerima `overdue` dan `pickup_expired` — keduanya
diterjemahkan ke klausa SQL, bukan difilter di JavaScript setelah halaman diambil.
Itu penting agar pagination tetap benar: memfilter di memori akan menghasilkan
halaman berisi 3 baris padahal `total` bilang 50.

### 6.3 `POST /loans` — Prosedur

Semua pemeriksaan berikut berjalan dalam **satu transaksi**:

```
BEGIN
  SELECT user FOR UPDATE        → akun harus ada & active & role = 'user'
  cek denda belum lunas         → bila fine_block_borrow = 1, tolak UNPAID_FINES
  cek duplikat                  → tidak boleh sudah ada loan aktif untuk buku ini
  SELECT book FOR UPDATE        → buku harus active, available_copies > 0
  hitung kuota                  → jumlah loan (approved|borrowed|return_requested)
                                  harus < max_loan_per_user
  bila require_approval = 1  → INSERT status 'pending'  (stok tidak berubah)
  bila require_approval = 0  → INSERT status 'borrowed'
                                + UPDATE books SET available = available - 1
COMMIT
```

`POST /loans/counter` memakai jalur yang sama tetapi melewati tahap permohonan:
petugas memilih anggota, memilih buku, lalu buku langsung berstatus `borrowed`.
`days` boleh ditimpa petugas; bila kosong dipakai `loan_duration_days`.

### 6.4 `POST /loans/:id/approve` — Prosedur

```
BEGIN
  SELECT loan FOR UPDATE        → cek canTransition(pending → approved)
  SELECT user FOR UPDATE        → masih active?
  cek kuota lagi               → masih di bawah batas?
  SELECT book FOR UPDATE        → available_copies >= quantity?
  UPDATE books  SET available_copies = available_copies - quantity
  UPDATE loans  SET status='approved', approved_at=NOW(),
                  approved_by=:admin, due_at = NOW() + :loan_duration_days DAY,
                  pickup_deadline = NOW() + :pickup_window_days DAY
COMMIT
```

Mengapa stok dikurangi **di sini**? Karena ini titik di mana perpustakaan
"berjanji" menyediakan eksemplar. Dengan mengunci baris buku (`FOR UPDATE`),
dua approval yang datang bersamaan akan saling menunggu, dan yang kedua
melihat `available_copies = 0` lalu ditolak. Ini yang diuji pada skenario [10].

`pickup_deadline` dihitung **sekali** saat approval dan disimpan. Kalau nilainya
dihitung ulang dari `settings` setiap kali dibaca, mengubah `pickup_window_days`
besok akan menghidupkan kembali transaksi yang sudah kedaluwarsa kemarin.

`due_at` dan `pickup_deadline` sama-sama digeser melewati hari libur dan hari
Minggu (lihat §12b). Karena `approve` berjalan di dalam transaksi, `resolveDueDays`
dijalankan memakai koneksi transaksi yang sama — bukan pool terpisah — supaya
pembacaan kalender melihat data yang konsisten dengan kunci yang sedang dipegang.

### 6.4b `POST /loans/bulk-approve` — Persetujuan massal

```json
{ "loanIds": [12, 13, 14], "note": "Disetujui saat jam istirahat" }
```

Setiap pinjaman disetujui dalam **transaksinya sendiri**, berurutan. Ini disengaja:
dua approval yang menyentuh buku yang sama tidak boleh berlomba memperebutkan
eksemplar terakhir. Karena itu hasilnya bersifat *partial success*:

```json
{
  "data": {
    "approved": [ … ],
    "failed": [{ "id": 14, "reason": "Stok habis…" }]
  }
}
```

Respons memakai **207 Multi-Status** bila ada yang gagal, dan **200** bila semuanya
berhasil. UI menampilkan ringkasan ("12 disetujui, 1 gagal") alih-alih membuang
pekerjaan yang sudah berhasil. Batas 50 permohonan sekali proses, agar satu
kesalahan klik tidak menyetujui seluruh antrean sekolah.

### 6.5 `POST /loans/:id/return-confirm` — Prosedur

```
BEGIN
  SELECT loan FOR UPDATE        → cek canTransition(borrowed|return_requested → returned)
  hitung daysLate               → dari due_at
  INSERT IGNORE fine 'late'     → daysLate × late_fee_per_day (bila > 0)
  bila condition = 'damaged'  → UPDATE books SET damaged_copies = damaged_copies + qty
                                 INSERT IGNORE fine 'damaged' (damaged_fee)
  bila condition = 'lost'     → UPDATE books SET total_copies = total_copies - qty
                                 INSERT IGNORE fine 'lost' (lost_fee)
  bila condition = 'good'     → UPDATE books SET available_copies = LEAST(available + qty, total)
  UPDATE loans SET status='returned', returned_at=NOW(), returned_by=:admin,
                  return_condition=:c, return_note=:n
  promosikan antrean terdepan → status 'ready' + notifikasi
COMMIT
```

`LEAST(..., total_copies)` adalah pengaman tambahan: meski request terduplikasi,
stok tidak mungkin melebihi jumlah fisiknya.

Perhatikan bahwa **rusak dan hilang tidak menambah `available_copies`**. Buku yang
dikembalikan rusak tetap dihitung sebagai inventaris (`total_copies`) tetapi pindah
ke `damaged_copies`, sedangkan buku hilang mengurangi `total_copies` karena memang
lenyap. Menambah `available_copies` untuk kedua kondisi itu akan membuat sistem
menjanjikan buku yang tidak bisa dipinjam.

### 6.6 `POST /loans/:id/renew` — Prosedur

```
SELECT loan FOR UPDATE
tolak bila status != 'borrowed'
tolak bila overdue                        → LOAN_OVERDUE
tolak bila renew_count >= max_renewals    → RENEWAL_LIMIT
tolak bila max_renewals = 0               → RENEWAL_DISABLED
UPDATE loans SET due_at = DATE_ADD(COALESCE(due_at, NOW()), INTERVAL :days DAY),
                renew_count = renew_count + 1
```

`COALESCE(due_at, NOW())` membuat perpanjangan tetap masuk akal pada data lama yang
belum punya `due_at`: patokannya waktu sekarang, bukan NULL.

### 6.7 `POST /loans/:id/release` — Prosedur

Melepas peminjaman `approved` yang lewat `pickup_deadline`: status menjadi
`cancelled` dan stok dikembalikan. Dipakai petugas untuk membersihkan rak dari buku
yang disisihkan tetapi tidak pernah diambil. Pelepasan juga mempromosikan antrean
berikutnya bila ada yang menunggu judul tersebut.

### 6.8 Perhitungan Keterlambatan

`daysLate` = selisih hari antara `due_at` dan (`returned_at` bila sudah kembali,
atau waktu sekarang bila masih dipinjam). Denda = `daysLate × late_fee_per_day`
**pada saat pengembalian**, lalu disimpan di tabel `fines`.

Tanggal dibaca dari database sebagai string `YYYY-MM-DD HH:mm:ss` **waktu lokal**
(konfigurasi `dateStrings: true`), sehingga tidak terjadi pergeseran satu hari.
Karena itu setiap perhitungan waktu yang melibatkan "sekarang" diserahkan ke SQL
(`NOW()`, `DATE_ADD`), bukan ke `new Date()` di Node — jam penulis dan jam pemeriksa
harus satu sumber.

### 6.9 Isolasi Data

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
| GET | `/dashboard/admin/reports` | Admin | Laporan analitis tambahan |
| GET | `/dashboard/member/overview` | Login | Ringkasan pribadi |

### 7.1 `GET /dashboard/admin/overview`

Semua angka berasal dari agregat SQL nyata:

| Angka | Sumber |
|---|---|
| `totalTitles` | `COUNT(*)` buku aktif |
| `totalCopies` | `SUM(total_copies)` buku aktif |
| `availableCopies` | `SUM(available_copies)` buku aktif |
| `borrowedCopies` | `SUM(total_copies − available_copies − damaged_copies)` |
| `damagedCopies` | `SUM(damaged_copies)` buku aktif |
| `activeMembers` | `SUM(role='user' AND status='active')` |
| `pendingApprovals` | `SUM(status='pending')` |
| `overdueLoans` | `SUM(status IN ('borrowed','return_requested') AND due_at < NOW())` |
| `pickupExpired` | `SUM(status='approved' AND pickup_deadline < NOW())` |
| `returnRequests` | `SUM(status='return_requested')` |
| `returnedThisMonth` | Pengembalian sejak awal bulan berjalan |
| `unpaidFinesTotal` | `SUM(amount)` denda berstatus `unpaid` |
| `unpaidFinesCount` | `COUNT(*)` denda berstatus `unpaid` |
| `queueWaiting` | `COUNT(*)` reservasi berstatus `waiting` |

`borrowedCopies` sengaja mengurangkan `damagedCopies`: eksemplar rusak ada di rak,
bukan sedang dipinjam.

### 7.2 `GET /dashboard/admin/charts`

Query: `from`, `to` (`YYYY-MM-DD`), `bucket` = `day` | `week` | `month`.

Mengembalikan `trend`, `categories`, `statuses`, `topBooks`, `topMembers`.
Filter tanggal benar-benar masuk ke klausa `WHERE ... BETWEEN`, sehingga
rentang kosong menghasilkan `trend: []` dan grafik menampilkan empty state.

### 7.3 `GET /dashboard/admin/reports`

Query: `from`, `to` (opsional). Mengembalikan tiga laporan yang tidak masuk grafik:

| Field | Isi |
|---|---|
| `neverBorrowed` | Buku aktif yang belum pernah muncul di `loans` |
| `lateMembers` | Anggota dengan transaksi terlambat aktif + total denda belum lunas |
| `fines` | `totals` (charged/collected/outstanding/waived) + `byKind` |

`neverBorrowed` dipakai untuk promosi koleksi atau penyiangan; `lateMembers` untuk
pembinaan; `fines` untuk rekonsiliasi kas. Ketiganya dihitung dari data nyata,
bukan estimasi.

---

## 8. Modul Denda — `/api/fines`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/fines/mine` | Login | Denda milik sendiri |
| GET | `/fines` | Admin | Seluruh buku kas denda |
| POST | `/fines/:id/settle` | Admin | Lunasi atau bebaskan |

Denda **dibuat otomatis** oleh `POST /loans/:id/return-confirm`:

| Kondisi | `kind` | `amount` |
|---|---|---|
| Terlambat | `late` | `daysLate × late_fee_per_day` |
| Rusak | `damaged` | `damaged_fee` |
| Hilang | `lost` | `lost_fee` |

Nilai disimpan sebagai *snapshot*. `UNIQUE (loan_id, kind)` membuat penulisan
memakai `INSERT IGNORE`, sehingga klik ganda tidak menggandakan tagihan.

**Query `GET /fines` dan `/fines/mine`:**

| Parameter | Nilai | Keterangan |
|---|---|---|
| `status` | `all` \| `unpaid` \| `paid` \| `waived` | Default `all` |
| `kind` | `all` \| `late` \| `damaged` \| `lost` | Default `all` |
| `userId` | int | Hanya berlaku untuk admin |
| `search` | string | Nama anggota / judul buku |
| `page`, `pageSize` | int | Default 20, maksimal 100 |

Respons menyertakan objek `summary` di **level atas** (di samping `data` dan `meta`),
berisi total ditagih, diterima, belum lunas, dan dibebaskan — sehingga halaman tidak
perlu menghitung ulang di browser.

```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 },
  "summary": { "unpaidCount": 2, "unpaidTotal": 8000, "paidTotal": 4000, "waivedTotal": 0 }
}
```

**Body `settle`:**
```json
{ "action": "pay", "note": "Dibayar tunai di loket" }
```
`action` = `pay` | `waive`. Keduanya mengisi `settled_at` dan `settled_by`;
`waive` menandai `status='waived'` sehingga tidak dihitung sebagai kas masuk.

**Gerbang pinjaman:** bila `fine_block_borrow = 1` dan anggota masih punya denda
`unpaid`, `POST /loans` dan `POST /loans/counter` ditolak dengan
`UNPAID_FINES` beserta nominalnya.

---

## 9. Modul Reservasi — `/api/reservations`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/reservations/mine` | Login | Antrean milik sendiri |
| POST | `/reservations` | Login | Ikut mengantre |
| POST | `/reservations/:id/cancel` | Login | Batalkan antrean |
| GET | `/reservations` | Admin | Seluruh antrean |
| GET | `/reservations/queue/overview` | Admin | Ringkasan per judul |

**Aturan:**
- Anggota boleh mengantre kapan saja — termasuk saat masih ada stok, karena antrean
  juga dipakai sebagai rencana baca. Antrean baru bermakna ketika stok habis.
- Satu anggota hanya boleh punya satu antrean aktif per judul.
- Jumlah antrean aktif per anggota dibatasi `max_reservations_per_user` (default 3),
  agar satu siswa tidak mengantre seluruh katalog.
- Tidak boleh mengantre buku yang sedang dia pinjam atau ajukan.
- `queuePosition` **dihitung** dari urutan `created_at` lewat subquery berkorelasi di
  `RES_SELECT`, tidak disimpan. Membatalkan antrean di tengah otomatis menggeser
  posisi orang di belakangnya tanpa UPDATE massal, dan tidak menimbulkan N+1.
- `GET /reservations` mengembalikan `{ items, meta }` (berpaginasi); `GET
  /reservations/mine` mengembalikan array biasa karena antrean pribadi tidak
  pernah panjang.
- Saat buku dikembalikan, antrean terdepan dipromosikan ke `ready` dengan
  `expires_at = NOW() + reservation_hold_days`, dan anggota menerima notifikasi.
- Antrean `ready` yang tidak diambil sampai `expires_at` dianggap `expired` dan
  kesempatan berpindah ke antrean berikutnya.

---

## 9b. Modul Pindai — `/api/scan` (Admin)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/scan?code=…` | Mengenali satu kode hasil pindai |

Satu endpoint untuk tiga jenis kode, karena petugas tidak memilih mode sebelum
memindai — mereka cukup mengarahkan alat ke apa pun yang ada di meja.

| Bentuk kode | Dikenali sebagai | Contoh |
|---|---|---|
| diawali `MBR-` | Kartu anggota | `MBR-2026-003` |
| diawali `LN-` | Nota/transaksi | `LN-20261021-4806EE` |
| 10 atau 13 digit | ISBN buku | `978-602-03-0006-6` |
| selain itu | Dicoba berturut-turut: buku → transaksi → anggota | `6020300066` |

Respons memuat `kind` (`member` / `book` / `loan`) beserta ringkasan yang cukup
untuk ditampilkan. Bila tidak ada yang cocok → `404 NOT_FOUND` dengan pesan
"Kode tidak dikenali sebagai kartu anggota, ISBN buku, atau nota transaksi."

**Mengapa satu endpoint, bukan tiga?** Pemindai barcode bekerja seperti papan
ketik: ia mengetik kode lalu menekan Enter. Memaksa petugas memilih "mode
anggota" atau "mode buku" lebih dulu berarti satu klik tambahan pada setiap
peminjaman, dan itulah yang membuat staf berhenti memakai pemindai.

Kode tidak pernah disisipkan ke SQL — semuanya lewat placeholder. Panjangnya
dibatasi 64 karakter agar kerusakan alat atau tempelan dokumen tidak menjadi
pola pencarian raksasa.

> Endpoint ini khusus admin: anggota yang memindai kartu orang lain tidak boleh
> melihat nama dan kelas pemiliknya.

---

## 10. Modul Notifikasi — `/api/notifications`

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/notifications` | Daftar notifikasi (paginated) |
| GET | `/notifications/unread-count` | Jumlah belum dibaca |
| POST | `/notifications/read-all` | Tandai semua dibaca |
| POST | `/notifications/:id/read` | Tandai satu dibaca |
| DELETE | `/notifications/:id` | Hapus notifikasi |

Semua endpoint hanya menyentuh notifikasi milik pengguna yang login.

**Pengingat jatuh tempo dibuat saat dibaca**, bukan oleh cron. Saat daftar diminta,
server memeriksa pinjaman dengan `DATEDIFF(due_at, NOW()) <= 2` lalu menulis baris
notifikasi dengan `dedupe_key = "due-<loanId>-<tanggal>"`. Kunci unik
`(user_id, dedupe_key)` membuat operasi ini idempoten: membuka aplikasi sepuluh kali
tetap menghasilkan satu pengingat.

Pendekatan ini dipilih karena server sekolah tidak punya cron yang bisa diandalkan;
pengingat yang muncul saat anggota benar-benar membuka aplikasi justru lebih berguna
daripada job yang gagal diam-diam.

---

## 11. Modul Cadangan — `/api/backup` (Admin)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/backup/database` | Unduh dump `.sql` lengkap |
| POST | `/backup/restore` | Pulihkan database dari berkas `.sql` |

Menjalankan `mysqldump` di server lalu mengalirkan hasilnya sebagai unduhan.

Urutan pencarian biner: `MYSQLDUMP_PATH` → `_vendor/mariadb-11.4.7-winx64/bin/`
→ `PATH` sistem. Urutan ini penting: versi sebelumnya hanya menunjuk berkas
`_vendor` yang spesifik platform, sehingga di container Linux (tanpa `_vendor`)
tombol cadangan gagal `ENOENT` meski `mysqldump` terpasang normal.

Kata sandi dikirim lewat variabel lingkungan `MYSQL_PWD`, bukan argumen
`--password=...`. Argumen proses dapat dibaca pengguna lain di mesin yang sama
lewat `ps` atau Task Manager selama dump berjalan.

Dibatasi admin karena dump berisi seluruh data pribadi anggota.

### Pemulihan (restore)

Endpoint paling merusak di sistem ini, jadi dijaga tiga lapis:

1. **Konfirmasi literal** — kolom `confirmation` harus berisi tepat `PULIHKAN`.
   Salah ketik atau klik tidak sengaja tidak dapat memulai pemulihan.
2. **`inspectDump`** — berkas harus memuat `CREATE TABLE` untuk `users`, `books`,
   `loans`, dan `settings`. Berkas kosong, dump proyek lain, atau teks biasa yang
   diganti nama menjadi `.sql` ditolak **sebelum satu tabel pun disentuh**.
3. **Log ditulis lebih dulu** — entri `data.restore` dicatat *sebelum* pemulihan
   berjalan. Setelah restore, tabel `activity_logs` sudah digantikan isi dump,
   sehingga catatan setelahnya akan hilang; padahal "siapa memulihkan apa, kapan"
   justru informasi yang paling dibutuhkan setelah insiden.

Berkas di-pipe ke klien `mysql` (bukan di-parse Node), karena dump berisi blok
`DELIMITER` dan prosedur yang akan rusak bila dipecah dengan splitter sederhana.
Klien yang sama yang menghasilkan berkas adalah satu-satunya parser yang pasti
membacanya kembali dengan benar. Batas unggah 64 MB.

Biner klien dicari dengan urutan sama seperti dumper: `MYSQLCLIENT_PATH` →
`_vendor` → `PATH`.

---

## 12. Modul Excel — `/api/excel` (Admin)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/excel/template` | Unduh template impor buku |
| GET | `/excel/template/members` | Unduh template impor anggota |
| GET | `/excel/export/books` | Ekspor buku (mengikuti filter) |
| GET | `/excel/export/members` | Ekspor anggota |
| GET | `/excel/export/loans` | Ekspor transaksi/laporan |
| GET | `/excel/export/fines` | Ekspor buku kas denda (mengikuti filter periode) |
| POST | `/excel/import/books?mode=validate` | Validasi tanpa menyimpan |
| POST | `/excel/import/books?mode=commit` | Simpan baris yang valid |
| POST | `/excel/import/members?mode=validate` | Validasi impor anggota |
| POST | `/excel/import/members?mode=commit` | Simpan anggota yang valid |

**Kolom template buku:** ISBN, Judul, Penulis, Penerbit, Tahun Terbit, Kategori,
Lokasi Rak, Jumlah Eksemplar, Deskripsi.

**Kolom template anggota:** Nama Lengkap, Username, Email, Kelas, Telepon, Alamat.

**Proteksi formula injection:** nilai teks yang diawali `=`, `+`, `-`, `@`, tab,
atau CR diberi awalan `'` agar tidak dievaluasi saat file dibuka.

**Validasi baris:** setiap baris divalidasi dengan skema Zod yang sama seperti
formulir. duplikasi ISBN di dalam file maupun terhadap database ditandai.
Respons `mode=validate` berisi `errors[]` berisi `{ row, field, message }`.

`mode=commit` berjalan dalam satu transaksi — jika satu baris gagal di level SQL,
seluruh impor dibatalkan.

Batas ekspor: **5000 baris** untuk mencegah server kehabisan memori.

### Impor anggota: satu kata sandi untuk satu batch

Hash bcrypt memakan sekitar 80 ms. Menghitung satu kata sandi per baris berarti
berkas 500 siswa memblokir request selama ±40 detik — cukup lama untuk membuat
proksi atau browser menyerah. Karena itu:

- **Satu kata sandi batch** dibuat untuk seluruh berkas dan di-hash **sekali**.
  Kata sandi dikembalikan tepat satu kali di badan respons, tidak pernah disimpan
  dalam bentuk polos dan tidak pernah ditulis ke log. Bila terlanjur hilang,
  jalannya adalah tombol atur ulang per anggota.
- Setiap akun hasil impor diberi `must_change_password = 1`. Bendera ini membuat
  klien menampilkan gerbang ganti kata sandi yang tidak dapat ditutup sampai
  anggota memilih kata sandi sendiri. Kata sandi bersama hanya dapat diterima
  bila ia tidak bisa dipakai selamanya.
- Kode anggota dibuat berurutan dalam **satu transaksi** dengan mengunci ruang
  kode (`FOR UPDATE`) lebih dulu. `generateMemberCode()` menghitung baris yang ada
  — pola itu akan memberi kode yang sama ke setiap baris batch.
- Semua-atau-tidak-sama-sekali: daftar kelas yang setengah terimpor lebih buruk
  daripada impor yang gagal.

Baris yang username/email-nya sudah terpakai dilaporkan per baris, bukan
membatalkan seluruh berkas — daftar kelas biasanya memuat satu-dua siswa yang
sudah mendaftar sendiri.

---

## 12b. Modul Hari Libur — `/api/holidays`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/holidays?year=2026` | Login | Kalender hari libur |
| POST | `/holidays` | Admin | Tambah tanggal libur |
| DELETE | `/holidays/:id` | Admin | Hapus tanggal libur |

Kalender ini dipakai saat menghitung `due_at`. Bila tanggal jatuh tempo mengenai
hari libur **atau hari Minggu**, tenggat digeser ke hari kerja berikutnya. Tanpa
tabel ini, buku yang jatuh tempo saat libur sekolah dihitung terlambat padahal
siswa tidak punya kesempatan mengembalikannya.

Membaca kalender terbuka untuk kedua peran (anggota perlu tahu mengapa tenggatnya
bergeser); hanya petugas yang boleh mengubahnya. Tanggal kembar ditolak `409` oleh
indeks UNIQUE — pengecekan di aplikasi tetap akan kalah balapan.

**Perhitungan di SQL, bukan di Node.** `resolveDueDays()` menjalankan recursive CTE
yang membangkitkan tanggal kandidat dan mengambil yang pertama bukan libur dan
bukan hari Minggu (`DAYOFWEEK <> 1`). Aritmetika yang sama di Node berarti
menurunkan ulang "hari ini" dari jam aplikasi — kelas bug yang dulu membuat token
reset kedaluwarsa seketika. Hasilnya tetap dipakai lewat
`DATE_ADD(NOW(), INTERVAL ? DAY)`, jadi tanggalnya tetap lahir dari jam database.

Batas geser 30 hari; bila seluruh jendela tertutup, tanggal asli dipakai agar
petugas melihat tanggal sebenarnya alih-alih tanggal diam-diam selama libur.

> **Batasan yang didokumentasikan:** Sabtu **tidak** digeser, mengikuti jam
> operasional sekolah. Bila perpustakaan tutup Sabtu, tambahkan Sabtu sebagai
> hari libur berulang setiap minggu di kalender.

`pickup_deadline` memakai aturan geser yang sama.

---

## 12c. Modul Kunjungan — `/api/visits` (Admin)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/visits?from=&to=&userId=` | Daftar kunjungan (paginated) |
| GET | `/visits/summary` | Ringkasan hari ini, bulan ini, per tujuan |
| POST | `/visits` | Catat kunjungan anggota atau tamu |

Seluruh modul khusus petugas: catatan kunjungan mengungkap siapa berada di
perpustakaan dan kapan. Anggota tidak pernah perlu membacanya.

`visit_date` diisi oleh SQL (`CURDATE()`), bukan Node. Jam aplikasi dan jam
database tidak dijamin sama, dan kunjungan pukul 00:30 harus masuk ke hari ketika
perpustakaan benar-benar buka.

`UNIQUE (user_id, visit_date)` membuat satu siswa terhitung sekali per hari walau
kartunya dipindai berkali-kali. Pindai ulang **bukan error**: server membalas `200`
dengan pesan "sudah tercatat berkunjung hari ini" dan mengembalikan baris yang
sudah ada. Log aktivitas hanya ditulis untuk kunjungan yang benar-benar baru —
kalau tidak, setiap pindai ulang akan memenuhi jejak audit dengan kebisingan.

Tamu tanpa akun memakai `guest_name` dengan `user_id = NULL`. Indeks unik tidak
berlaku untuk tamu, dan itu disengaja: dua tamu berbeda boleh punya nama sama.

---

## 12d. Modul Stok Opname — `/api/opnames` (Admin)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/opnames?status=&bookId=` | Daftar sesi opname |
| POST | `/opnames` | Buka sesi hitung fisik |
| POST | `/opnames/:id/apply` | Terapkan selisih ke stok |

Menghitung ulang stok mengubah angka inventaris sungguhan, jadi seluruh modul
khusus petugas.

`expected` adalah **snapshot** saat sesi dibuka (`available + damaged`), bukan
angka yang dihitung ulang saat diterapkan. Bila dihitung ulang, peminjaman yang
terjadi antara penghitungan dan persetujuan akan diam-diam mengubah "apa kata rak
tadi" — padahal justru itulah yang ingin diawetkan oleh sebuah audit.

Eksemplar yang sedang dipinjam sengaja **tidak** masuk `expected`: petugas hanya
bisa menghitung yang benar-benar ada di gedung.

Saat `apply`, penyesuaian dinyatakan dalam jumlah yang hadir secara fisik:

```
present   = available + damaged
borrowed  = total - present
new total = counted + borrowed
new avail = counted - damaged   (dibatasi agar tidak negatif)
```

Buku yang sedang dipinjam dibiarkan apa adanya. Menandai buku pinjaman sebagai
"hilang" karena tidak ada di rak adalah tuduhan palsu sekaligus merusak invarian
`available + damaged + borrowed = total`. Sesi yang sudah diterapkan tidak dapat
diterapkan ulang (`422 OPNAME_ALREADY_APPLIED`).

---

## 12e. Modul Ulasan — `/api/reviews`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/reviews?bookId=&rating=&sort=` | Login | Daftar ulasan |
| GET | `/reviews/book/:bookId/stats` | Login | Rata-rata + sebaran bintang |
| GET | `/reviews/book/:bookId/mine` | Login | Ulasan milik sendiri |
| POST | `/reviews/book/:bookId` | Login | Tulis/perbarui ulasan |
| DELETE | `/reviews/:id` | Login | Hapus (sendiri, atau admin) |

Satu anggota, satu pendapat: `UNIQUE (book_id, user_id)` membuat kiriman kedua
**memperbarui** baris pertama (`ON DUPLICATE KEY UPDATE`), bukan menumpuk duplikat.
Karena itu tombolnya berbunyi "Perbarui ulasan" setelah ulasan pertama ada.

Syarat "harus pernah meminjam" dikendalikan pengaturan `review_requires_loan`.
Sebuah sekolah mungkin hanya ingin ulasan dari pembaca yang benar-benar
menyelesaikan buku, atau mungkin ingin siapa pun boleh menilai katalog. Aturan
tinggal di server; UI hanya menyembunyikan formulir bila riwayat pinjam jelas
kosong, dan pesan server ditampilkan bila keduanya berbeda pendapat.

Rata-rata dan sebaran bintang dihitung di SQL agar selalu cocok dengan daftarnya.

---

## 12f. Modul Daftar Keinginan — `/api/wishlist`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/wishlist` | Login | Daftar keinginan sendiri |
| GET | `/wishlist/check?bookIds=1,2,3` | Login | Buku mana yang sudah ditandai |
| GET | `/wishlist/demand` | Admin | Judul paling banyak diinginkan |
| POST | `/wishlist` | Login | Simpan buku |
| DELETE | `/wishlist/:bookId` | Login | Hapus buku |

**Berbeda dari reservasi:** daftar keinginan **tidak memesan stok**. Ini penanda
baca, dan halaman serta deskripsinya mengatakan hal itu terus terang — anggota
yang mengira mendapat jatah akan kecewa saat bukunya hilang dari rak.

`UNIQUE (user_id, book_id)` + `ON DUPLICATE KEY UPDATE` membuat tombol hati
idempoten: klik dua kali bukan error dan tidak membuat baris kedua. Itu penting
karena UI-nya men-toggle saat diklik.

`GET /wishlist/check` adalah lookup batch supaya halaman katalog dapat menandai
hati tanpa N request.

Laporan `demand` adalah alasan daftar ini layak disimpan sama sekali: judul yang
paling sering diinginkan tetapi persediaannya kurang menjadi daftar belanja
pengadaan.

---

## 12g. Modul Pengumuman — `/api/announcements`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/announcements?audience=&activeOnly=` | Login | Daftar pengumuman |
| GET | `/announcements/:id` | Login | Detail |
| POST | `/announcements` | Admin | Terbitkan |
| PATCH | `/announcements/:id` | Admin | Perbarui |
| DELETE | `/announcements/:id` | Admin | Hapus |

Kedua peran membaca; hanya petugas yang menerbitkan. Penyaringan audiens
dikerjakan **di SQL**, bukan di UI: anggota tidak pernah dapat melihat catatan
internal, bahkan lewat request yang disusun tangan. Membaca pengumuman khusus
petugas lewat id juga menghasilkan `404`, bukan `403` — membalas `403` akan
membocorkan bahwa id itu ada.

`expired` **diturunkan** dari `NOW()` (`expires_at IS NOT NULL AND expires_at <=
NOW()`), tidak pernah disimpan — aturan yang sama seperti `overdue`. Pengumuman
tersemat (`pinned`) tampil paling atas, lalu yang terbaru.

Di beranda anggota, bagian ini menghapus dirinya seluruhnya bila tidak ada isi.
Kotak "Pengumuman" yang kosong setiap hari melatih orang mengabaikan tempat
pemberitahuan penting akan muncul.

---

## 12h. Modul Level — `/api/levels`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/levels` | Login | Tangga level (ambang + nama) |
| GET | `/levels/me` | Login | Level + kemajuan diri sendiri |
| GET | `/levels/leaderboard` | Login | Papan peringkat pembaca |

### Konsep

Level adalah **nilai turunan**, bukan kolom. Basisnya satu angka yang dihitung
SQL:

```sql
SELECT COUNT(*) FROM loans
 WHERE user_id = ? AND borrowed_at IS NOT NULL
```

`borrowed_at IS NOT NULL` dipilih, bukan `status = 'returned'`:

- Pengajuan `pending`, `approved`, `rejected`, dan `cancelled` tidak pernah
  mengisi `borrowed_at`, jadi tidak menaikkan level.
- `borrowed_at` tetap terisi walau status berubah menjadi `returned`,
  `return_requested`, atau kondisi `damaged`/`lost`.

Kurva ada di `backend/src/modules/levels/levels.ts` dan diekspos lewat
`GET /levels`, sehingga frontend tidak pernah menduplikasi ambang:

| Level | Nama | Peminjaman |
|---|---|---|
| 1 | Pemula | 0 |
| 2 | Pembaca | 5 |
| 3 | Kutu Buku | 15 |
| 4 | Pustakawan Muda | 30 |
| 5 | Legenda Literasi | 60 |

### `GET /levels/me`

```json
{
  "level": 3,
  "name": "Kutu Buku",
  "tone": "cyan",
  "blurb": "Peminjam aktif. Petugas sudah hafal judul yang kamu cari.",
  "totalBorrowed": 17,
  "currentMin": 15,
  "nextMin": 30,
  "nextName": "Pustakawan Muda",
  "remaining": 13,
  "progress": 13,
  "rank": 2
}
```

`progress` dihitung di dalam level saat ini (`(total - currentMin) / (nextMin -
currentMin) × 100`) dan bernilai `100` pada level tertinggi. `rank` bernilai
`null` bila anggota belum pernah meminjam.

### `GET /levels/leaderboard?limit=10`

Anggota tanpa peminjaman **tidak** ditampilkan: papan berisi orang yang tidak
pernah meminjam tidak memberi informasi apa pun, dan akan menempatkan setiap
akun baru di peringkat 1. `limit` dibatasi 1-50.

Urutan dihitung di SQL (`totalBorrowed DESC, full_name ASC, id ASC`) sehingga
seri tetap stabil. Posisi seorang anggota (`getMemberRank`) memakai
`ROW_NUMBER() OVER (...)` dengan urutan yang sama, jadi angkanya tidak mungkin
berbeda dari daftar yang dilihat pengguna.

### Dampak ke modul lain

| Tempat | Perubahan |
|---|---|
| `GET /members` | Setiap baris membawa `borrowedCount` dan objek `level` |
| `GET /dashboard/admin/charts` | `topMembers[].level` + `avatarPath` |
| `POST /scan` | Target `member` membawa `avatarPath` dan `level` |
| `GET /excel/members` | Kolom tambahan **Level** |

---

## 13. Modul Aktivitas — `/api/activity` (Admin)

`GET /activity` dengan `search`, `action`, `page`, `pageSize`.

Menampilkan jejak audit: aktor, aksi, deskripsi, waktu, IP, dan metadata JSON.
Log ditulis dengan `try/catch` sehingga kegagalan pencatatan tidak pernah
membatalkan operasi bisnis yang sudah berhasil.

Aksi baru yang tercatat: `loan.counter`, `loan.renew`, `loan.release`,
`fine.settle`, `reservation.create`, `reservation.cancel`, `password.reset_request`,
`profile.avatar`.

---

## 14. Modul Pengaturan — `/api/settings`

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/settings` | Login | Baca aturan |
| PUT | `/settings` | Admin | Ubah aturan |

Lima belas kunci diterima, semuanya opsional (`.partial()`), dengan batas server-side:

| Kunci | Batas |
|---|---|
| `max_loan_per_user` | 1-20 |
| `loan_duration_days` | 1-90 |
| `require_approval` | boolean / `'0'` / `'1'` |
| `allow_self_return` | boolean / `'0'` / `'1'` |
| `late_fee_per_day` | 0-100.000 |
| `max_renewals` | 0-5 |
| `pickup_window_days` | 1-30 |
| `fine_block_borrow` | boolean / `'0'` / `'1'` |
| `damaged_fee` | 0-1.000.000 |
| `lost_fee` | 0-1.000.000 |
| `reservation_hold_days` | 1-30 |
| `due_date_skip_holidays` | boolean / `'0'` / `'1'` |
| `max_reservations_per_user` | 1-20 |
| `review_requires_loan` | boolean / `'0'` / `'1'` |
| `visit_tracking_enabled` | boolean / `'0'` / `'1'` |

Boolean dikirim sebagai boolean dan disimpan sebagai string `'1'` / `'0'`.
Mengubah pengaturan **tidak** menulis ulang data historis: denda dan
`pickup_deadline` yang sudah tercatat tetap seperti saat dibuat.

---

## 15. Daftar Fungsi Backend (ringkasan)

| Fungsi | Berkas | Peran |
|---|---|---|
| `getPool`, `query`, `queryOne`, `execute` | `config/db.ts` | Akses SQL terpusat |
| `withTransaction` | `config/db.ts` | Transaksi + rollback otomatis |
| `assertDatabaseConnection` | `config/db.ts` | Cek koneksi saat boot |
| `verifyCredentials` | `modules/auth/auth.service.ts` | Login |
| `registerMember` / `generateMemberCode` | `modules/auth/auth.service.ts` | Registrasi |
| `issueResetToken` / `resetPasswordWithToken` | `modules/auth/password-reset.service.ts` | Reset kata sandi mandiri |
| `listBooks` / `createBook` / `updateBook` | `modules/books/books.service.ts` | CRUD buku |
| `deleteBook` | `modules/books/books.service.ts` | Soft/hard delete |
| `bulkCreateBooks` | `modules/books/books.service.ts` | Impor massal (transaksi) |
| `listMembers` / `createMember` | `modules/members/members.service.ts` | CRUD anggota |
| `requestLoan` | `modules/loans/loans.service.ts` | Pengajuan peminjaman |
| `counterLoan` | `modules/loans/loans.service.ts` | Peminjaman langsung di loket |
| `approveLoan` | `modules/loans/loans.service.ts` | Approval + reservasi stok |
| `confirmBorrow` / `rejectLoan` / `cancelLoan` | `modules/loans/loans.service.ts` | Transisi status |
| `renewLoan` | `modules/loans/loans.service.ts` | Perpanjangan + cek batas |
| `releaseExpiredPickup` | `modules/loans/loans.service.ts` | Lepas jatah yang tidak diambil |
| `requestReturn` / `confirmReturn` | `modules/loans/loans.service.ts` | Pengembalian + denda + promosi antrean |
| `bulkApproveLoans` | `modules/loans/loans.service.ts` | Setujui banyak permohonan (partial success) |
| `resolveDueDays` | `modules/holidays/holidays.service.ts` | Geser jatuh tempo melewati libur/Minggu (SQL) |
| `listHolidays` / `createHoliday` / `deleteHoliday` | `modules/holidays/holidays.service.ts` | Kalender libur |
| `listVisits` / `recordVisit` / `visitSummary` | `modules/visits/visits.service.ts` | Kunjungan harian |
| `createOpname` / `applyOpname` | `modules/opname/opname.service.ts` | Stok opname |
| `upsertReview` / `reviewStats` | `modules/reviews/reviews.service.ts` | Ulasan & rating |
| `addToWishlist` / `wishlistDemand` | `modules/wishlist/wishlist.service.ts` | Daftar keinginan |
| `listAnnouncements` / `createAnnouncement` | `modules/announcements/announcements.service.ts` | Pengumuman |
| `getLoanDetail` | `modules/loans/loans.service.ts` | Detail satu transaksi |
| `canTransition` | `modules/loans/loans.types.ts` | Penjaga state machine |
| `listFines` / `getFineSummary` / `settleFine` | `modules/fines/fines.service.ts` | Buku kas denda |
| `createFine` | `modules/fines/fines.service.ts` | Snapshot denda (idempoten) |
| `listReservations` / `createReservation` / `cancelReservation` | `modules/reservations/reservations.service.ts` | Antrean |
| `promoteNextInQueue` | `modules/reservations/reservations.service.ts` | Promosi otomatis ke `ready` |
| `notify` / `listNotifications` / `markRead` | `modules/notifications/notifications.service.ts` | Notifikasi in-app |
| `generateReminders` | `modules/notifications/notifications.reminders.ts` | Pengingat jatuh tempo (idempoten) |
| `dumpDatabase` | `modules/backup/backup.service.ts` | Cadangan `mysqldump` |
| `inspectDump` / `restoreDatabase` | `modules/backup/backup.restore.ts` | Verifikasi + pemulihan dump |
| `bulkCreateMembers` / `findExistingIdentities` | `modules/members/members.service.ts` | Impor anggota satu transaksi |
| `generateBatchPassword` / `parseMembersWorkbook` | `modules/excel/excel.service.ts` | Impor anggota Excel |
| `resolveScan` | `modules/scan/scan.service.ts` | Mengenali kartu/ISBN/nota hasil pindai |
| `resolveLevel` / `LEVEL_TIERS` | `modules/levels/levels.ts` | Kurva level (fungsi murni, tanpa DB) |
| `countBorrowedLoans` / `getMemberLevel` | `modules/levels/levels.service.ts` | Level satu anggota dari riwayat |
| `getLeaderboard` / `getMemberRank` | `modules/levels/levels.service.ts` | Papan peringkat + posisi sendiri |
| `getAdminOverview` / `getTransactionTrend` | `modules/dashboard/dashboard.service.ts` | Statistik & grafik |
| `getNeverBorrowedBooks` / `getLateMembers` / `getFineReport` | `modules/dashboard/dashboard.service.ts` | Laporan analitis |
| `buildBooksWorkbook` / `parseBooksWorkbook` | `modules/excel/excel.service.ts` | Excel |
| `sanitiseCell` | `modules/excel/excel.service.ts` | Anti formula injection |
| `logActivity` | `modules/activity/activity.service.ts` | Audit trail |
| `requireAuth` / `requireRole` | `middleware/auth.ts` | Otorisasi |
| `validateBody` / `validateQuery` | `middleware/validate.ts` | Validasi Zod |
| `storeCover` | `lib/upload.ts` | Unggah sampul aman (magic byte) |
| `storeAvatar` / `avatarUpload` | `lib/upload.ts` | Unggah foto profil (PNG/JPG/WEBP/GIF) |
| `detectImageType` | `lib/upload.ts` | Deteksi format dari byte; GIF opt-in |
| `setAvatarPath` / `clearAvatarPath` | `modules/auth/auth.service.ts` | Ganti/hapus foto profil |

---

## 16. Daftar Fungsi Frontend (ringkasan)

| Fungsi | Berkas | Peran |
|---|---|---|
| `request` | `lib/api.ts` | Klien fetch + penanganan error |
| `downloadFile` | `lib/api.ts` | Unduh ekspor (cookie ikut) |
| `useAuth` | `features/auth/AuthContext.tsx` | Status sesi & role |
| `useBooks`, `useLoans`, `useMyLoans`, … | `hooks/useApi.ts` | Query React Query |
| `useFines`, `useMyReservations`, `useNotifications` | `hooks/useApi.ts` | Query denda, antrean, notifikasi |
| `useUnreadNotifications` | `hooks/useApi.ts` | Polling jumlah belum dibaca (60 dtk) |
| `useAdminReports` | `hooks/useApi.ts` | Laporan analitis |
| `useScanLookup` | `hooks/useApi.ts` | Resolusi kode hasil pindai |
| `useHolidays`, `useVisits`, `useOpnames` | `hooks/useApi.ts` | Kalender, kunjungan, opname |
| `useReviews`, `useReviewStats`, `useMyReview` | `hooks/useApi.ts` | Ulasan & rating |
| `useAnnouncements`, `useWishlist`, `useWishlistMarks` | `hooks/useApi.ts` | Pengumuman & daftar keinginan |
| `useMyLevel`, `useLevelTiers`, `useLeaderboard` | `hooks/useApi.ts` | Level, tangga level, papan peringkat |
| `Avatar` | `components/ui/avatar.tsx` | Foto profil + fallback inisial |
| `LevelBadge` / `LevelProgress` | `components/ui/level-badge.tsx` | Badge & bilah kemajuan level |
| `AvatarUploader` | `features/profile/AvatarUploader.tsx` | Unggah/hapus foto (drag & drop) |
| `MyLevelCard` | `features/profile/MyLevelCard.tsx` | Kartu level + tangga level |
| `LeaderboardCard` | `features/profile/LeaderboardCard.tsx` | Papan peringkat di beranda siswa |
| `StarRating` | `components/ui/star-rating.tsx` | Bintang setengah untuk rata-rata |
| `BookReviews` | `components/books/BookReviews.tsx` | Ulasan di halaman detail buku |
| `MemberImportDialog` | `pages/admin/MemberImportDialog.tsx` | Impor anggota dua langkah |
| `ForcePasswordChange` | `features/auth/ForcePasswordChange.tsx` | Gerbang wajib ganti sandi |
| `ThemeProvider` / `ThemeToggle` | `providers/ThemeProvider.tsx` | Mode gelap |
| `QrCode` | `components/ui/qr-code.tsx` | QR kartu anggota & nota pinjaman |
| `useApiMutation` | `hooks/useApi.ts` | Mutasi + invalidasi cache |
| `useListParams` | `hooks/useApi.ts` | Filter tersinkron URL |
| `useDebounced` | `hooks/useApi.ts` | Debounce pencarian |
| `AppShell` | `layouts/AppShell.tsx` | Sidebar, header, notifikasi |
| `NotificationCenter` | `components/layout/NotificationCenter.tsx` | Lonceng + daftar notifikasi |
| `ProtectedRoute` | `routes/guards.tsx` | Gerbang rute + redirect role |
| `ErrorBoundary` | `routes/ErrorBoundary.tsx` | Perlindungan dari render error |
| `CountUp` | `components/ui/book-cover.tsx` | Angka beranimasi |
| `BookCover` | `components/ui/book-cover.tsx` | Cover + fallback lokal |
| Motion presets | `lib/motion.ts` | Bahasa animasi terpusat |
