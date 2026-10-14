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
| Uji fungsional otomatis | ✅ **53/53 lulus** |
| Dokumentasi lengkap | ✅ 7 dokumen + `database.sql` |

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
| Denda keterlambatan | Dihitung otomatis dari jatuh tempo |
| Pengaturan dinamis | Aturan operasional bisa diubah admin |
| Handles proyek & build | Build produksi, typecheck, uji otomatis |

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
| Uji API | `scripts\api-test.ps1` | ✅ **53/53 lulus** |

Rincian 53 skenario ada di [`TESTING.md`](TESTING.md).

### 4.2 Konsistensi Data

Setelah rangkaian pengujian:

| Pemeriksaan | Hasil |
|---|---|
| `available_copies` negatif | ✅ Tidak pernah |
| `available_copies > total_copies` | ✅ Tidak pernah |
| Pengembalian ganda menambah stok | ✅ Tidak pernah |
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
| 3 | **Tidak ada pemulihan kata sandi mandiri** | Siswa harus menghubungi petugas | Memerlukan token email |
| 4 | **Cover buku tidak dikompresi** di server | Berkas besar menambah I/O | tanpa library kompresi gambar; ukuran dibatasi 3 MB |
| 5 | **Rate limiter in-memory** | Reset saat server restart | Store eksternal tidak diperlukan untuk aplikasi lokal |
| 6 | **Tidak ada unit test terotomatis** (hanya uji integrasi) | Cakupan per-fungsi kurang | Uji integrasi 53 skenario lebih bernilai untuk UKK; waktu dialokasikan ke fitur |
| 7 | **Tidak ada pagination di ekspor** | Ekspor dibatasi 5000 baris | Enough untuk skala sekolah; pesan jelas bila terlampaui |
| 8 | **Grafik tidak di-cache** | Query ulang saat filter berubah | Data kecil; filter harus mencerminkan kondisi terkini |
| 9 | **Tidak ada pencarian fuzzy/typo-tolerant** | Kekecekan pengguna minor | Implementasi `LIKE` sederhana, cukup untuk kata kunci Indonesia |
| 10 | **Judul Windows** — aplikasi.process | — | — |

---

## 6. Catatan Proses (jujur)

Tidak semua berjalan mulus. Selama pengerjaan ditemukan **16 masalah nyata** yang
seluruhnya tercatat di [`DEBUGGING.md`](DEBUGGING.md). Yang paling bernilai
s secara pembelajaran:

1. **Skema validasi ditulis tapi tidak dipasang** — Zod ada, tetapi middleware-nya
   belum dibuat, sehingga tidak ada yang tervalidasi. Tip assertions (`as Type`)
   hanya untuk compiler, bukan runtime.
2. **Baca data di dalam transaksi** — pemanggilan fungsi query yang memakai
   koneksi terpisah tidak melihat baris yang belum di-commit.
3. **Alias `@/` terdaftar dua kali** — di bundler *dan* di tsconfig. Salah satu
   saja akan membuat build/tsc bertentangan.
4. **Pengujian yang salah, bukan kodenya** — ISBN uji 15 digit ditolak;
   memang benar sistem menolak, jadi tesnya yang diperbaiki.

---

## 7. Rencana Pengembangan Lanjutan

### Prioritas Tinggi
| # | Rencana | Manfaat |
|---|---|---|
| 1 | Verifikasi email saat pendaftaran | Mencegah akun palsu |
| 2 | Recovery kata sandi via email | Mengurangi ketergantungan pada petugas |
| 3 | Laporan denda otomatis | Peringatan otomatis |
| 4 | Paginasi/filter tambahan pada ekspor | Eksporberjumlah besar |

### Prioritas Sedang
| # | Rencana |
|---|---|
| 5 | Scan barcode/ISBN dengan kamera untuk input buku |
| 6 | Notifikasi email pengingat jatuh tempo |
| 7 | Aplikasi Progressive Web App (PWA) agar bisa dipasang di ponsel |
| 8 | Level akses lanjutan (misalnya petugas dengan hak hanya baca) |

### Prioritas Rendah / Eksplorasi
| # | Rencana |
|---|---|
| 9 | Rekomendasi buku berdasarkan riwayat peminjaman |
| 10 | Dashboard per-kelas / per-tingkat |
| 11 | Audit trail dengan diff (perubahan sebelum/sesudah) |
| 12 | Uji beban (load test) dengan 100+ pengguna bersamaan |

---

## 8. Penilaian

| Aspek | Nilai | Catatan |
|---|:---:|---|
| Kesesuaian kebutuhan UKK | ★★★★★ | Semua fitur wajib ada dan berfungsi nyata |
| Kualitas kode | ★★★★☆ | Terpisah dengan rapi, type-safe, ada error handling |
| Keamanan | ★★★★☆ | bcrypt, JWT httpOnly, RBAC, rate limit, validasi berlapis |
| Kualitas database | ★★★★★ | Ternormalisasi, constraint, indeks, transaksi |
| Desain antarmuka | ★★★★★ | Sistem desain konsisten, animasi bermakna |
| Dokumentasi | ★★★★★ | 7 dokumen + catatan debugging nyata |
| Kematangan | ★★★★☆ |/build bersih, 53 uji otomatis, siap demo |

### Kesimpulan

Aplikasi **LUMEN** telah selesai dibangun dan **terverifikasi berjalan** terhadap
database MariaDB sungguhan. Seluruh fitur yang diminta — dan tidak ada fitur
penting yang hanya berupa tampilan — berfungsi dengan data nyata.

Semua klaim pada dokumen ini dapat diperiksa ulang dengan:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\api-test.ps1
```
