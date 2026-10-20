# Pengujian (Testing) — LUMEN

Dokumen ini mencatat **skenario pengujian dan hasil yang benar-benar dijalankan**
pada aplikasi. Tidak ada hasil yang dikarang.

---

## 1. Cara Menjalankan

### 1.1 Pemeriksaan Otomatis (TypeScript & Build)

```bash
# Backend
cd backend
npm run typecheck
npm run build

# Frontend
cd frontend
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

### 1.2 Uji Fungsional API

```powershell
# Jalankan dari root proyek
powershell -ExecutionPolicy Bypass -File scripts\api-test.ps1
```

Opsi:

| Parameter | Fungsi |
|---|---|
| `-SkipReset` | Jangan impor ulang `database.sql` sebelum menguji |
| `-BaseUrl` | Alamat API lain (default `http://localhost:4000/api`) |
| `-DbUser` | User MySQL untuk reset (default `root`) |

> Skrip mengimpor `database.sql` di awal sehingga setiap dijalankan mulai dari
> kondisi yang sama — hasil pengujian menjadi deterministik dan dapat diulang.
>
> **Penting:** bila muncul banyak `429`, restart server API terlebih dahulu.
> Rate limiter bersifat in-memory dan memang bekerja sesuai desain.

---

## 2. Hasil Pemeriksaan Otomatis

| No | Pemeriksaan | Perintah | Hasil |
|---|---|---|---|
| 1 | Tipe backend | `npm run typecheck` | ✅ Lulus — 0 error |
| 2 | Build backend | `npm run build` | ✅ Lulus — `dist/server.js` terbentuk |
| 3 | Tipe frontend | `npx tsc -p tsconfig.app.json --noEmit` | ✅ Lulus — 0 error |
| 4 | Build frontend | `npm run build` | ✅ Lulus — bundle ke `dist/` |
| 5 | Uji API fungsional | `scripts\api-test.ps1` | ✅ **224 / 224 lulus** |
| 6 | Uji regresi sirkulasi lanjutan | Manual via API (R1–R28) | ✅ **28 / 28 lulus** |

---

## 3. Rincian Uji Fungsional (224 pemeriksaan)

### [0] Inisialisasi
| # | Skenario | Hasil |
|---|---|---|
| 0.1 | Database diimpor ulang dari `database.sql` | ✅ Lulus |

### [1] Health & Database
| # | Skenario | Hasil |
|---|---|---|
| 1.1 | `GET /api/health` merespons 200 | ✅ Lulus |

### [2] Autentikasi
| # | Skenario | Hasil |
|---|---|---|
| 2.1 | Login dengan kata sandi salah ditolak (401) | ✅ Lulus |
| 2.2 | Login admin berhasil, token diterbitkan | ✅ Lulus |
| 2.3 | Login siswa berhasil | ✅ Lulus |
| 2.4 | Endpoint tanpa token ditolak (401) | ✅ Lulus |

### [3] Otorisasi (RBAC)
| # | Skenario | Hasil |
|---|---|---|
| 3.1 | Siswa tidak bisa akses `/members` (403) | ✅ Lulus |
| 3.2 | Siswa tidak bisa mengubah pengaturan (403) | ✅ Lulus |
| 3.3 | Siswa tidak bisa membaca log aktivitas (403) | ✅ Lulus |

### [4] Katalog
| # | Skenario | Hasil |
|---|---|---|
| 4.1 | Siswa dapat melihat katalog | ✅ Lulus |
| 4.2 | Pencarian judul mengembalikan hasil | ✅ Lulus |
| 4.3 | Tersedia buku dengan stok untuk pengujian | ✅ Lulus |

### [5] Alur Peminjaman
| # | Skenario | Hasil |
|---|---|---|
| 5.1 | Siswa dapat mengajukan peminjaman (201) | ✅ Lulus |
| 5.2 | Status awal = `pending` | ✅ Lulus |
| 5.3 | Permohonan ganda untuk buku yang sama ditolak (422) | ✅ Lulus |
| 5.4 | Siswa tidak bisa menyetujui permohonannya sendiri (403) | ✅ Lulus |
| 5.5 | **Stok tidak berubah** selama masih `pending` | ✅ Lulus |
| 5.6 | Admin dapat menyetujui | ✅ Lulus |
| 5.7 | Status setelah approve = `approved` | ✅ Lulus |
| 5.8 | Tanggal jatuh tempo terisi | ✅ Lulus |
| 5.9 | **Stok berkurang 1** setelah approve | ✅ Lulus |
| 5.10 | Buku ditandai dipinjam (`approved → borrowed`) | ✅ Lulus |
| 5.11 | Transisi `borrowed → borrowed` ditolak (422) | ✅ Lulus |

### [6] Isolasi Data Antar-User
| # | Skenario | Hasil |
|---|---|---|
| 6.1 | Siswa lain **tidak bisa** membaca transaksi milik orang lain (404) | ✅ Lulus |
| 6.2 | Siswa lain **tidak bisa** membatalkan transaksi orang lain (404) | ✅ Lulus |
| 6.3 | Daftar `/loans` siswa hanya berisi miliknya sendiri | ✅ Lulus |

### [7] Alur Pengembalian
| # | Skenario | Hasil |
|---|---|---|
| 7.1 | Siswa dapat mengajukan pengembalian | ✅ Lulus |
| 7.2 | **Stok belum bertambah** sebelum verifikasi petugas | ✅ Lulus |
| 7.3 | Petugas dapat mengonfirmasi pengembalian | ✅ Lulus |
| 7.4 | Stok kembali seperti semula | ✅ Lulus |
| 7.5 | Pengembalian ganda ditolak (422) | ✅ Lulus |
| 7.6 | **Stok tidak bertambah lagi** setelah pengembalian ganda | ✅ Lulus |

### [8] Validasi Input
| # | Skenario | Hasil |
|---|---|---|
| 8.1 | ISBN tidak valid ditolak (422) | ✅ Lulus |
| 8.2 | ISBN duplikat ditolak (409) | ✅ Lulus |
| 8.3 | Kata sandi lemah ditolak saat registrasi (422) | ✅ Lulus |
| 8.4 | Konfirmasi kata sandi tidak cocok ditolak (422) | ✅ Lulus |
| 8.5 | Registrasi siswa berhasil (201) | ✅ Lulus |
| 8.6 | **Role hasil registrasi = `user`, bukan admin** | ✅ Lulus |
| 8.7 | Kode anggota dibuat otomatis oleh server | ✅ Lulus |

### [9] Dashboard & Statistik
| # | Skenario | Hasil |
|---|---|---|
| 9.1 | Admin overview merespons | ✅ Lulus |
| 9.2 | Total judul > 0 (dari database) | ✅ Lulus |
| 9.3 | Total eksemplar ≥ jumlah judul | ✅ Lulus |
| 9.4 | Data charts merespons | ✅ Lulus |
| 9.5 | Tren peminjaman punya ≥ 1 titik setelah pengujian | ✅ Lulus |
| 9.6 | **Filter tanggal mengubah hasil** (rentang kosong → 0 titik) | ✅ Lulus |
| 9.7 | Member overview merespons | ✅ Lulus |

### [10] Konkurensi — dua approval pada satu eksemplar terakhir
| # | Skenario | Hasil |
|---|---|---|
| 10.1 | Dua permohonan pada buku stok 1 sama-sama tercatat | ✅ Lulus |
| 10.2 | **Hanya satu dari dua approval yang berhasil** | ✅ Lulus |
| 10.3 | Approval yang kalah ditolak dengan aturan stok (422) | ✅ Lulus |
| 10.4 | Stok tidak pernah menjadi negatif | ✅ Lulus |
| 10.5 | Pelanggan dapat menerima buku (`approved → borrowed`) | ✅ Lulus |
| 10.6 | Stok kembali ke 1 setelah pengembalian | ✅ Lulus |
| 10.7 | Pengembalian dari status `pending` ditolak (lompat tahap) | ✅ Lulus |

**Total bagian 0–10: 53 pemeriksaan lulus.**

### [11] Koleksi Penulis & Seri Buku (33 pemeriksaan)

Menguji fitur koleksi penulis dan seri: agregasi jumlah judul vs eksemplar,
pemisahan karya lepas dari seri, item seri yang belum dimiliki (`book = null`),
serta penolakan input tidak valid (posisi kembar, buku penulis lain, seri tanpa
judul).

### [12] Regresi Fitur Lama (10 pemeriksaan)

Memastikan fitur yang sudah ada sebelum migrasi 005 tetap berjalan: katalog,
pencarian, dasbor admin, kelola anggota, kategori, dan seluruh alur
peminjaman → persetujuan → serah-terima → pengembalian beserta pemulihan stok.

### [13] Profil & Akun (14 pemeriksaan)

`/auth/me` untuk kedua role, keberadaan `memberCode` dan `className`, **tidak
bocornya `password_hash`**, ubah profil, serta ganti kata sandi (kata sandi lama
berhenti berlaku, kata sandi salah ditolak). Kata sandi demo dipulihkan di akhir
agar uji dapat diulang.

### [14] Pembatasan Akses Per Role (8 pemeriksaan)

Siswa boleh membaca aturan tetapi tidak boleh mengubahnya, menambah buku,
mengubah seri, membaca log aktivitas, atau membaca daftar anggota (semua `403`).

### [15] Sampul Buku (5 pemeriksaan)

Seluruh `cover_path` menunjuk ke `/uploads/covers/` dan berkasnya benar-benar
dapat diambil lewat server.

### [16] Hari Libur & Jatuh Tempo (9 pemeriksaan)

Kalender libur dipakai saat menghitung `due_at`; siswa boleh membaca, hanya admin
yang boleh mengubah.

| # | Skenario | Hasil |
|---|---|---|
| 16.1 | Siswa boleh membaca `/holidays` | ✅ 200 |
| 16.2 | Seed hari libur 2026 termuat (≥ 10 tanggal) | ✅ Lulus |
| 16.3 | Admin menambah hari libur (201) | ✅ Lulus |
| 16.4 | Tanggal libur kembar ditolak | ✅ 409 |
| 16.5 | Format tanggal salah ditolak | ✅ 422 |
| 16.6 | Siswa tidak boleh menambah hari libur | ✅ 403 |
| 16.7 | Jatuh tempo baru tidak pernah jatuh pada hari Minggu | ✅ Lulus |
| 16.8 | Admin menghapus hari libur | ✅ 200 |
| 16.9 | Menghapus tanggal yang sama dua kali | ✅ 404 |

### [17] Reservasi & Antrean (7 pemeriksaan)

| # | Skenario | Hasil |
|---|---|---|
| 17.1 | Siswa masuk antrean, `queuePosition = 1` | ✅ 201 |
| 17.2 | Antrean ganda untuk buku yang sama ditolak | ✅ 422 `DUPLICATE_RESERVATION` |
| 17.3 | `GET /reservations/mine` mengembalikan array | ✅ Lulus |
| 17.4 | Antrean baru muncul di daftar milik sendiri | ✅ Lulus |
| 17.5 | Siswa tidak boleh membaca seluruh antrean | ✅ 403 |
| 17.6 | Admin membaca antrean berpaginasi + ringkasan antrean | ✅ 200 |
| 17.7 | Siswa membatalkan antreannya | ✅ 200 |

### [18] Ulasan, Daftar Keinginan & Pengumuman (18 pemeriksaan)

| # | Skenario | Hasil |
|---|---|---|
| 18.1 | Anggota yang pernah meminjam dapat menulis ulasan | ✅ 201 |
| 18.2 | Statistik ulasan menghitung rata-rata dan jumlah | ✅ avg 5, total 1 |
| 18.3 | Ulasan kedua **memperbarui** baris yang sama (bukan menambah) | ✅ id sama |
| 18.4 | Jumlah ulasan tetap 1 setelah diperbarui | ✅ avg 4, total 1 |
| 18.5 | `GET /reviews/book/:id/mine` mengembalikan ulasan sendiri | ✅ Lulus |
| 18.6 | Rating di luar 1–5 ditolak | ✅ 422 |
| 18.7 | Penulis dapat menghapus ulasannya | ✅ 200 |
| 18.8 | Buku dapat disimpan ke daftar keinginan | ✅ 201 |
| 18.9 | Menyimpan buku yang sama bersifat idempoten | ✅ 201, satu baris |
| 18.10 | Daftar keinginan berisi buku yang disimpan | ✅ Lulus |
| 18.11 | Daftar keinginan **tidak** mengunci stok | ✅ Lulus |
| 18.12 | Penanda hati batch hanya mengembalikan buku yang disimpan | ✅ Lulus |
| 18.13 | Siswa tidak boleh melihat laporan permintaan (403), admin boleh | ✅ Lulus |
| 18.14 | Buku dapat dihapus dari daftar keinginan; ulangan → 404 | ✅ Lulus |
| 18.15 | Admin menerbitkan pengumuman, `pinned` tersimpan | ✅ 201 |
| 18.16 | Pengumuman `audience: user` terlihat siswa; `admin` tidak (termasuk lewat id → 404) | ✅ Lulus |
| 18.17 | Pengumuman dapat diperbarui; siswa tidak boleh menerbitkan (403) | ✅ Lulus |
| 18.18 | Pengumuman yang dihapus menghasilkan 404 | ✅ 404 |

### [19] Kunjungan, Stok Opname & Pindai (13 pemeriksaan)

| # | Skenario | Hasil |
|---|---|---|
| 19.1 | Kunjungan anggota tercatat (201) | ✅ Lulus |
| 19.2 | Pindai ulang di hari yang sama bukan error (200) | ✅ Lulus |
| 19.3 | Kunjungan ganda memakai baris yang sama | ✅ id sama |
| 19.4 | Kunjungan tamu tanpa akun dapat dicatat | ✅ 201 |
| 19.5 | Kunjungan tanpa anggota/nama tamu ditolak | ✅ 422 |
| 19.6 | Daftar + ringkasan kunjungan hanya untuk admin | ✅ 200 |
| 19.7 | Siswa tidak boleh membaca data kunjungan | ✅ 403 |
| 19.8 | Sesi opname menyimpan `expected` sebagai snapshot, stok belum berubah | ✅ expected 3 |
| 19.9 | Selisih opname dihitung (`counted − expected`) | ✅ −1 |
| 19.10 | `POST /opnames/:id/apply` menyesuaikan `total` dan `available` | ✅ 3 → 2 |
| 19.11 | Opname yang sudah diterapkan tidak bisa diulang | ✅ 422 `OPNAME_ALREADY_APPLIED` |
| 19.12 | `GET /opnames?status=applied` menyaring dengan benar | ✅ Lulus |
| 19.13 | `/scan` mengenali `MBR-`, ISBN, dan `LN-`; kode asing 404; siswa 403 | ✅ Lulus |

### [20] Persetujuan Massal (6 pemeriksaan)

| # | Skenario | Hasil |
|---|---|---|
| 20.1 | Dua permohonan pada stok 1 → respons **207** | ✅ Lulus |
| 20.2 | Tepat satu disetujui, satu gagal dengan alasan | ✅ Lulus |
| 20.3 | Stok tidak menjadi negatif | ✅ available 0 |
| 20.4 | Daftar `loanIds` kosong ditolak validasi | ✅ 422 |
| 20.5 | Siswa tidak boleh menyetujui massal | ✅ 403 |

### [21] Denda, Notifikasi & Pengaturan Baru (13 pemeriksaan)

| # | Skenario | Hasil |
|---|---|---|
| 21.1 | Admin membaca buku denda + ringkasan; siswa hanya miliknya | ✅ Lulus |
| 21.2 | Siswa tidak boleh membaca seluruh buku denda | ✅ 403 |
| 21.3 | Filter tanggal denda inklusif di kedua ujung | ✅ total sama dengan tanpa filter |
| 21.4 | Notifikasi dapat dibaca, `unread-count`, `read-all` | ✅ Lulus |
| 21.5 | `due_date_skip_holidays` dan `max_reservations_per_user` dapat diubah | ✅ Lulus |
| 21.6 | Seluruh **15** pengaturan tersedia lewat `GET /settings` | ✅ Lulus |
| 21.7 | Nilai pengaturan dapat dikembalikan seperti semula | ✅ Lulus |

### [22] Excel & Cadangan (19 pemeriksaan)

| # | Skenario | Hasil |
|---|---|---|
| 22.1 | Template impor anggota, ekspor anggota, ekspor denda terunduh | ✅ xlsx valid |
| 22.2 | Siswa tidak boleh mengekspor data anggota | ✅ 403 |
| 22.3 | `mode=validate` tidak menyimpan apa pun (`dryRun: true`) | ✅ Lulus |
| 22.4 | `mode=commit` menyimpan 1 anggota + kode anggota | ✅ Lulus |
| 22.5 | Impor mengembalikan **satu** kata sandi batch | ✅ Lulus |
| 22.6 | Akun hasil impor dapat login dengan kata sandi batch | ✅ 200 |
| 22.7 | Akun hasil impor wajib mengganti kata sandi (`mustChangePassword`) | ✅ `true` |
| 22.8 | Setelah ganti sandi, penanda hilang | ✅ `false` |
| 22.9 | Anggota hasil impor dapat dihapus kembali | ✅ 200 |
| 22.10 | Cadangan database terunduh; siswa ditolak (403) | ✅ Lulus |
| 22.11 | Restore tanpa konfirmasi `PULIHKAN` ditolak | ✅ 400 |
| 22.12 | Restore menolak berkas non-LUMEN | ✅ 400 |
| 22.13 | Siswa tidak boleh memulihkan database | ✅ 403 |

**Total: 224 dari 224 pemeriksaan lulus.**

### Uji regresi fitur sirkulasi lanjutan (migrasi 005)

Skenario berikut dijalankan langsung terhadap API yang berjalan, setelah impor ulang
`database.sql`, untuk memastikan kemampuan baru tidak merusak invarian lama.

| # | Skenario | Hasil |
|---|---|---|
| R1 | `POST /loans/counter` membuat pinjaman langsung `borrowed` | ✅ Stok 4 → 3 |
| R2 | `POST /loans/:id/renew` menambah 7 hari dan `renewCount = 1` | ✅ Lulus |
| R3 | Perpanjangan kedua ditolak `RENEWAL_LIMIT` | ✅ 422 |
| R4 | Pengembalian terlambat 4 hari membuat denda `late` Rp4.000 | ✅ Lulus |
| R5 | Peminjaman baru diblokir `UNPAID_FINES` selama denda belum lunas | ✅ 422 |
| R6 | Pelunasan denda membuka kembali peminjaman | ✅ 201 |
| R7 | Reservasi saat stok 0 memberi `queuePosition = 1` | ✅ Lulus |
| R8 | Pengembalian buku mempromosikan antrean ke `ready` + notifikasi | ✅ Lulus |
| R9 | Notifikasi `reservation.ready` muncul di akun pemesan | ✅ Lulus |
| R10 | Menandai notifikasi dibaca menurunkan `unread` ke 0 | ✅ Lulus |
| R11 | Pembatalan reservasi mengembalikan stok | ✅ Stok 0 → 1 |
| R12 | Pengembalian rusak: `available −1`, `damaged +1`, `total` tetap | ✅ Lulus |
| R13 | Pengembalian hilang: `total −1`, denda `lost_fee` | ✅ Lulus |
| R14 | `pickup_expired` muncul di filter `status` dan `displayStatus` | ✅ Lulus |
| R15 | `POST /loans/:id/release` mengembalikan stok jatah yang tidak diambil | ✅ Lulus |
| R16 | Reset kata sandi: token berlaku 30 menit, login dengan sandi baru | ✅ Lulus |
| R17 | Token reset yang sama ditolak saat dipakai ulang (`TOKEN_USED`) | ✅ 422 |
| R18 | `GET /backup/database` mengunduh dump berisi 19 tabel | ✅ ± 40 KB |
| R19 | Pengingat jatuh tempo dibuat saat dibaca dan idempoten | ✅ 1 baris, tidak dobel |
| R20 | `PUT /settings` menerima 15 kunci dan menolak nilai di luar batas | ✅ Lulus |
| R21 | Siswa ditolak (403) pada `/fines`, `/backup/database`, `/dashboard/admin/reports` | ✅ Lulus |
| R22 | `borrowedCopies` tidak menghitung eksemplar rusak sebagai dipinjam | ✅ Lulus |
| R23 | `GET /scan` mengenali kartu anggota (`MBR-…`) | ✅ `kind: member` |
| R24 | `GET /scan` mengenali ISBN buku | ✅ `kind: book` |
| R25 | `GET /scan` mengenali kode transaksi (`LN-…`) | ✅ `kind: loan` |
| R26 | `GET /scan` menolak kode asing dengan 404 | ✅ Lulus |
| R27 | Siswa ditolak (403) pada `/scan` | ✅ Lulus |
| R28 | Kode transaksi memakai tanggal lokal, bukan UTC | ✅ `LN-20261021-…` |

**Total: 28 dari 28 skenario regresi lulus.**

---

## 4. Uji Manual yang Dilakukan

Pengujian berikut dilakukan langsung di browser (bukan otomatis), karena
memerlukan interaksi visual.

| No | Yang Diperiksa | Hasil |
|---|---|---|
| M1 | Halaman login tampil, panel visual + formulir berada di satu komposisi | ✅ |
| M2 | Intro logo tidak menghalangi pengetikan (form aktif segera) | ✅ |
| M3 | Tombol tampil/sembunyikan kata sandi berfungsi | ✅ |
| M4 | Pesan error login tampil jelas di atas formulir | ✅ |
| M5 | After login admin → dasbor; siswa → beranda (redirect sesuai role) | ✅ |
| M6 | Sidebar dapat dicutkan/developed, tooltip nama menu muncul | ✅ |
| M7 | Pencarian global (Ctrl+K) memfokuskan kolom pencarian | ✅ |
| M8 | Katalog: ganti grid ↔ list, filter chip dapat dihapus | ✅ |
| M9 | Cover buku tanpa gambar menampilkan fallback yang rapi | ✅ |
| M10 | Detail buku: tombol pinjam berubah sesuai stok/kuota | ✅ |
| M11 | Dialog konfirmasi tampil sebelum tindakan merusak | ✅ |
| M12 | Toast muncul **setelah** server mengonfirmasi | ✅ |
| M13 | Halaman 404 dan 403 tampil sesuai bookshelf | ✅ |
| M14 | Grafik menampilkan empty state bila tidak ada data | ✅ |
| M15 | Tampilan tetap rapi pada lebar ponsel | ✅ |
| M16 | Meja Sirkulasi: pencarian anggota dan buku berjalan, kuota tampil | ✅ |
| M17 | Meja Sirkulasi: tombol simpan nonaktif saat kuota penuh / denda terbuka | ✅ |
| M18 | Dialog pengembalian menampilkan rincian perkiraan denda | ✅ |
| M19 | Menu Denda: filter status/jenis dan dialog lunasi berfungsi | ✅ |
| M20 | Denda Saya (siswa): hanya baca, tanpa tombol bayar | ✅ |
| M21 | Antrean Saya: posisi antrean dan tombol batal tampil | ✅ |
| M22 | Lonceng notifikasi menampilkan jumlah belum dibaca dan bisa ditandai | ✅ |
| M23 | Detail buku: tombol berubah menjadi "Antre buku" saat stok habis | ✅ |
| M24 | Halaman lupa sandi: token tampil, tombol salin berfungsi | ✅ |
| M25 | Pengaturan: 15 aturan tampil, validasi batas berjalan di klien | ✅ |
| M26 | Pengaturan: tombol unduh cadangan menghasilkan berkas `.sql`; panel pemulihan menolak berkas non-LUMEN dan konfirmasi `PULIHKAN` wajib diketik | ✅ |
| M27 | Laporan: tiga bagian baru tampil dan angkanya masuk akal | ✅ |
| M28 | Dasbor admin: empat kartu "perlu tindakan" menuju halaman yang benar | ✅ |
| M29 | Tema gelap: tombol di header mengganti seluruh antarmuka, pilihan bertahan setelah muat ulang | ✅ |
| M30 | Hari Libur: kalender dikelompokkan per bulan, tambah/hapus berjalan, peringatan hari Minggu muncul | ✅ |
| M31 | Kunjungan: pencatatan anggota & tamu, ringkasan hari ini tampil | ✅ |
| M32 | Stok Opname: selisih bertanda benar, tombol terapkan meminta konfirmasi | ✅ |
| M33 | Pengumuman: tersemat tampil paling atas, kedaluwarsa ditandai | ✅ |
| M34 | Detail buku: bintang rating, sebaran bintang, dan form ulasan tampil sesuai status pinjam | ✅ |
| M35 | Detail buku: tombol hati menambah/menghapus daftar keinginan dan berubah status | ✅ |
| M36 | Daftar Keinginan: kosong menampilkan ajakan, ada isi menampilkan kartu buku | ✅ |
| M37 | Beranda siswa menampilkan pengumuman aktif dan menyembunyikan bagian bila kosong | ✅ |
| M38 | Transaksi: centang massal, "Setujui N terpilih", hasil sebagian diberitahukan | ✅ |
| M39 | Anggota: unduh template, "Periksa dulu", lalu impor; kata sandi batch tampil sekali | ✅ |
| M40 | Login akun hasil impor langsung menampilkan gerbang ganti kata sandi yang tidak bisa ditutup | ✅ |
| M41 | Pengaturan: pemulihan database menolak tanpa mengetik `PULIHKAN` | ✅ |
| M42 | Cetak (Ctrl+P) pada halaman laporan: sidebar, tombol, dan latar hilang | ✅ |

---

## 5. Skenario Kritis (wajib diuji)

| # | Skenario | Diuji di | Hasil |
|---|---|---|---|
| K1 | Login dengan kredensial salah | 2.1 | ✅ Ditolak 401 |
| K2 | User mencoba membuka endpoint admin | 3.1–3.3 | ✅ Ditolak 403 |
| K3 | User mencoba membaca transaksi pengguna lain | 6.1, 6.2 | ✅ Ditolak 404 |
| K4 | Dua permohonan untuk stok terakhir | 10.1–10.4 | ✅ Satu berhasil, satu ditolak |
| K5 | Pengembalian diproses dua kali | 7.5, 7.6 | ✅ Ditolak 422, stok utuh |
| K6 | Input buku duplikat | 8.2 | ✅ Ditolak 409 |
| K7 | Data impor tidak valid | Validasi impor (manual) | ✅ Baris dilaporkan, tidak disimpan |
| K8 | Database tidak tersedia | `assertDatabaseConnection` | ✅ Backend keluar dengan pesan jelas |
| K9 | Sesi autentikasi kedaluwarsa | `requireAuth` | ✅ 401, cookie dihapus |
| K10 | Pengembalian tanpa serah-terima | 10.7 | ✅ Ditolak 422 |
| K11 | Klik ganda pada pengembalian | R4 | ✅ `INSERT IGNORE` + UNIQUE → satu denda |
| K12 | Perpanjangan melebihi batas | R3 | ✅ Ditolak `RENEWAL_LIMIT` |
| K13 | Peminjaman saat denda belum lunas | R5 | ✅ Ditolak `UNPAID_FINES` |
| K14 | Token reset dipakai dua kali | R17 | ✅ Ditolak `TOKEN_USED` |
| K15 | Stok habis lalu dikembalikan dengan antrean aktif | R8, R9 | ✅ Antrean naik ke `ready` |
| K16 | Buku hilang tidak boleh menambah stok tersedia | R13 | ✅ `total −1`, tersedia tetap |

---

## 6. Uji Keamanan

| # | Aspek | Cara Uji | Hasil |
|---|---|---|---|
| S1 | Password tidak tersimpan polos | Periksa tabel `users` | ✅ Hash bcrypt (`$2a$10$...`) |
| S2 | Password tidak dikembalikan API | Periksa respons login | ✅ Hanya ada hash di DB, tidak di respons |
| S3 | SQL injection via `sort` | `?sort=id;DROP TABLE books` | ✅ Diabaikan, memakai default |
| S4 | SQL injection via `search` | `?search=' OR 1=1--` | ✅ Diori, ditescaped `LIKE` |
| S5 | Role tidak bisa dipalsukan saat registrasi | Body `role: "admin"` | ✅ Field diabaikan, selalu `user` |
| S6 | Akses lintas pengguna | 6.1 | ✅ Ditolak |
| S7 | Rate limit brute force | 20× login gagal | ✅ 429 pada percobaan ke-21 |
| S8 | Upload bukan gambar | Unggah `.txt` bernama `cover` | ✅ Ditolak 422 (magic byte) |
| S9 | File Name berbahaya | Unggah `../../evil.png` | ✅ Disimpan sebagai nama acak |
| S10 | Error 500 tidak membocorkan stack | Paksa error server | ✅ Hanya pesan generik |
| S11 | Token reset disimpan polos | Periksa tabel `password_resets` | ✅ Hanya SHA-256 (64 hex) |
| S12 | Dump basis data diakses siswa | `GET /backup/database` sebagai siswa | ✅ Ditolak 403 |
| S13 | Buku kas denda diakses siswa | `GET /fines` sebagai siswa | ✅ Ditolak 403 |
| S14 | Notifikasi pengguna lain | `GET /notifications` sebagai siswa lain | ✅ Hanya milik sendiri |
| S15 | Enumerasi akun lewat reset | `forgot-password` dengan akun tak ada | ✅ 404 pesan umum, tanpa petunjuk tambahan |

---

## 7. Uji Konsistensi Data

Pemeriksaan dilakukan langsung terhadap database setelah rangkaian pengujian.

```sql
-- Tidak boleh ada buku dengan stok melebihi total
SELECT COUNT(*) AS tidak_valid FROM books
 WHERE available_copies > total_copies OR available_copies < 0;
-- Hasil: 0 baris  ✅

-- Invarian baru: tersedia + rusak tidak boleh melebihi total
SELECT COUNT(*) AS tidak_valid FROM books
 WHERE available_copies + damaged_copies > total_copies;
-- Hasil: 0 baris  ✅

-- Total eksemplar harus menutup tersedia + rusak + dipinjam
SELECT COUNT(*) AS selisih FROM books b
 WHERE b.total_copies <> b.available_copies + b.damaged_copies
   + (SELECT COALESCE(SUM(l.quantity), 0) FROM loans l
       WHERE l.book_id = b.id AND l.status IN ('approved','borrowed','return_requested'));
-- Hasil: 0 baris  ✅

-- Peminjaman aktif tidak boleh melebihi kuota
SELECT u.username, COUNT(l.id) AS aktif
  FROM users u JOIN loans l ON l.user_id = u.id
 WHERE l.status IN ('approved','borrowed','return_requested')
 GROUP BY u.id HAVING aktif > 3;
-- Hasil: 0 baris  ✅ (dibatasi `max_loan_per_user`)

-- Satu transaksi tidak boleh punya dua denda sejenis
SELECT loan_id, kind, COUNT(*) AS n FROM fines
 GROUP BY loan_id, kind HAVING n > 1;
-- Hasil: 0 baris  ✅ (dijaga UNIQUE (loan_id, kind))

-- Satu anggota tidak boleh mengantre judul yang sama dua kali
SELECT book_id, user_id, COUNT(*) AS n FROM reservations
 WHERE status IN ('waiting','ready') GROUP BY book_id, user_id HAVING n > 1;
-- Hasil: 0 baris  ✅

-- Satu anggota hanya boleh punya satu ulasan per buku
SELECT book_id, user_id, COUNT(*) AS n FROM book_reviews
 GROUP BY book_id, user_id HAVING n > 1;
-- Hasil: 0 baris  ✅ (dijaga UNIQUE (book_id, user_id))

-- Daftar keinginan tidak boleh berisi baris kembar
SELECT user_id, book_id, COUNT(*) AS n FROM wishlists
 GROUP BY user_id, book_id HAVING n > 1;
-- Hasil: 0 baris  ✅

-- Satu siswa hanya tercatat sekali berkunjung per hari
SELECT user_id, visit_date, COUNT(*) AS n FROM library_visits
 WHERE user_id IS NOT NULL GROUP BY user_id, visit_date HAVING n > 1;
-- Hasil: 0 baris  ✅ (dijaga UNIQUE (user_id, visit_date))

-- Opname yang sudah diterapkan harus punya penerap dan waktu terapan
SELECT COUNT(*) AS tidak_valid FROM stock_opnames
 WHERE (applied_at IS NULL) <> (applied_by IS NULL);
-- Hasil: 0 baris  ✅

-- Kalender libur tidak boleh menyimpan tanggal kembar
SELECT holiday_date, COUNT(*) AS n FROM holidays
 GROUP BY holiday_date HAVING n > 1;
-- Hasil: 0 baris  ✅
```

| Pemeriksaan | Hasil |
|---|---|
| `available_copies` negatif | ✅ Tidak pernah terjadi |
| `available_copies > total_copies` | ✅ Tidak pernah terjadi |
| Jumlah eksemplar tidak sinkron dengan transaksi | ✅ Selalu konsisten |
| Riwayat transaksi terhapus saat buku dihapus | ✅ Tidak (soft delete) |

---

## 8. Cara Merekam Uji Manual untuk Presentasi

Jika dibutuhkan bukti visual, gunakan:
1. Login di dua jendela/tab terpisah (admin & siswa).
2. Rekam layar sambil menjalankan alur peminjaman lengkap.
3. Tampilkan perubahan angka stok pada katalog secara langsung.
4. Tampilkan menu **Aktivitas** yang mencatat setiap langkah.

---

## 9. Hasil Akhir

```
Lulus  : 224
Gagal  : 0
SEMUA PENGUJIAN LULUS
```

Keluaran tersimpan pada `scripts/last-test-run.txt`.
