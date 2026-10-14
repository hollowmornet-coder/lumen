# Panduan Pengguna — LUMEN

Panduan praktis untuk petugas perpustakaan dan siswa.

---

## 1. Menjalankan Aplikasi

### Langkah 1 — Nyalakan Database
Buka **XAMPP Control Panel**, klik **Start** pada Apache dan MySQL.
Buka `http://localhost/phpmyadmin` dan pastikan database `lumen_db` sudah ada.

### Langkah 2 — Jalankan Backend
```bash
cd backend
npm run dev
```
Tunggu muncul:
```
Database connected: lumen_user@127.0.0.1:3307/lumen_db
LUMEN API berjalan di http://localhost:4000/api
```

### Langkah 3 — Jalankan Frontend
```bash
cd frontend
npm run dev
```
Buka **http://localhost:5173**

> **Catatan:** di Windows, PowerShell mungkin menolak menjalankan `npm` langsung.
> Gunakan `npm.cmd run dev` bila muncul error *execution policy*.

---

## 2. Masuk ke Aplikasi

| Peran | Alamat | Username | Kata sandi |
|---|---|---|---|
| Petugas | `/masuk` | `admin` | `Admin123!` |
| Siswa | `/masuk` | `andira` | `Siswa123!` |

- **Petugas** otomatis diarahkan ke dasbor `/admin`.
- **Siswa** otomatis diarahkan ke beranda `/perpustakaan`.
- Jika salah, pesan merah menjelaskan alasannya (salah sandi / akun nonaktif).

---

# BAGIAN A — Panduan Petugas

## A1. Beranda (Dasbor)

Gambar pertama saat masuk. Isinya:

| Bagian | Kegunaan |
|---|---|
| **Judul Koleksi** | Jumlah judul & total eksemplar |
| **Eksemplar Tersedia** | Eksemplar yang bisa dipinjam *(hijau)* |
| **Sedang Dipinjam** | Eksemplar di luar *(ungu)* |
| **Anggota Aktif** | Siswa yang akunnya aktif |
| **Menunggu Persetujuan** | Permohonan yang perlu Anda tinjau |
| **Pengembalian Masuk** | Buku yang sudah dikembalikan siswa |
| **Peminjaman Terlambat** | Lewat jatuh tempo *(merah)* |

Di bawahnya:
- **Tren Transaksi** — garis peminjaman vs pengembalian.
- **Distribusi Kategori** — jumlah judul per kategori.
- **Status Transaksi** — komposisi status.
- **Buku Paling Sering Dipinjam** — peringkat ketert OMBU.
- **Anggota Teraktif** — 6 anggota teratas.
- **Transaksi Terbaru** — 6 transaksi terakhir.

### Mengubah periode laporan
Di bagian atas halaman ada dua kolom tanggal (**Dari** dan **Sampai**) dan
tombol **Harian / Mingguan / Bulanan**.
Semua grafik ikut berubah sesuai rentang tersebut. Untuk kembali ke default,
kosongkan kedua kolom lalu tekan **Perbarui**.

---

## A2. Menu Transaksi

Menu utama untukYFURUS peminjaman. Buka **Transaksi** di sidebar.

### Kolom tabel
Kode Transaksi · Judul Buku · Anggota · Status · Jatuh Tempo · Aksi

### Menyetujui Permohonan
1. Filter **Status** = `Menunggu` agar hanya ada yang perlu ditinjau.
2. Klik **Setujui** pada baris yang sesuai.
3. Konfirmasi → sistem langsung **mencadangkan satu eksemplar** (angka "Tersedia" berkurang 1).
4. Klik **Serahkan** ketika buku benar-benar diberikan ke siswa.
   Status berubah dari `Disetujui` → `Dipinjam` dan tanggal jatuh tempo dihitung.

> **Perhatikan:** buku tidak bisa langsung berstatus *Selesai* dari *Disetujui*.
> Harus ada tahap *Serahkan* terlebih dahulu.

### Menolak Permohonan
1. Klik **Tolak**.
2. Tulis alasan (minimal 3 karakter) — alasannya akan dilihat siswa.
3. Konfirmasi.

### Menerima Pengembalian
1. Temukan baris berstatus `Dipinjam` atau `Minta Kembali`.
2. Klik **Terima Kembali**.
3. Pilih kondisi buku:
   - `Baik` — buku utuh.
   - `Rusak` — ada kerusakan. **Wajib** mengisi catatan.
   - `Hilang` — buku tidak ditemukan. **Wajib** mengisi catatan.
4. Konfirmasi. Stok bertambah dan sistem mencatat jumlah hari keterlambatan.

### Membatalkan Transaksi
- Siswa dapat membatalkan selama status masih `Menunggu` atau `Disetujui`.
- Jika status sudah `Disetujui`, eksemplar otomatis dikembalikan ke rak.

---

## A3. Kelola Buku

### Menambah buku
1. **Kelola Buku** → **Tambah Buku**.
2. Isi ISBN, Judul, Penulis (wajib), dan seterusnya.
3. Unggah cover bila tersedia (PNG/JPG/WEBP, maks 3 MB).
4. **Simpan**.

**Aturan ISBN:** 10 atau 13 digit, boleh memakai tanda hubung.
Contoh benar: `978-602-03-0001-1` · `6020300001`
Contoh salah: `12345` (terlalu pendek) · `978-602-99-123456-1` (15 digit)

### Mengubah / menonaktifkan
- **Edit** untuk mengubah data.
- **Nonaktifkan** menyembunyikan buku dari katalog siswa tanpa menghapus riwayat.
  Buku yang sedang dipinjam **tidak dapat** dinonaktifkan.
- **Hapus**: jika buku pernah dipinjam, sistem akan menonaktifkannya saja dan
  memberi tahu Anda. Demi menjaga keutuhan laporan.

### Ekspor
Klik **Ekspor Excel** — file `.xlsx` terunduh dengan filter yang sedang aktif.

---

## A4. Kelola Anggota

### Menambah anggota
1. **Kelola Anggota** → **Tambah Anggota**.
2. Isi data. **Kata sandi boleh dikosongkan**.
3. Bila dikosongkan, sistem membuat kata sandi sementara dan menampilkannya
   satu kali — catat atau salin sebelum menutup dialog.

### Kode anggota
Dibuat otomatis, misal `MBR-2026-004`. Siswa tidak dapat memilih sendiri.

### Mengubah status
- **Nonaktifkan** ditolak bila anggota masih punya peminjaman aktif.
  Selesaikan pengembalian lebih dahulu.
- Akun **Petugas** tidak dapat diubah dari halaman ini.

### Mengatur ulang kata sandi
Klik ikon kunci → masukkan kata sandi baru (min. 8 karakter, ada huruf dan angka).

---

## A5. Laporan (Export Excel)

| Tombol | Isi |
|---|---|
| **Buku** | ISBN, judul, penulis, penerbit, stok, lokasi rak |
| **Anggota** | Kode, nama, kelas, jumlah peminjaman |
| **Transaksi** | Seluruh riwayat + tardenda + ringkasan |
| **Template Impor** | Berkas `.xlsx` ber-header untuk impor buku |

### Cara mengimpor buku
1. **Unduh Template Impor**.
2. Isi mengikuti kolom:
   `ISBN | Judul | Penulis | Penerbit | Tahun Terbit | Kategori | Lokasi Rak | Jumlah Eksemplar | Deskripsi`
3. Simpan sebagai `.xlsx`.
4. Di **Kelola Buku** → **Impor Excel** → pilih berkas.
5. Klik **Validasi** terlebih dahulu. Sistem menampilkan:
   jumlah baris, yang valid, yang bermasalah, dan daftar kesalahan per baris.
6. Perbaiki di Excel bila perlu, lalu klik **Impor**.

> Baris bermasalah **tidak** disimpan. Proses bersifat all-or-nothing: bila
> terjadi kegagalan di level database, seluruh impor dibatalkan.

**Proteksi formula:** bila ada teks diawali `=` `+` `-` `@`, sistem akan
menambah tanda kutip otomatis agar tidak dieksekusi saat file dibuka.

---

## A6. Aktivitas

Menampilkan jejak audit: siapa, melakukan apa, dan kapan._sync otomatis
setiap 30 detik. Dapat dicari berdasarkan nama maupun kode aksi.

---

## A7. Pengaturan

Aturan operasional, **berlaku langsung** setelah disimpan:

| Pengaturan | Arti | Default |
|---|---|---|
| Maksimal buku dipinjam | Kuota per siswa | 3 |
| Masa pinjam (hari) | Dihitung sejak buku diserahkan | 7 |
| Perlu persetujuan | 1 = tunggu petugas, 0 = langsung aktif | 1 |
| Izinkan pengembalian mandiri | Siswa bisa minta Returning | 1 |
| Denda per hari (Rp) | Dihitung dari hari keterlambatan | 1000 |

---

# BAGIAN B — Panduan Siswa

## B1. Daftar Akun

1. Klik **Daftar sebagai siswa** di halaman masuk.
2. Isi nama, username, email, kelas (opsional), telepon (opsional).
3. Buat kata sandi: **minimal 8 karakter** dan **harus ada huruf + angka**.
4. Setelah berhasil Anda akan menerima **Kode Anggota** — catat nomor ini.
5. Anda langsung masuk ke beranda.

> Akun petugas tidak dapat dibuat lewat form ini. Hubungi pustakawan.

---

## B2. Mencari Buku

1. Menu **Katalog**.
2. Gunakan kolom pencarian (judul, penulis, atau ISBN).
3. Saring dengan:
   - **Kategori** — fiksi, sains, dsb.
   - **Status** — tersedia / stok habis.
   - **Urutkan** — judul, penulis, tahun, stok.
4. Beralih antara tampilan **kisi** dan **daftar** dengan tombol di kanan atas.
5. Filter aktif ditampilkan sebagai *chip* dan bisa dihapus satu per satu.

> Semua pencarian dan filter berjalan di server, sehingga tetap akurat
> meski jumlah buku sangat banyak.

---

## B3. Meminjam Buku

1. Buka katalog → klik buku.
2. Periksa jumlah eksemplar tersedia.
3. Klik **Ajukan Peminjaman**.
4. Tulis catatan bila perlu (opsional).
5. **Kirim**.

Status yang mungkin muncul:

| Status | Artinya |
|---|---|
| **Menunggu** | Permohonan sedang ditinjau petugas |
| **Disetujui** | Sudah disetujui, ambil di loket dengan kartu/kode |
| **Sudah tidak bisa** | Bread |

Tombol otomatis berubah menjadi teks informative bila:
- stok habis, atau
- kuota Anda sudah penuh, atau
- buku ini sudah ada di daftar pinjaman Anda.

---

## B4. Mengembalikan Buku

1. Menu **Pinjaman Saya**.
2. Cari buku yang dikembalikan.
3. Klik **Ajukan Pengembalian**.
4. Serahkan buku ke petugas.
5. Petugas memverifikasi → buku masuk lagi ke rak.

Jika buku tidak bisa di-_self_-service (karena pengaturan), tombol tersebut
tidak muncul dan Anda diminta menyerahkan buku langsung ke loket.

> Pengembalian **tidak** menambah stok sampai petugas memverifikasi. Ini
> mencegah stok bertambah padahal buku belum kembali.

---

## B5. Riwayat Peminjaman

Menu **Riwayat** menampilkan semua buku yang pernah dipinjam beserta tanggal
peminjaman, pengembalian, dan keterangan keterlambatan (bila ada).

---

## B6. Mengubah Profil

Menu **Profil**:
- **Ubah profil** — nama, kelas, nomor telepon.
- **Ubah kata sandi** — butuh kata sandi lama.

> Username, email, dan jenis akun tidak dapat diubah sendiri. Hubungi petugas.

---

## 3. Daftar Pertanyaan Umum

**Mengapa tombol "Ajukan Peminjaman" tidak bisa diklik?**
Baca alasan yang tampil di bawah tombol. Biasanya: stok habis, kuota penuh,
atau buku sudah dipinjam oleh Anda.

**Kenapa saya tidak bisa masuk dengan akun sekolah saya?**
Akun harus dibuat lebih dulu lewat Petugas, atau daftar sendiri di halaman
pendaftaran.

**Lupa kata sandi?**
Hubungi Petugas — mereka bisa mengatur ulang dari menu **Kelola Anggota**.

**Buku saya terlambat, bagaimana?**
Segera kembalikan. Biaya denda tertera otomatis di riwayat.

**Kenapa buku tidak muncul di katalog?**
Buku sedang dinonaktifkan petugas, atau terfilter oleh pencarian Anda.
Coba kosongkan kolom pencarian dan klik "Atur ulang semua".

**Halaman tidak bisa dibuka / 403?**
Menu tersebut khusus Petugas. Kembali ke beranda.

---

## 4. Tips Presentasi UKK

1. Jalankan database → backend → frontend sebelum presentasi.
2. Siapkan **dua jendela browser**: satu login admin, satu login siswa.
3. Tunjukkan alur nyata: siswa mengajukan → admin menyetujui → admin
   menyerahkan → siswa mengajukan pengembalian → admin memverifikasi.
4. Tunjukkan perubahan angka stok pada katalog setelah setiap langkah.
5. Tunjukkan halaman Laporan → unduh Excel, lalu **Impor Excel** dengan
  .template. Tunjukkan validasi yang mendeteksi baris bermasalah.
6. Tunakan menu **Aktivitas** sebagai bukti setiap langkah tercatat.

> Jalankan `scripts\api-test.ps1` sebelum presentasi untuk memastikan sistem
> dalam kondisi baik.
