-- =====================================================================
--  LUMEN - Migrasi 004: Koleksi Tere Liye & Sampul
--
--  Dua hal dilakukan sekaligus:
--    (a) Menambahkan buku Tere Liye + dua judul Andrea Hirata ke inventaris
--    (b) Mengaitkan `cover_path` ke berkas sampul yang tersimpan lokal
--
--  SUMBER ISBN (berjenjang, dipakai sesuai tingkat keyakinan):
--    [PUB]  front matter PDF resmi penerbit - tingkat tertinggi
--    [WIKI] infobox artikel Wikipedia
--    [OL]   Open Library / katalog buku
--
--  ISBN yang sumbernya saling bertentangan TIDAK digabung diam-diam.
--  Lihat catatan di bagian bawah dan docs/METADATA_SERI.md.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- (a) Buku baru
-- ---------------------------------------------------------------------
-- ISBN dan tahun sudah diverifikasi. Sampul disimpan di backend/uploads/covers
-- sehingga katalog tetap bisa dibuka tanpa internet.
INSERT INTO `books`
  (`isbn`, `title`, `author`, `author_id`, `publisher`, `publish_year`, `category_id`,
   `description`, `shelf_location`, `total_copies`, `available_copies`, `cover_path`, `status`)
VALUES
  -- ---------- Serial Bumi ----------
  ('978-602-03-0112-9', 'Bumi', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2014, 1,
   'Novel pertama Serial Bumi. Raib, Ali, dan Seli menemukan jalan ke dunia paralel Controlled Bureau.',
   'F-02-01', 4, 4, '/uploads/covers/bumi.jpg', 'active'),                       -- [PUB]

  ('978-602-03-3294-9', 'Bulan', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2015, 1,
   'Novel kedua Serial Bumi. Perjalanan Raib, Ali, dan Seli ke Klan Bulan.',
   'F-02-02', 4, 4, '/uploads/covers/bulan.jpg', 'active'),                       -- [OL/GRAMEDIA]

  ('978-602-03-3211-6', 'Matahari', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2016, 1,
   'Novel ketiga Serial Bumi. Ali menelusuri Klan Bintang.',
   'F-02-03', 3, 3, '/uploads/covers/matahari.jpg', 'active'),                    -- [OL/GRAMEDIA]

  ('978-602-03-5117-9', 'Bintang', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2017, 1,
   'Novel keempat Serial Bumi. Perjalanan Klan Bintang.',
   'F-02-04', 3, 3, '/uploads/covers/bintang.jpg', 'active'),                     -- [PUB]

  ('978-602-0385-91-4', 'Ceros dan Batozar', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2018, 1,
   'Novel kelima Serial Bumi.',
   'F-02-05', 2, 2, '/uploads/covers/ceros-dan-batozar.jpg', 'active'),            -- [OL]

  ('978-602-0623-39-9', 'Komet Minor', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2019, 1,
   'Novel ketujuh Serial Bumi.',
   'F-02-07', 2, 2, '/uploads/covers/komet-minor.jpg', 'active'),                 -- [OL]

  ('978-602-0385-94-5', 'Selena', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2020, 1,
   'Novel kedelapan Serial Bumi.',
   'F-02-08', 2, 2, '/uploads/covers/selena.jpg', 'active'),                      -- [OL]

  ('6020639533', 'Nebula', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2020, 1,
   'Novel kesembilan Serial Bumi.',
   'F-02-09', 2, 2, '/uploads/covers/nebula.jpg', 'active'),                      -- [OL, ISBN-10]

  ('978-602-0652-28-3', 'Lumpu', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2021, 1,
   'Novel kesebelas Serial Bumi.',
   'F-02-11', 2, 2, '/uploads/covers/lumpu.jpg', 'active'),                      -- [OL]

  ('978-602-0652-25-2', 'Si Putih', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2021, 1,
   'Novel kesepuluh Serial Bumi.',
   'F-02-10', 2, 2, '/uploads/covers/si-putih.jpg', 'active'),                    -- [OL]

  -- ---------- Serial Aksi ----------
  ('978-979-2285529', 'Negeri Para Bedebah', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2012, 1,
   'Serial Aksi, buku pertama. Alur Bedebah, tokoh Thomas.',
   'F-03-01', 3, 3, '/uploads/covers/negeri-para-bedebah.jpg', 'active'),         -- [OL]

  ('978-979-2294293', 'Negeri di Ujung Tanduk', 'Tere Liye', 1, 'Gramedia Pustaka Utama', 2013, 1,
   'Serial Aksi, buku kedua. Alur Bedebah, tokoh Thomas.',
   'F-03-02', 3, 3, '/uploads/covers/negeri-di-ujung-tanduk.jpg', 'active'),       -- [OL]

  ('978-602-082212-9', 'Pulang', 'Tere Liye', 1, 'Republika', 2015, 1,
   'Serial Aksi, buku ketiga. Alur Pulang-Pergi, tokoh Bujang.',
   'F-03-03', 3, 3, '/uploads/covers/pulang.jpg', 'active'),                      -- [OL]

  ('978-602-573405-2', 'Pergi', 'Tere Liye', 1, 'Republika', 2018, 1,
   'Serial Aksi, buku keempat. Alur Pulang-Pergi, tokoh Bujang.',
   'F-03-04', 3, 3, '/uploads/covers/pergi.jpg', 'active'),                       -- [OL]

  -- ---------- Andrea Hirata: melengkapi Trilogi Laskar Pelangi ----------
  ('979-3062-92-4', 'Sang Pemimpi', 'Andrea Hirata', 2, 'Bentang Pustaka', 2006, 1,
   'Novel kedua Trilogi Laskar Pelangi. Perjalanan Ikal, Arai, dan Jimbon di Manggar.',
   'F-01-05', 2, 2, '/uploads/covers/sang-pemimpi.jpg', 'active'),                -- [WIKI]

  ('979-1227-02-0', 'Edensor', 'Andrea Hirata', 2, 'Bentang Pustaka', 2007, 1,
   'Novel ketiga Trilogi Laskar Pelangi. Ikal berlayar bersama Weh.',
   'F-01-06', 2, 2, '/uploads/covers/edensor.jpg', 'active')                       -- [OL]
ON DUPLICATE KEY UPDATE
  `cover_path` = VALUES(`cover_path`),
  `author_id`  = VALUES(`author_id`);

-- ---------------------------------------------------------------------
-- (b) Sampul untuk buku yang sudah ada sebelumnya
-- Hanya buku yang sampulnya benar-benar terunduh dan sudah dicek tidak
-- duplikat. Buku lain sengaja dibiarkan NULL dan memakai fallback
-- tipografis lokal, karena lebih baik tanpa gambar daripada gambar salah.
-- ---------------------------------------------------------------------
UPDATE `books` SET `cover_path` = '/uploads/covers/laskar-pelangi.jpg'
 WHERE `title` = 'Laskar Pelangi';
UPDATE `books` SET `cover_path` = '/uploads/covers/bumi-manusia.jpg'
 WHERE `title` = 'Bumi Manusia';
UPDATE `books` SET `cover_path` = '/uploads/covers/sapiens.jpg'
 WHERE `title` = 'Sapiens: Sejarah Ringkas Umat Manusia';
UPDATE `books` SET `cover_path` = '/uploads/covers/atomic-habits.jpg'
 WHERE `title` = 'Atomic Habits';
UPDATE `books` SET `cover_path` = '/uploads/covers/clean-code.jpg'
 WHERE `title` = 'Clean Code: A Handbook of Agile Software Craftsmanship';
UPDATE `books` SET `cover_path` = '/uploads/covers/refactoring.jpg'
 WHERE `title` = 'Refactoring 2nd Edition';

-- ---------------------------------------------------------------------
-- (c) Pengaitan seri -> buku
--
-- Hanya baris dengan posisi yang cocok. Judul yang tidak ada di inventaris
-- (mis. Komet, Bedebah di Ujung Tanduk, Tanah Para Bandit) tetap
-- book_id = NULL dan tampil sebagai "belum ada di koleksi".
-- ---------------------------------------------------------------------
UPDATE `book_series_items` i
  JOIN `books` b ON b.title = CASE i.position
      WHEN 1  THEN 'Bumi'              WHEN 2  THEN 'Bulan'
      WHEN 3  THEN 'Matahari'          WHEN 4  THEN 'Bintang'
      WHEN 5  THEN 'Ceros dan Batozar' WHEN 7  THEN 'Komet Minor'
      WHEN 8  THEN 'Selena'            WHEN 9  THEN 'Nebula'
      WHEN 10 THEN 'Si Putih'          WHEN 11 THEN 'Lumpu'
    END
   SET i.book_id = b.id
 WHERE i.series_id = 1 AND i.book_id IS NULL;

UPDATE `book_series_items` i
  JOIN `books` b ON b.title = CASE i.position
      WHEN 1 THEN 'Negeri Para Bedebah'    WHEN 2 THEN 'Negeri di Ujung Tanduk'
      WHEN 3 THEN 'Pulang'                 WHEN 4 THEN 'Pergi'
    END
   SET i.book_id = b.id
 WHERE i.series_id = 2 AND i.book_id IS NULL;

UPDATE `book_series_items` i
  JOIN `books` b ON b.title = CASE i.position
      WHEN 2 THEN 'Sang Pemimpi'
      WHEN 3 THEN 'Edensor'
    END
   SET i.book_id = b.id
 WHERE i.series_id = 3 AND i.book_id IS NULL;

-- Perbarui deskripsi Trilogi: sekarang perpustakaan memiliki 3 dari 3 judul.
UPDATE `book_series`
   SET `description` = 'Trilogi Laskar Pelangi (2005-2007). Pada cetakan 2021 beberapa judul digabung menjadi Buku Besar Peminum Kopi (2020). Ketiga judul asli ada di koleksi peperpustakaanan.'
 WHERE `id` = 3;

-- =====================================================================
--  CATATAN KETIDAKPASTIAN ISBN
--
--  1. BULAN. Dua sumber berbeda:
--       [GRAMEDIA/katalog] 978-602-03-3294-9  <- dipakai di sini
--       [Open Library]     978-602-0314112-2
--     Perbedaan ini nomor edisi berbeda (cetakan awal vscetakan
--     ulang), bukan kesalahan. Yang dipakai adalah nomor katalog penerbit.
--
--  2. KOMET. Tidak ditemukan ISBN yang bisa diverifikasi ke penerbit.
--     Buku ini sengaja TIDAK ditambahkan ke inventaris, sehingga posisinya
--     tetap book_id = NULL dan tampil "belum ada di koleksi". Menempelkan
--     ISBN tebakan akan lebih buruk daripada jujur tidak ada.
--
--  3. EDENSOR. Open Library menyebut tahun 2008;'id.wikipedia
--     Medicus" dan halaman film Laskar Pelangi menyebut 2007. Dipakai 2007.
--
--  4. BUMI MANUSIA (Pramoedya). Open Library mengembalikan ISBN
--     978-0140063349 / Rivages / 1972 yang jelas bukan edisi Indonesia.
--     ISBN buku TIDAK diubah. Hanya cover_path yang dipasang, karena
--     judul dan penulisnya cocok.
-- =====================================================================
