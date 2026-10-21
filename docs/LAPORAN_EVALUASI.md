# Laporan Evaluasi — LUMEN

Evaluasi jujur terhadap hasil pengembangan aplikasi, termasuk fitur yang berhasil,
hasil pengujian nyata, keterbatasan, dan rencana pengembangan lanjutan.

---

## 1. Ringkasan Hasil

| Aspek | Status |
|---|---|
| Persyaratan UKK (fitur wajib Admin & User) | ✅ Terpenuhi seluruhnya |
| Koneksi database nyata (bukan dummy) | ✅ Terhubung MariaDB |
| Berjalan tanpa internet | ✅ Tanpa font/aset eksternal |
| Build tanpa error | ✅ Backend & frontend |
| Uji fungsional otomatis | ✅ **251/251 lulus** |
| Uji regresi fitur lanjutan | ✅ **28/28 lulus** |
| Dokumentasi lengkap | ✅ 10 berkas dokumentasi + `database.sql` |

---

## 2. Pemetaan Persyaratan UKK

Soal UKK meminta beberapa hal berikut. Berikut pemetaannya:

| Fitur | Admin | User | Status |
|---|:---:|:---:|---|
| Daftar | V | V | ✅ Halaman `/daftar` (khusus siswa) |
| Login | V | V | ✅ `/masuk`, username **atau** email |
| Pemilihan Menu | V | V | ✅ Sidebar berbeda per role |
| CRUD Transaksi | V | V | ✅ `POST/GET/PATCH` loans, semua status |
| CRUD Data Buku | X | V | ✅ CRUD lengkap + upload cover + soft delete |
| CRUD Kelola Anggota | X | V | ✅ CRUD lengkap + kode anggota otomatis |
| Pencarian Kondisi Tertentu | V | V | ✅ Pencarian + filter + sorting + pagination |

### Tambahan di luar syarat (menambah nilai)

| Fitur | Keterangan |
|---|---|
| Impor/Ekspor Excel | Dengan validasi per baris & proteksi formula injection |
| Audit trail | Setiap tindakan penting tercatat |
| Dasbor grafik | 5 visualisasi dari query agregat |
| Denda sebagai data | Baris `fines` yang di-snapshot, bukan angka yang dihitung ulang |
| Meja sirkulasi | Peminjaman langsung di loket tanpa permohonan siswa |
| Perpanjangan pinjaman | Dibatasi `max_renewals`, ditolak bila terlambat |
| Batas waktu pengambilan | `pickup_deadline` tersimpan, status `pickup_expired` |
| Antrean buku | Reservasi dengan promosi otomatis ke `ready` |
| Notifikasi in-app | Persetujuan, jatuh tempo, denda, antrean siap |
| Reset kata sandi mandiri | Token sekali pakai, hanya hash yang disimpan |
| Pemindai kartu & barcode | Satu kolom menerima kode anggota, ISBN, dan kode transaksi |
| Kartu anggota ber-QR | Dapat ditampilkan dan dicetak dari halaman anggota |
| Laporan analitis | Buku tak pernah dipinjam, anggota terlambat, rekap denda |
| Cadangan basis data | Unduh dump `.sql` sekali klik, plus pemulihan dengan konfirmasi `PULIHKAN` |
| Persetujuan massal | Setujui banyak permohonan sekaligus; tiap item transaksi sendiri (`207` bila sebagian gagal) |
| Impor anggota Excel | Dua langkah (periksa → simpan), satu kata sandi batch, wajib ganti sandi saat login |
| Hari libur | Jatuh tempo otomatis digeser melewati tanggal merah dan hari Minggu |
| Kunjungan perpustakaan | Catat kehadiran anggota (pindai kartu) dan tamu, dengan ringkasan harian |
| Stok opname | Bandingkan stok sistem dengan hitung fisik, terapkan selisih secara sadar |
| Ulasan & rating | Satu ulasan per anggota per buku, dengan syarat pernah meminjam |
| Daftar keinginan | Penanda minat baca + laporan judul paling diminati untuk pengadaan |
| Pengumuman | Audiens `all`/`user`/`admin`, bisa disematkan dan berkedaluwarsa |
| Foto profil (GIF) | Unggah/ganti/hapus; GIF animasi utuh, validasi magic bytes, 5 MB |
| Level anggota | Diturunkan dari `borrowed_at`, 5 tingkatan, dengan bilah kemajuan |
| Papan peringkat | Top pembaca di beranda siswa; posisi diri via `ROW_NUMBER()` |
| Pengaturan dinamis | 15 aturan operasional bisa diubah admin |

---

## 3. Fitur yang Berhasil Dirasionalkan

### 3.1 Backend
- **Otorisasi berlapis** — JWT + httpOnly cookie, `requireAuth`/`requireRole`,
  dan pemeriksaan kepemilikan di service. Menyembunyikan tombol di frontend
  bukan satu-satunya perlindungan.
- **Transaksi database yang benar** — `SELECT ... FOR UPDATE` pada baris buku dan
  transaksi memastikan dua approval bersamaan tidak bisa memakai eksemplar
  terakhir. **Terbukti lewat uji skenario 10.1–10.4.**
- **State machine eksplisit** — `ALLOWED_TRANSITIONS` membuat transisi ilegal
  mustahil terjadi, bukan sekadar "tidak diharapkan".
- **Validasi berlapis** — Zod pada body, query, dan file Excel; semua error
  diterjemahkan menjadi pesan berbahasa Indonesia.
- **Soft delete** — buku/anggota yang punya riwayat transaksi tidak pernah
  dihapus fisik, sehingga laporan lama tetap utuh.
- **Waktu diserahkan ke database** — setiap perbandingan "sekarang" memakai
  `NOW()`/`DATE_ADD` di SQL, bukan `new Date()` di Node. Satu jam untuk menulis
  dan memeriksa menghilangkan seluruh kelas bug zona waktu; ini ditemukan justru
  karena token reset sempat kedaluwarsa seketika di server UTC+7.
- **Denda sebagai snapshot** — nominal dihitung sekali saat pengembalian lalu
  menjadi baris data. Mengubah tarif tidak menulis ulang sejarah.
- **Idempotensi lewat constraint** — `UNIQUE (loan_id, kind)` pada `fines` dan
  `UNIQUE (user_id, dedupe_key)` pada `notifications` membuat klik ganda dan
  pembacaan berulang aman tanpa perlu pengecekan di aplikasi.
- **Posisi antrean tidak disimpan** — dihitung dari `created_at`, sehingga
  pembatalan tidak memerlukan UPDATE massal.

### 3.2 Frontend
- **Sistem desain terpusat** — token warna, tipografi, radius, shadow, dan
  durasi animasi di satu tempat (`tailwind.config.js` + `index.css`).
- **Bahasa animasi konsisten** — satu preset di `lib/motion.ts`, hanya
  `transform`/`opacity`, dan menghormati `prefers-reduced-motion`.
- **Filter tersinkron URL** — pengguna dapat menyalin tautan yang mengembalikan
  hasil pencarian yang sama.
- **State yang jujur** — skeleton, empty state, dan error state selalu
  distinguishes "belum ada data" dari "gagal memuat".

---

## 4. Hasil Pengujian

### 4.1 Otomatis

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Tipe backend | `npm run typecheck` | ✅ 0 error |
| Build backend | `npm run build` | ✅ `dist/server.js` |
| Tipe frontend | `npx tsc -p tsconfig.app.json --noEmit` | ✅ 0 error |
| Build frontend | `npm run build` | ✅ bundle terpecah per halaman |
| Uji API | `scripts\api-test.ps1` | ✅ **251/251 lulus** |
| Uji regresi sirkulasi | Manual via API (R1-R28) | ✅ **28/28 lulus** |

Rincian 251 pemeriksaan ada di [`TESTING.md`](TESTING.md).

### 4.2 Konsistensi Data

Setelah rangkaian pengujian:

| Pemeriksaan | Hasil |
|---|---|
| `available_copies` negatif | ✅ Tidak pernah |
| `available_copies > total_copies` | ✅ Tidak pernah |
| `available_copies + damaged_copies > total_copies` | ✅ Tidak pernah |
| `total_copies` tidak menutup tersedia + rusak + dipinjam | ✅ Tidak pernah |
| Pengembalian ganda menambah stok | ✅ Tidak pernah |
| Dua denda sejenis pada satu transaksi | ✅ Tidak mungkin (`UNIQUE`) |
| Dua ulasan dari orang yang sama pada satu buku | ✅ Tidak mungkin (`UNIQUE (book_id, user_id)`) |
| Kunjungan ganda orang yang sama di hari yang sama | ✅ Tidak mungkin (`UNIQUE (user_id, visit_date)`) |
| Opname diterapkan dua kali | ✅ Ditolak — sesi yang sudah `applied` tidak dapat diterapkan ulang |
| `available + damaged + borrowed = total` | ✅ Diperiksa setelah opname dan pengembalian rusak |
| Riwayat terhapus saat buku dihapus | ✅ Tidak pernah |

### 4.3 Performa

Bundle produksi terpecah otomatis per halaman (lazy loading):

| Chunk | Ukuran | gzip |
|---|---|---|
| `react` | 290 kB | 94 kB |
| `charts` | 418 kB | 119 kB |
| `motion` | 136 kB | 45 kB |
| `index` | 211 kB | 62 kB |
| Halaman individual | 9–29 kB | 3–8 kB |

Halaman katalog hanya 11.6 kB; grafik (119 kB gzip) dimuat terpisah sehingga
halaman login tidak pernah membayar biaya grafik.

---

## 5. Keterbatasan yang Diketahui

Dinyatakan terbuka agar tidak ada klaim yang tidak benar:

| # | Keterbatasan | Dampak | Alasan |
|---|---|---|---|
| 1 | **Validasi ISBN hanya format**, bukan checksum | ISBN cetakan lokal tetap diterima | Katalog sekolah sering memuat ISBN yang gagal checksum; menolak akan menghambat input |
| 2 | **Tidak ada verifikasi email** saat pendaftaran | Akun bisa dibuat dengan email yang tidak dimiliki | Verifikasi butuh layanan email di luar lingkungan lokal |
| 3 | **Token reset ditampilkan di layar**, bukan dikirim email | Siapa pun yang melihat layar dapat memakainya | Instalasi belum punya server surat; token tetap sekali pakai dan berlaku 30 menit |
| 4 | **Cover buku tidak dikompresi** di server | Berkas besar menambah I/O | tanpa library kompresi gambar; ukuran dibatasi 3 MB |
| 5 | **Rate limiter in-memory** | Reset saat server restart | Store eksternal tidak diperlukan untuk aplikasi lokal |
| 6 | **Tidak ada unit test terotomatis** (hanya uji integrasi) | Cakupan per-fungsi kurang | Uji integrasi 251 + 28 skenario lebih bernilai untuk UKK; waktu dialokasikan ke fitur |
| 7 | **Tidak ada pagination di ekspor** | Ekspor dibatasi 5000 baris | Cukup untuk skala sekolah; pesan jelas bila terlampaui |
| 8 | **Grafik tidak di-cache** | Query ulang saat filter berubah | Data kecil; filter harus mencerminkan kondisi terkini |
| 9 | **Tidak ada pencarian fuzzy/typo-tolerant** | Kesalahan ketik minor | Implementasi `LIKE` sederhana, cukup untuk kata kunci Indonesia |
| 10 | **Notifikasi hanya in-app** | Tidak ada SMS/email | Belum ada layanan pengiriman; pengingat dimaterialisasi saat aplikasi dibuka |
| 11 | **Cadangan tidak terjadwal** | Petugas harus mengunduh manual | Server sekolah tidak punya cron yang andal; berkas yang disimpan lebih berguna |
| 12 | **Batas antrean berupa pengaturan**, bukan batas keras | Admin dapat menaikkan sampai 20 judul | `max_reservations_per_user` cukup untuk kebutuhan nyata tanpa memaksa satu angka |
| 13 | **Pemindai bergantung pada perangkat** | Tanpa barcode scanner, kode harus diketik | Antarmuka tetap menyediakan kolom ketik; kamera ponsel belum dipakai sebagai pemindai |
| 14 | **Penggeseran jatuh tempo tidak melewati Sabtu** | Bila perpustakaan tutup Sabtu, tenggat bisa jatuh di hari tutup | Hanya Minggu dan tabel `holidays` yang dilewati; Sabtu dapat ditambahkan sebagai hari libur |
| 15 | **Pemulihan database memutus sesi** | Semua pengguna harus masuk ulang | Isi tabel `users` diganti dump, token lama menunjuk baris yang sudah tidak ada |
| 16 | **Kata sandi impor dibagikan sekali** | Bila hilang, harus atur ulang per anggota | Satu hash untuk satu batch demi kecepatan; diimbangi `must_change_password` |
| 17 | **Ulasan tidak dimoderasi** | Komentar kurang pantas baru hilang setelah petugas menghapusnya | Moderasi otomatis butuh model bahasa; penghapusan manual sudah tersedia |

---

## 6. Catatan Proses (jujur)

Tidak semua berjalan mulus. Selama pengerjaan ditemukan **23 masalah nyata** yang
seluruhnya tercatat di [`DEBUGGING.md`](DEBUGGING.md). Yang paling bernilai
secara pembelajaran:

1. **Skema validasi ditulis tapi tidak dipasang** — Zod ada, tetapi middleware-nya
   belum dibuat, sehingga tidak ada yang tervalidasi. Tip assertions (`as Type`)
   hanya untuk compiler, bukan runtime.
2. **Baca data di dalam transaksi** — pemanggilan fungsi query yang memakai
   koneksi terpisah tidak melihat baris yang belum di-commit.
3. **Alias `@/` terdaftar dua kali** — di bundler *dan* di tsconfig. Salah satu
   saja akan membuat build/tsc bertentangan.
4. **Pengujian yang salah, bukan kodenya** — ISBN uji 15 digit ditolak;
   memang benar sistem menolak, jadi tesnya yang diperbaiki.
5. **Dua jam untuk satu kolom** — token reset ditulis dengan `toISOString()`
   (UTC) tetapi diperiksa dengan `NOW()` (lokal). Selisih 7 jam membuat token
   berlaku minus 6,5 jam. Sekarang seluruh perhitungan waktu diserahkan ke SQL.
6. **Satu pola, empat bug** — `toISOString().slice(0, 10)` dipakai untuk kode
   transaksi, rentang dasbor, nama berkas Excel, dan nama berkas cadangan.
   Keempatnya mundur satu hari bila dijalankan sebelum pukul 07.00 WIB. Setelah
   satu diperbaiki, sisanya dicari dengan `grep` dan diperbaiki bersama.
7. **Dev server bukan bukti** — selector CSS karangan (`.max-h-\[.*\]`) lolos di
   mode dev tetapi menggagalkan `npm run build`, karena `lightningcss` jauh lebih
   ketat daripada Vite saat pengembangan.
8. **Primitif lambat untuk operasi massal** — satu hash bcrypt per anggota impor
   membuat berkas 500 baris berjalan ±40 detik. Solusinya bukan menurunkan cost,
   melainkan satu hash per batch + kewajiban ganti sandi.

---

## 7. Rencana Pengembangan Lanjutan

### Prioritas Tinggi
| # | Rencana | Manfaat |
|---|---|---|
| 1 | Verifikasi email saat pendaftaran | Mencegah akun palsu |
| 2 | Pengiriman token reset lewat email | Menghilangkan kebutuhan menyalin token dari layar |
| 3 | Notifikasi WhatsApp/SMS untuk jatuh tempo | Menjangkau siswa yang jarang membuka aplikasi |
| 4 | Moderasi ulasan (kata terlarang / antrean tinjau) | Menjaga ruang baca tetap layak tanpa pengawasan manual |

### Prioritas Sedang
| # | Rencana |
|---|---|
| 5 | Scan barcode/ISBN dengan kamera untuk input buku |
| 6 | Aplikasi Progressive Web App (PWA) agar bisa dipasang di ponsel |
| 7 | Level akses lanjutan (misalnya petugas dengan hak hanya baca) |
| 8 | Penjadwalan cadangan otomatis ke folder jaringan |
| 9 | Pencetakan laporan opname dan rekap kunjungan bulanan (saat ini lewat Excel) |

### Prioritas Rendah / Eksplorasi
| # | Rencana |
|---|---|
| 10 | Rekomendasi buku berdasarkan riwayat peminjaman |
| 11 | Dashboard per-kelas / per-tingkat |
| 12 | Audit trail dengan diff (perubahan sebelum/sesudah) |
| 13 | Uji beban (load test) dengan 100+ pengguna bersamaan |

---

## 8. Penilaian

| Aspek | Nilai | Catatan |
|---|:---:|---|
| Kesesuaian kebutuhan UKK | ★★★★★ | Semua fitur wajib ada dan berfungsi nyata |
| Kualitas kode | ★★★★☆ | Terpisah dengan rapi, type-safe, ada error handling |
| Keamanan | ★★★★☆ | bcrypt, JWT httpOnly, RBAC, rate limit, validasi berlapis |
| Kualitas database | ★★★★★ | Ternormalisasi, constraint, indeks, transaksi |
| Desain antarmuka | ★★★★★ | Sistem desain konsisten, animasi bermakna |
| Dokumentasi | ★★★★★ | 10 berkas dokumentasi + catatan debugging nyata |
| Kematangan | ★★★★☆ | Build bersih, 251 + 28 uji, siap demo |

### Kesimpulan

Aplikasi **LUMEN** telah selesai dibangun dan **terverifikasi berjalan** terhadap
database MariaDB sungguhan. Seluruh fitur yang diminta — dan tidak ada fitur
penting yang hanya berupa tampilan — berfungsi dengan data nyata.

Semua klaim pada dokumen ini dapat diperiksa ulang dengan:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\api-test.ps1
```
