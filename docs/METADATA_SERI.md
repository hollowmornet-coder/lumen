# Metadata Seri — LUMEN

Dokumen ini adalah bukti bibliografis untuk setiap metadata seri yang tersimpan
di database. **Tidak ada seri yang dibuat dari perkiraan.** Setiap baris
dipertahankan karena sumbernya diperiksa, bukan karena judulnya terlihat mirip.

Tanggal verifikasi: **14 Oktober 2026**.

---

## 1. Prinsip yang Diterapkan

| Prinsip | Kenapa |
|---|---|
| Satu sumber utama, beberapa sumber pendukung | Judul bisa berbeda ejaan antar penerbit |
| Kemiripan genre/karakter **tidak** cukup untuk mengelompokkan | Itu menebak, bukan memverifikasi |
| Seri tanpa judul di katalog tetap dicatat, dengan `book_id = NULL` | Itu status "belum ada di koleksi", bukan buku palsu |
| Sinkronis/plot tidak disalin ke antarmuka | Melindungi hak cipta; cukup dengan metadata bibliografi |
| Rujukan disimpan di database (`source_url`, `verified_at`) | Dapat diaudit kemudian |

---

## 2. Serial Bumi — Tere Liye

**Status:** terverifikasi · **Dimiliki perpustakaan:** 0 dari 17

### Rujukan
- **Wikipedia (EN), "Tere Liye (writer)", revisi 6 Juni 2024** — bibliografi
  "Parallel World Series" beserta tahun terbit. Sumber utama.
- **Goodreads, "Bumi Series by Tere Liye"** — konfirmasi urutan dan penomoran seri.
- **Gramedia, "Cara Baca Novel Serial Bumi"** — konfirmasi urutan baca dari sisi
  pembaca/penerbit Indonesia.

### Urutan terverifikasi

| # | Judul | Tahun | Sumber |
|---|---|---|---|
| 1 | Bumi | 2014 | Wikipedia |
| 2 | Bulan | 2015 | Wikipedia |
| 3 | Matahari | 2016 | Wikipedia |
| 4 | Bintang | 2017 | Wikipedia |
| 5 | Ceros dan Batozar | 2018 | Wikipedia |
| 6 | Komet | 2018 | Wikipedia |
| 7 | Komet Minor | 2019 | Wikipedia |
| 8 | Selena | 2020 | Wikipedia |
| 9 | Nebula | 2020 | Wikipedia |
| 10 | Si Putih | 2021 | Wikipedia |
| 11 | Lumpu | 2021 | Wikipedia |
| 12 | Matahari Minor | 2022 | Wikipedia |
| 13 | Bibi Gill | 2022 | Wikipedia |
| 14 | SagaraS | 2022 | Wikipedia |
| 15 | Ily | 2023 | Wikipedia |
| 16 | Aldebaran | 2024 | Wikipedia |
| 17 | Hana-Tara-Hata | 2025 | Wikipedia |

### Ketidakpastian yang dicatat

1. **Posisi 10 dan 11.** Daftar awal pada materi tugas menyebut *Lumpu* sebelum
   *Si Putih*. Wikipedia (dengan tahun terbit) menempatkan *Si Putih* (2021)
   di urutan 10 dan *Lumpu* (2021) di urutan 11. Karena keduanya terbit tahun
   sama, urutan di antara keduanya **tidak dapat dipastikan dari sumber yang
   diperiksa**, dan urutan Wikipedia yang dipakai. Perbedaan ini disimpan di
   sini, bukan diselesaikan dengan mengarang.

2. **Ejaan judul nomor 5.** Wikipedia menulis "Ceros dan **Bantozar**";
   Gramedia dan toko buku menulis "Ceros dan **Batozar**". Bentuk yang lebih
   lazim dipakai di sini. Varian ini tidak diubah menjadi judul baru.

3. **"Aldebaran"** ditulis Wikipedia sebagai "Aldebaran part 1" — indikasi
   bahwa masih ada lanjutan. Dicatat sebagai satu entri.

---

## 3. Serial Aksi — Tere Liye

**Status:** terverifikasi · **Dimiliki perpustakaan:** 0 dari 7

### Rujukan
- **bukukita.com (katalog penerbit/distributor)** — menyebut *Pulang-Pergi*
  sebagai "Buku ke-5 dari serial aksi Tere Liye. Setelah *Negeri Para Bedebah*,
  *Negeri Di Ujung Tanduk*, *Pulang*, dan *Pergi*." Sumber utama untuk
  pengelompokan dan penomoran.
- **kumparan.com (Januari 2025, merujuk Goodreads)** — konfirmasi urutan.
- **Gramedia, "Novel Berseri Tere Liye"** — konfirmasi bahwa *Pulang*,
  *Pergi*, dan *Pulang-Pergi* masuk satu kelompok.

### Urutan terverifikasi

| # | Judul | Tahun | Alur |
|---|---|---|---|
| 1 | Negeri Para Bedebah | 2012 | Bedebah (Thomas) |
| 2 | Negeri di Ujung Tanduk | 2013 | Bedebah (Thomas) |
| 3 | Pulang | 2015 | Pulang-Pergi (Bujang) |
| 4 | Pergi | 2018 | Pulang-Pergi (Bujang) |
| 5 | Pulang-Pergi | 2021 | **Crossover** |
| 6 | Bedebah di Ujung Tanduk | 2022 | Bedebah (Thomas) |
| 7 | Tanah Para Bandit | — | Bedebah |

### Mengapa tidak dipecah jadi dua seri?

Tugas secara eksplisit memperingatkan agar tidak menggabungkan
*Negeri Para Bedebah*, *Negeri di Ujung Tanduk*, *Bedebah di Ujung Tanduk*,
*Pulang*, *Pergi*, dan *Tanah Para Bandit* tanpa memeriksa strukturnya.

Hasil pemeriksaan: **sumber penerbit secara eksplisit menempatkan ketujuhnya
dalam satu "serial aksi" bernomor**, dengan *Pulang-Pergi* sebagai buku
kelima yang menyatukan tokoh Thomas dan Bujang. Jadi:

- Satu seri dengan `position` — sesuai sumber.
- **Hubungan antar-alur disimpan di kolom `note`**, bukan dipecah menjadi
  klasifikasi terpisah. Ini memenuhi permintaan "pertahankan struktur
  tersebut di UI; tampilkan hubungan terkait sebagai metadata".

Kalau nanti ditemukan sumber katalog resmi yang memisahkannya menjadi dua
seri, perubahan cukup dilakukan di `book_series` + `book_series_items` —
tidak ada kode yang perlu ditulis ulang.

---

## 4. Trilogi Laskar Pelangi — Andrea Hirata

**Status:** terverifikasi · **Dimiliki perpustakaan:** 1 dari 3

### Rujukan
- **Wikipedia (EN), "Andrea Hirata"** — "Laskar Pelangi Trilogy".
- **Wikipedia (ID), "Andrea Hirata"** — riwayat penerjemahan ulang.
- **CNN Indonesia (Juli 2023)** — konfirmasi urutan tetralogi asli.

### Urutan terverifikasi

| # | Judul | Tahun | Status di katalog |
|---|---|---|---|
| 1 | Laskar Pelangi | 2005 | ✅ADA |
| 2 | Sang Pemimpi | 2006 | ❌ belum ada |
| 3 | Edensor | 2007 | ❌ belum ada |

### Catatan penting tentang "trilogi" vs "tetralogi"

Novel ini **asalnya tetralogi** (Laskar Pelangi, Sang Pemimpi, Edensor,
Maryamah Karpov). dependable pada 2021 penerbit menggabungkan *Sang Pemimpi*
dengan *Edensor*, lalu pada 2020 menggabungkan *Maryamah Karpov*, *Padang Bulan*,
dan *Cinta di Dalam Gelas* menjadi *Buku Besar Peminum Kopi*.

Artinya **judul dan terbitan berbeda** antara edisi lama dan baru. Yang dicatat
adalah **edisi asli 2005-2007**, karena itulah yang melekat pada nomor seri
di katalog. Buku *Buku Besar Peminum Kopi* **tidak** dimasukkan sebagai item
ketiga/fourth karena itu hasil penggabungan ulang, bukan judul tersendiri
dalam penomoran asli. Keputusan ini dicatat agar mudah ditinjau.

### Karya lepas yang sama
*Habis Gelap Terbitlah Terang* (2007) ada di katalog LUMEN tetapi **bukan**
bagian trilogi. Book ini muncul di bagian **Karya Lepas** pada halaman penulis —
yang justru membuktikan pemisahan seri/karya lepas bekerja.

---

## 5. One Piece — Eiichiro Oda

**Status:** terverifikasi · **Dimiliki perpustakaan:** 1 dari 1
(*One Piece Volume 1*)

Rujukan: **Wikipedia (EN), "One Piece"** — manga yang terbit sejak 1997.

Suku cadang manga berlarut tidak memiliki "akhir", sehingga seri ini **tidak**
diberi urutan masa depan. Katalog hanya mencatat volume yang benar-benar
dimiliki. Volume 2 dan seterusnya **tidak** dikarang sebagai entri hanya agar
roda terlihat penuh.

---

## 6. Apa yang **Tidak** Dimasukkan

| Tidak dimasukkan | Alasan |
|---|---|
| Judul Tere Liye sebagai buku di katalog | Membuat baris `books` berarti mengarang inventaris fisik.)|
| Cover dari CDN demo (`crafterui.com`) | Hardcoded stock-photo bukan cover buku sungguhan; membuat katalog tidak bisa dibuka tanpa internet. |
| Sinopsis/plot novel | Hak cipta. Cukup metadata bibliografi. |
| "Negeri Para Bedebah" sebagai seri terpisah | Sumber penerbit menyatukannya dalam satu serial aksi bernomor. |
| Volume One Piece 2+ | Tidak ada di katalog, dan tidak perlu dikarang agar roda penuh. |
| Penulis fiktif untuk complementa tampilan | Kalimat mandat: "bukan daftar penulis yang harus dibuat sebagai data fiktif". |

---

## 7. Bagaimana Metadata Ditambahkan Nanti

Metadata ini **bukan** fitur yang di-hardcode. Alurnya normal:

1. Petugas membuka endpoint admin (`POST /api/collections/series`).
2. Memasukkan nama seri, sumber, dan tanggal verifikasi.
3. Mengatur isi seri (`PUT /api/collections/series/:id/items`) dengan urutan
   baca dan `bookId` — atau `null` untuk judul yang belum dimiliki.
4. Backend memvalidasi: posisi tidak boleh kembar, buku tidak boleh dobel,
   dan **buku harus milik penulis yang sama** (selain itu ditolak 409).

Tidak ada skrip SQL yang perlu dijalankan manual untuk menambah seri berikutnya.
Migrasi dan seed di folder `migrations/` hanya untuk data demonstrasi awal.

---

## 8. Ringkasan Sumber

| Seri | Sumber utama | Sumber pendukung | Diverifikasi |
|---|---|---|---|
| Serial Bumi | Wikipedia (Tere Liye, writer) | Goodreads, Gramedia | 14 Okt 2026 |
| Serial Aksi | bukukita.com (katalog penerbit) | kumparan, Gramedia | 14 Okt 2026 |
| Trilogi Laskar Pelangi | Wikipedia (Andrea Hirata) | Wikipedia (ID), CNN Indonesia | 14 Okt 2026 |
| One Piece | Wikipedia (One Piece) | — | 14 Okt 2026 |
