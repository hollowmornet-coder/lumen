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

Menu utama untuk peminjaman. Buka **Transaksi** di sidebar.

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

### Menyetujui Banyak Permohonan Sekaligus
Saat filter status `Menunggu`, setiap baris punya kotak centang dan muncul bilah
**Setujui N terpilih** di atas tabel.

1. Centang permohonan yang ingin disetujui (atau centang semua di halaman ini).
2. Klik **Setujui N terpilih** → konfirmasi.

Setiap permohonan diproses dalam transaksinya sendiri. Bila satu gagal (misalnya
stok buku itu sudah habis karena permohonan lain disetujui lebih dulu), yang lain
tetap berhasil dan alasannya ditampilkan per baris. Bilah seleksi otomatis kosong
ketika filter atau halaman diubah, agar tidak ada centang "hantu".

### Menolak Permohonan
1. Klik **Tolak**.
2. Tulis alasan (minimal 3 karakter) — alasannya akan dilihat siswa.
3. Konfirmasi.

### Menerima Pengembalian
1. Temukan baris berstatus `Dipinjam` atau `Minta Kembali`.
2. Klik **Terima Kembali**.
3. Pilih kondisi buku:
   - `Baik` — buku utuh, kembali ke rak.
   - `Rusak` — ada kerusakan. **Wajib** mengisi catatan.
   - `Hilang` — buku tidak ditemukan. **Wajib** mengisi catatan.
4. Dialog menampilkan **perkiraan denda** beserta rinciannya (keterlambatan × tarif,
   biaya rusak, biaya hilang). Angka final dihitung server saat disimpan.
5. Konfirmasi.

**Dampak tiap kondisi pada stok:**

| Kondisi | Tersedia | Rusak | Total | Denda |
|---|---|---|---|---|
| Baik | +1 | — | — | hanya keterlambatan |
| Rusak | — | +1 | — | biaya rusak + keterlambatan |
| Hilang | — | — | −1 | biaya hilang + keterlambatan |

Buku rusak tetap tercatat sebagai milik perpustakaan tetapi tidak bisa dipinjam
sampai diperbaiki. Buku hilang mengurangi total inventaris.

### Membatalkan Transaksi
- Siswa dapat membatalkan selama status masih `Menunggu` atau `Disetujui`.
- Jika status sudah `Disetujui`, eksemplar otomatis dikembalikan ke rak.

### Memperpanjang Pinjaman
1. Cari baris berstatus `Dipinjam`.
2. Klik **Perpanjang**.
3. Jatuh tempo mundur sebanyak `loan_duration_days`.

Perpanjangan **ditolak** bila buku sudah terlambat, atau bila jumlah perpanjangan
sudah mencapai `max_renewals`.

### Menangani Buku yang Tidak Diambil
Bila siswa tidak mengambil buku dalam `pickup_window_days` sejak disetujui, status
baris berubah menjadi **Lewat batas ambil** (ungu). Buku masih disisihkan untuknya,
tetapi Anda dapat:
- **Lepas** — stok kembali ke rak dan kesempatan berpindah ke antrean berikutnya,
  atau
- biarkan, bila Anda tahu siswa akan segera datang.

Filter **Status** = `Lewat batas ambil` menampilkan semua kasus ini sekaligus.

---

## A2b. Meja Sirkulasi (Peminjaman Langsung)

Untuk siswa yang datang langsung ke perpustakaan tanpa mengajukan permohonan.
Buka **Meja Sirkulasi** di sidebar.

1. **Cari anggota** — ketik nama, kode anggota, atau username. Kartu anggota muncul
   dengan jumlah pinjaman aktif dan sisa kuota.
2. **Cari buku** — ketik judul, penulis, atau ISBN. Buku tanpa stok tidak dapat
   dipilih.
3. **Konfirmasi** — jumlah hari sudah terisi dari pengaturan; ubah bila perlu.
   Ringkasan menampilkan jatuh tempo dan tarif denda harian.

Bila kuota anggota penuh atau ia masih punya denda belum lunas, tombol simpan
dinonaktifkan dan alasannya ditampilkan.

### Memakai pemindai (barcode/QR)

Di bagian atas halaman ada panel **Pindai kartu atau barcode**. Kolomnya sudah
siap menerima pindaian:

| Yang dipindai | Hasil |
|---|---|
| Kartu anggota (`MBR-…`) | Langkah 1 terisi otomatis |
| Barcode ISBN buku | Langkah 2 terisi otomatis |
| Nota pinjaman (`LN-…`) | Pesan menunjuk ke menu **Transaksi** |

1. Klik kolom pindai sekali (setelah itu kolom tetap fokus).
2. Arahkan pemindai ke kode dan tembakkan.
3. Pemindai mengetik kode lalu menekan Enter sendiri; data langsung muncul.

Tidak perlu memilih "mode anggota" atau "mode buku" lebih dulu — server yang
menentukan jenis kodenya. Bila pemindai tidak tersedia, ketik kode dan tekan
**Enter**; hasilnya sama.

Setelah kartu anggota terpindai, panel menampilkan **foto profil** dan **level**
anggota tersebut. Foto berguna untuk memastikan kartu yang dipindai memang milik
orang yang berdiri di depan meja.

> Kode yang tidak dikenali menampilkan pesan dan kolom otomatis dikosongkan,
> siap untuk pindaian berikutnya. Data yang sudah terisi tidak ikut terhapus.

### Mencetak kartu anggota

Di menu **Kelola Anggota**, klik ikon kartu pada baris anggota → dialog **Kartu
Anggota** menampilkan kode QR berisi kode anggota. Gunakan **Salin kode** untuk
menempelkannya ke label, atau cetak halamannya.

> Kode QR hanya memuat kode anggota, bukan nama, kelas, atau kata sandi. Orang
> yang memotretnya tidak mendapatkan data pribadi apa pun.

> Perbedaan dengan menu **Transaksi**: di sini buku langsung berstatus `Dipinjam`
> dan stok berkurang saat itu juga — tidak ada tahap menunggu atau menyerahkan.

---

## A2c. Denda

Buka **Denda** di sidebar. Halaman ini adalah buku kas denda.

**Ringkasan di atas** menampilkan total belum lunas, sudah diterima, dan dibebaskan.

**Filter:** status (`Belum lunas` / `Lunas` / `Dibebaskan`), jenis
(`Keterlambatan` / `Kerusakan` / `Kehilangan`), dan pencarian nama anggota.

**Melunasi:**
1. Klik **Lunasi** pada baris yang dibayar.
2. Isi catatan bila perlu (mis. "tunai di loket").
3. Konfirmasi. Status menjadi `Lunas` dan nominal masuk kas.

**Membebaskan:** sama, tetapi memakai tombol **Bebaskan**. Status menjadi
`Dibebaskan`, tidak dihitung sebagai kas masuk. Gunakan untuk kebijakan keringanan,
bukan untuk "menghapus" denda yang sebenarnya dibayar.

> Denda tidak pernah dihapus. Yang berubah hanya statusnya, sehingga laporan tetap
> dapat diaudit.

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

### Foto & level anggota
Tabel anggota menampilkan **foto profil** (atau inisial bila belum ada) dan
**badge level** hasil hitungan peminjaman. Kolom **Level** berguna untuk melihat
sekilas siapa yang paling aktif membaca.

Level dihitung dari jumlah buku yang benar-benar diserahkan (`borrowed_at`
terisi), bukan dari jumlah pengajuan. Karena itu ia tidak bisa diubah manual —
angka itu mengikuti riwayat transaksi.

### Mengubah status
- **Nonaktifkan** ditolak bila anggota masih punya peminjaman aktif.
  Selesaikan pengembalian lebih dahulu.
- Akun **Petugas** tidak dapat diubah dari halaman ini.

### Mengatur ulang kata sandi
Klik ikon kunci → masukkan kata sandi baru (min. 8 karakter, ada huruf dan angka).

### Impor anggota dari Excel
Untuk memasukkan satu kelas sekaligus:

1. **Kelola Anggota** → **Template** → unduh `template-anggota.xlsx`.
2. Isi kolom: `Nama Lengkap | Username | Email | Kelas | Telepon | Alamat`.
3. **Impor Excel** → pilih berkas → **Periksa dulu**.
   Sistem menampilkan jumlah baris valid, duplikat, dan kesalahan per baris.
   Pada tahap ini **belum ada yang disimpan**.
4. Bila sudah benar, klik **Simpan**.

Setelah tersimpan, layar menampilkan **satu kata sandi batch** untuk seluruh
berkas. Salin dan bagikan sebelum menutup dialog — kata sandi ini **hanya muncul
sekali**. Setiap anggota yang masuk dengan kata sandi itu akan langsung diminta
membuat kata sandi sendiri sebelum dapat memakai aplikasi.

> Siswa yang username atau email-nya sudah terdaftar dilewati dan dilaporkan
> per baris, bukan membatalkan seluruh berkas.

---

## A5. Laporan (Export Excel)

| Tombol | Isi |
|---|---|
| **Buku** | ISBN, judul, penulis, penerbit, stok, lokasi rak |
| **Anggota** | Kode, nama, kelas, jumlah peminjaman |
| **Transaksi** | Seluruh riwayat + tardenda + ringkasan |
| **Denda** | Buku kas denda mengikuti filter periode di halaman Denda |
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

Menampilkan jejak audit: siapa, melakukan apa, dan kapan. Tersinkron otomatis
setiap 30 detik. Dapat dicari berdasarkan nama maupun kode aksi.

---

## A7. Pengaturan

Aturan operasional, **berlaku langsung** setelah disimpan:

| Pengaturan | Arti | Default |
|---|---|---|
| Maksimal buku dipinjam | Kuota per siswa | 3 |
| Masa pinjam (hari) | Dihitung sejak buku diserahkan | 7 |
| Perlu persetujuan | 1 = tunggu petugas, 0 = langsung aktif | 1 |
| Izinkan pengembalian mandiri | Siswa bisa minta pengembalian | 1 |
| Denda per hari (Rp) | Dihitung dari hari keterlambatan | 1000 |
| Batas perpanjangan | Berapa kali satu pinjaman boleh diperpanjang (0 = mati) | 1 |
| Batas waktu pengambilan | Hari sebelum jatah buku dilepas | 2 |
| Blokir peminjaman karena denda | Denda belum lunas menghalangi pinjaman baru | aktif |
| Biaya buku rusak (Rp) | Denda tetap saat buku kembali rusak | 5000 |
| Biaya buku hilang (Rp) | Denda tetap saat buku dinyatakan hilang | 50000 |
| Masa sisih buku antrean | Lama buku ditahan untuk pemesan | 2 |
| Geser jatuh tempo saat libur | Jatuh tempo tidak jatuh di hari libur/Minggu | aktif |
| Batas antrean per anggota | Berapa judul boleh diantre sekaligus | 3 |
| Ulasan wajib pernah meminjam | Hanya pembaca nyata yang boleh menilai | aktif |
| Catat kunjungan | Pencatatan kehadiran perpustakaan | aktif |

> Mengubah pengaturan **tidak** mengubah data yang sudah tercatat. Denda yang sudah
> dibuat tetap sebesar saat kejadian, dan tenggat pengambilan yang sudah melekat
> pada transaksi lama tidak ikut bergeser.

### Cadangan & Pemulihan Basis Data

Di bagian bawah halaman Pengaturan ada panel **Cadangan Basis Data**.

**Mengunduh:** klik **Unduh cadangan** untuk mendapatkan satu berkas `.sql` berisi
skema dan seluruh isi tabel. Simpan berkas itu di luar server (flashdisk, Drive,
atau komputer lain).

**Memulihkan:** pilih berkas `.sql` cadangan, lalu ketik **`PULIHKAN`** pada kolom
konfirmasi. Tombol baru aktif setelah kata itu diketik tepat.

Tiga hal yang perlu diketahui sebelum memulihkan:

1. **Seluruh data saat ini diganti** isi berkas cadangan. Tidak ada pembatalan.
2. Berkas yang bukan cadangan LUMEN ditolak sebelum satu tabel pun disentuh.
3. Semua pengguna perlu **masuk ulang** setelah pemulihan, karena data pengguna
   sudah diganti.

> Proses berjalan di server dan bisa memakan waktu pada basis data besar. Jangan
> menutup halaman sebelum selesai.

---

## A8. Laporan Tambahan

Di halaman **Laporan**, di bawah grafik, ada tiga bagian baru:

**Buku Tidak Pernah Dipinjam** — koleksi yang belum pernah keluar dari rak. Berguna
untuk memilih buku yang perlu dipromosikan, atau mempertimbangkan penyiangan.

**Ringkasan Denda** — total ditagihkan, sudah diterima, belum lunas, dan dibebaskan,
beserta rincian per jenis. Dihitung untuk seluruh periode, bukan hanya rentang
tanggal yang dipilih.

**Anggota Paling Sering Terlambat** — diurutkan dari jumlah transaksi terlambat,
lengkap dengan total hari dan denda yang belum lunas. Dasar pembinaan: siapa yang
perlu diingatkan lebih dulu.

---

## A9. Hari Libur

**Hari Libur** menyimpan kalender tanggal merah sekolah. Kalender ini dipakai saat
menghitung jatuh tempo: bila tenggat jatuh pada hari libur **atau hari Minggu**,
tenggat digeser ke hari kerja berikutnya. Tanpa kalender ini, buku yang jatuh tempo
saat libur dihitung terlambat padahal siswa tidak punya kesempatan mengembalikannya.

- Tambah: pilih tanggal, isi nama libur, **Simpan**.
- Hapus: klik ikon tempat sampah pada baris tanggal.
- Tanggal yang sama tidak dapat dimasukkan dua kali.

> Sabtu **tidak** otomatis digeser. Bila perpustakaan tutup Sabtu, tambahkan Sabtu
> sebagai hari libur.

---

## A10. Kunjungan

**Kunjungan** mencatat siapa yang datang ke perpustakaan hari ini.

- **Pindai kartu** atau pilih anggota → **Catat kunjungan**.
- Tamu tanpa akun: isi nama pada kolom tamu.
- Memindai kartu yang sama dua kali di hari yang sama **bukan error** — sistem
  menjawab "sudah tercatat berkunjung hari ini".

Ringkasan di atas tabel menampilkan jumlah kunjungan hari ini, bulan ini, dan
sebaran tujuan kunjungan.

---

## A11. Stok Opname

Dipakai saat menghitung ulang koleksi di rak (misalnya akhir semester).

1. Pilih buku → isi **jumlah fisik** yang benar-benar ada di rak → **Simpan hitungan**.
2. Sistem menampilkan `expected` (menurut catatan) dan `selisih`. **Stok belum berubah.**
3. Setelah yakin, klik **Terapkan** untuk menyesuaikan stok.

Eksemplar yang sedang dipinjam **tidak** ikut dihitung dan tidak dianggap hilang.
Sesi yang sudah diterapkan tidak dapat diterapkan ulang.

---

## A12. Pengumuman

**Pengumuman** menerbitkan informasi ke beranda pengguna.

| Audiens | Siapa yang melihat |
|---|---|
| Semua | Petugas dan siswa |
| Siswa | Hanya siswa |
| Petugas | Hanya petugas (catatan internal) |

- **Sematkan** membuat pengumuman tampil paling atas.
- Isi **Berlaku sampai** bila pengumuman hanya relevan sementara; setelah tanggal
  itu ia berhenti tampil tanpa perlu dihapus.

---

## A13. Daftar Keinginan (laporan)

Di halaman ini petugas melihat judul yang paling banyak disimpan anggota ke daftar
keinginan mereka. Berguna sebagai daftar belanja pengadaan: judul yang banyak
diinginkan tetapi persediaannya sedikit adalah kandidat pembelian berikutnya.

> Daftar keinginan **tidak memesan stok**. Ia hanya penanda minat.

---

# BAGIAN B — Panduan Siswa

## B0. Lupa Kata Sandi

1. Di halaman masuk, klik **Lupa kata sandi?**
2. Masukkan username, email, **atau** kode anggota Anda.
3. Sistem menampilkan **token reset** — salin dengan tombol **Salin**.
   Token berlaku 30 menit dan hanya bisa dipakai sekali.
4. Isi token tersebut, lalu tentukan kata sandi baru.
5. Masuk kembali dengan kata sandi baru.

> Token ditampilkan di layar karena sekolah ini belum memakai email otomatis.
> Jangan bagikan token kepada siapa pun — siapa yang memegangnya dapat mengganti
> kata sandi Anda.

Bila token sudah kedaluwarsa atau terlanjur terpakai, ulangi dari langkah 1 untuk
membuat token baru. Token lama otomatis batal.

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
| **Dipinjam** | Buku ada di tangan Anda |
| **Lewat batas ambil** | Tenggat pengambilan terlewat — hubungi petugas |
| **Terlambat** | Sudah melewati jatuh tempo |
| **Selesai** | Buku sudah dikembalikan |

Bila stok habis, tombol berubah menjadi **Antre buku**. Lihat bagian B3b.

Tombol otomatis berubah menjadi teks informatif bila:
- stok habis, atau
- kuota Anda sudah penuh, atau
- buku ini sudah ada di daftar pinjaman Anda.

> Bila Anda masih punya denda belum lunas, peminjaman baru diblokir. Selesaikan
> denda di meja petugas terlebih dahulu.

## B3b. Mengantre Buku yang Habis

1. Buka detail buku yang stoknya habis.
2. Klik **Antre buku**.
3. Tulis catatan bila perlu (opsional).
4. Kirim. Anda masuk ke daftar tunggu.

Lihat posisi Anda di menu **Antrean Saya**:

| Status | Artinya |
|---|---|
| **Menunggu** | Masih antre; nomor urut ditampilkan |
| **Siap diambil** | Buku sudah disisihkan untuk Anda — segera ambil! |
| **Selesai** | Sudah dipinjamkan |
| **Kedaluwarsa** | Tenggat terlewat, kesempatan pindah ke orang berikutnya |
| **Dibatalkan** | Anda membatalkannya sendiri |

Saat buku tersedia, Anda menerima **notifikasi** di lonceng aplikasi. Buku ditahan
selama `reservation_hold_days` hari (default 2) sebelum kesempatan berpindah.

Batalkan antrean kapan saja lewat **Antrean Saya** → **Batalkan**. Orang di
belakang Anda otomatis naik satu posisi.

## B3c. Memperpanjang Pinjaman

1. Menu **Pinjaman Saya**.
2. Cari buku berstatus **Dipinjam**.
3. Klik **Perpanjang**.

Jatuh tempo mundur sebanyak masa pinjam. Tombol tidak muncul bila:
- buku sudah terlambat, atau
- Anda sudah memakai semua jatah perpanjangan.

## B3d. Denda Saya

Menu **Denda Saya** menampilkan tagihan dan riwayat pelunasan Anda.

| Bagian | Isi |
|---|---|
| **Belum lunas** | Tagihan yang masih harus dibayar |
| **Sudah selesai** | Yang sudah dilunasi atau dibebaskan |

Halaman ini **hanya untuk dilihat**. Pembayaran dilakukan di meja petugas, dan
statusnya berubah setelah petugas mencatatnya. Tidak ada tombol bayar di aplikasi
karena uang tunai tidak bisa diverifikasi dari browser.

---

## B3e. Menilai Buku (Ulasan)

Di halaman detail buku, di bagian bawah, ada **ulasan pembaca**:

- Rata-rata bintang dan sebaran penilaian tampil di atas daftar ulasan.
- Bila Anda **pernah meminjam** buku itu, formulir ulasan tersedia.
- Pilih 1–5 bintang, tulis komentar (boleh kosong), lalu **Kirim ulasan**.
- Ingin berubah pikiran? Kirim lagi — ulasan Anda **diperbarui**, bukan ditambah.
  Satu orang hanya punya satu pendapat per buku.
- Tombol hapus tersedia pada ulasan Anda sendiri.

> Petugas dapat mengatur apakah ulasan hanya boleh datang dari anggota yang pernah
> meminjam. Bila formulir tidak muncul padahal Anda sudah membaca buku itu di
> tempat, tanyakan ke petugas.

---

## B3f. Daftar Keinginan

Tombol **hati** di halaman detail buku menyimpan judul ke **Daftar Keinginan**
(menu di sidebar). Klik lagi untuk menghapus.

**Ini bukan antrean.** Daftar keinginan tidak memesan stok dan tidak memberi posisi
apa pun — ia hanya penanda "ingin dibaca nanti". Bila Anda membutuhkan buku yang
stoknya habis sekarang, gunakan tombol **Antre buku** (bagian B3b).

Petugas memakai daftar ini sebagai laporan: judul yang paling banyak diinginkan
menjadi kandidat pembelian berikutnya.

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

## B5b. Notifikasi

Lonceng di kanan atas menampilkan jumlah notifikasi yang belum dibaca.

| Jenis | Kapan muncul |
|---|---|
| Persetujuan | Peminjaman Anda disetujui atau buku sudah diserahkan |
| Jatuh tempo | Dua hari sebelum tenggat, dan saat sudah terlambat |
| Denda baru | Denda dicatat saat buku dikembalikan |
| Antrean siap | Buku pesanan Anda sudah tersedia |

Klik lonceng untuk membuka daftar. Klik satu notifikasi untuk membuka halaman
terkait, atau **Tandai semua dibaca** untuk membersihkan penanda.

> Pengingat jatuh tempo muncul saat Anda membuka aplikasi, bukan dikirim lewat
> SMS/email. Karena itu, biasakan memeriksa menu **Pinjaman Saya** secara berkala.

---

## B5c. Pengumuman

Di beranda ada bagian **Pengumuman** berisi kabar dari petugas: jam layanan
berubah, penutupan sementara, lomba membaca, dan sebagainya. Pengumuman yang
disematkan tampil paling atas. Bila tidak ada kabar, bagian ini tidak ditampilkan
sama sekali.

---

## B5d. Wajib Ganti Kata Sandi

Akun yang dibuatkan petugas lewat impor Excel memakai **satu kata sandi sementara**
untuk seluruh kelas. Karena itu, saat pertama kali masuk, aplikasi menampilkan
layar **Ganti kata sandi** yang tidak dapat ditutup.

- Masukkan kata sandi sementara (dari petugas), lalu kata sandi baru Anda.
- Setelah tersimpan, aplikasi dapat dipakai seperti biasa.
- Bila kata sandi sementara hilang, minta petugas mengatur ulang.

---

## B6. Mengubah Profil

Menu **Profil**:
- **Foto profil** — unggah, ganti, atau hapus (lihat di bawah).
- **Tingkatan anggota** — level dan kemajuan Anda.
- **Ubah profil** — nama, kelas, nomor telepon.
- **Ubah kata sandi** — butuh kata sandi lama.

> Username, email, dan jenis akun tidak dapat diubah sendiri. Hubungi petugas.

### Foto profil

Di bagian paling atas halaman Profil ada kotak **Foto Profil**.

1. Klik **Pilih Foto**, atau tarik berkas langsung ke kotak tersebut.
2. Foto langsung diunggah dan disimpan di server perpustakaan.
3. Untuk mengganti, ulangi langkah di atas — foto lama otomatis dihapus.
4. Untuk kembali ke inisial nama, klik **Hapus**.

| Aturan | Nilai |
|---|---|
| Format | JPG, PNG, WEBP, atau **GIF** |
| Ukuran maksimal | 5 MB |
| Nama berkas | Dibuat server (nama asli berkas Anda tidak dipakai) |

**GIF beranimasi didukung.** Berkas disimpan apa adanya tanpa diolah ulang,
jadi animasinya tetap berjalan di foto profil, header, dan daftar anggota.
GIF hanya diterima untuk foto profil — sampul buku tetap JPG/PNG/WEBP.

Foto Anda terlihat oleh petugas (misalnya saat memindai kartu di meja
sirkulasi) dan oleh Anda sendiri. Anggota lain hanya melihat nama dan level
Anda di papan peringkat, bukan foto.

### Tingkatan anggota (level)

Level menunjukkan seberapa sering Anda meminjam buku. Ia dihitung dari jumlah
buku yang **benar-benar** Anda pinjam — bukan dari jumlah klik atau pengajuan.

| Level | Nama | Syarat peminjaman |
|---|---|---|
| 1 | Pemula | 0 |
| 2 | Pembaca | 5 |
| 3 | Kutu Buku | 15 |
| 4 | Pustakawan Muda | 30 |
| 5 | Legenda Literasi | 60 |

- Kartu level menampilkan nama tingkatan, bilah kemajuan, dan sisa peminjaman
  menuju level berikutnya.
- **Peringkat** di kartu itu adalah posisi Anda di papan peringkat pembaca.
- Pengajuan yang ditolak atau dibatalkan **tidak** menambah hitungan; hanya
  buku yang benar-benar diserahkan petugas yang dihitung.
- Level tidak pernah "turun": riwayat peminjaman tidak dihapus.

Papan peringkat pembaca juga tampil di **Beranda** Anda, berisi anggota paling
aktif. Anggota yang belum pernah meminjam tidak ditampilkan di sana.

### Kartu anggota (QR)

Di bagian atas kartu profil ada **kode QR** berisi kode anggota Anda.

- Tunjukkan ke petugas di meja sirkulasi — mereka memindainya sehingga tidak
  perlu mengetik kode.
- Kode ini bukan kata sandi dan tidak dapat dipakai untuk masuk.
- Bila kartu hilang, minta petugas menampilkan ulang dari menu **Kelola
  Anggota**; kodenya tetap sama.

---

## 3. Daftar Pertanyaan Umum

**Mengapa tombol "Ajukan Peminjaman" tidak bisa diklik?**
Baca alasan yang tampil di bawah tombol. Biasanya: stok habis, kuota penuh,
masih ada denda belum lunas, atau buku sudah dipinjam oleh Anda.

**Kenapa saya tidak bisa masuk dengan akun sekolah saya?**
Akun harus dibuat lebih dulu lewat Petugas, atau daftar sendiri di halaman
pendaftaran.

**Lupa kata sandi?**
Klik **Lupa kata sandi?** di halaman masuk dan ikuti langkahnya — Anda bisa
membuat kata sandi baru sendiri. Bila tetap gagal, hubungi Petugas.

**Buku saya terlambat, bagaimana?**
Segera kembalikan. Denda dihitung per hari dan tercatat di menu **Denda Saya**.
Selama denda belum lunas, Anda tidak dapat meminjam buku baru.

**Stok habis, padahal saya butuh buku itu?**
Klik **Antre buku** di halaman detail. Anda akan diberi tahu lewat notifikasi
begitu buku tersedia.

**Sudah mengantre tapi statusnya "Kedaluwarsa"?**
Batas pengambilan terlewat, sehingga buku dialihkan ke antrean berikutnya.
Silakan mengantre lagi.

**Kenapa buku tidak muncul di katalog?**
Buku sedang dinonaktifkan petugas, atau terfilter oleh pencarian Anda.
Coba kosongkan kolom pencarian dan klik "Atur ulang semua".

**Halaman tidak bisa dibuka / 403?**
Menu tersebut khusus Petugas. Kembali ke beranda.

**Saya diminta ganti kata sandi terus, padahal baru ganti?**
Gerbang itu muncul karena akun Anda dibuat lewat impor Excel dan masih bertanda
`must_change_password`. Bila tetap muncul setelah mengganti, hubungi Petugas —
biasanya kata sandi baru gagal tersimpan (misalnya koneksi terputus).

**Buku yang saya pinjam rusak atau hilang, apa yang terjadi?**
Petugas mencatatnya saat pengembalian. Buku rusak menghasilkan denda `damaged_fee`,
buku hilang menghasilkan `lost_fee`, dan untuk buku hilang jumlah eksemplar
perpustakaan berkurang satu.

**Kenapa jatuh tempo saya bukan tepat 7 hari?**
Bila tanggal itu jatuh pada hari libur atau hari Minggu, sistem menggesernya ke
hari kerja berikutnya. Kalender libur dikelola Petugas di menu **Hari Libur**.

**Ulasan saya hilang?**
Ulasan bisa dihapus oleh Petugas bila dianggap tidak pantas, dan ikut terhapus
bila akun atau bukunya dihapus. Mengirim ulasan baru pada buku yang sama akan
**memperbarui** ulasan lama, bukan menambah baris baru.

---

## 4. Tips Presentasi UKK

1. Jalankan database → backend → frontend sebelum presentasi.
2. Siapkan **dua jendela browser**: satu login admin, satu login siswa.
3. Tunjukkan alur nyata: siswa mengajukan → admin menyetujui → admin
   menyerahkan → siswa mengajukan pengembalian → admin memverifikasi.
4. Tunjukkan perubahan angka stok pada katalog setelah setiap langkah.
5. Tunjukkan **Meja Sirkulasi**: pindai kartu anggota ber-QR, pindai barcode
   buku, lalu serahkan — dua pindaian tanpa mengetik satu huruf pun.
6. Tunjukkan **antrean**: habiskan stok satu judul, siswa mengantre, kembalikan
   buku, lalu tunjukkan notifikasi "siap diambil" muncul di akun siswa.
7. Tunjukkan **denda**: buat pengembalian terlambat, lihat rincian perkiraan denda
   di dialog, lalu lunasi di menu **Denda**.
8. Tunjukkan halaman Laporan → unduh Excel, lalu **Impor Excel** dengan
   template. Tunjukkan validasi yang mendeteksi baris bermasalah.
9. Tunjukkan menu **Aktivitas** sebagai bukti setiap langkah tercatat.
10. Tunjukkan **persetujuan massal**: dua siswa mengajukan, lalu centang keduanya
    dan setujui sekali klik.
11. Tunjukkan **Hari Libur**: tambahkan tanggal, lalu perlihatkan jatuh tempo baru
    yang otomatis melewati tanggal tersebut.
12. Tunjukkan **Ulasan** dari akun siswa yang pernah meminjam, dan **Daftar
    Keinginan** yang muncul sebagai laporan di sisi petugas.
13. Tutup dengan **Pengaturan** → ubah satu aturan → tunjukkan efeknya langsung,
    lalu **unduh cadangan basis data**.

> Jalankan `scripts\api-test.ps1` sebelum presentasi untuk memastikan sistem
> dalam kondisi baik. Skrip itu me-reset sebagian data uji, jadi impor ulang
> `database.sql` sesudahnya bila ingin demo dengan data bersih.
