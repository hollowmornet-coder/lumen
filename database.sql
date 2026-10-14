-- =====================================================================
--  LUMEN — Digital School Library Management System
--  Database Schema (MySQL 8 / MariaDB 10.4+ / XAMPP compatible)
--
--  Berisi: struktur tabel, constraint, relasi, indeks, dan
--           seed data demo yang ditandai jelas dengan "-- [DEMO]".
--
--  Cara import:
--    Terminal  : mysql -u root -p < database.sql
--    phpMyAdmin : Import -> pilih file ini -> Go
--
--  Catatan desain penting (lihat docs/DESKRIPSI_PROGRAM.md):
--   1. Status `overdue` TIDAK disimpan di tabel loans. Status tersebut
--      dihitung saat query (derived state) dari due_at + status='borrowed'.
--      Menyimpannya akan requires cron job dan berpotensi "drift".
--   2. Tidak ada tabel `returns` terpisah. Seluruh siklus hidup
--      peminjaman (termasuk pengembalian) tersimpan di tabel `loans`
--      agar tidak ada tabel yang tidak terpakai.
--   3. Kolom `available_copies` HANYA boleh diubah di dalam transaksi
--      DB dengan `SELECT ... FOR UPDATE` (lihat backend/src/modules/loans).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `lumen_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lumen_db`;

-- ---------------------------------------------------------------------
-- TABEL: users  (Admin / Petugas + Siswa)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `loans`;
DROP TABLE IF EXISTS `book_series_items`;
DROP TABLE IF EXISTS `book_series`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `authors`;

CREATE TABLE `users` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `member_code`   VARCHAR(30)     NULL,               -- kode anggota siswa; admin NULL
  `username`      VARCHAR(50)     NOT NULL,
  `email`         VARCHAR(120)    NOT NULL,
  `password_hash` VARCHAR(255)    NOT NULL,
  `full_name`     VARCHAR(100)    NOT NULL,
  `role`          ENUM('admin','user')  NOT NULL DEFAULT 'user',
  `class_name`    VARCHAR(50)     NULL,
  `phone`         VARCHAR(30)     NULL,
  `address`       VARCHAR(200)    NULL,
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `last_login_at` DATETIME        NULL,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_member_code` (`member_code`),
  KEY `idx_users_role_status` (`role`, `status`),
  KEY `idx_users_full_name` (`full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: categories
-- ---------------------------------------------------------------------
CREATE TABLE `categories` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(80)  NOT NULL,
  `slug`        VARCHAR(80)  NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  UNIQUE KEY `uq_categories_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: authors  (penulis)
--
-- Catatan: `books` tetap menyimpan `author` sebagai teks (sumber yang sudah
-- ada dan masih dipakai katalog), tetapi kini juga punya `author_id` yang
-- menunjuk tabel ini. `author` teks dipertahankan agar pencarian
-- judul/penulis yang sudah bekerja tidak ikut berubah.
-- ---------------------------------------------------------------------
CREATE TABLE `authors` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(150) NOT NULL,
  `slug`        VARCHAR(150) NOT NULL,
  `bio`         TEXT         NULL,
  `nationality` VARCHAR(80)  NULL,
  `birth_year`  SMALLINT UNSIGNED NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_authors_name` (`name`),
  UNIQUE KEY `uq_authors_slug` (`slug`),
  KEY `idx_authors_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: books
-- ---------------------------------------------------------------------
CREATE TABLE `books` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `isbn`             VARCHAR(20)     NOT NULL,
  `title`            VARCHAR(200)    NOT NULL,
  `author`           VARCHAR(150)    NOT NULL,
  `author_id`        INT UNSIGNED    NULL,
  `publisher`        VARCHAR(120)    NULL,
  `publish_year`     SMALLINT UNSIGNED NULL,
  `category_id`      INT UNSIGNED    NULL,
  `description`      TEXT            NULL,
  `shelf_location`   VARCHAR(50)     NULL,
  `total_copies`     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `available_copies` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `cover_path`       VARCHAR(255)    NULL,
  `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_books_isbn` (`isbn`),
  KEY `idx_books_title` (`title`),
  KEY `idx_books_author` (`author`),
  KEY `idx_books_category` (`category_id`),
  KEY `idx_books_status` (`status`),
  KEY `idx_books_publish_year` (`publish_year`),
  KEY `idx_books_author_id` (`author_id`),
  CONSTRAINT `fk_books_author`
    FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_books_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_books_stock` CHECK (
    `available_copies` >= 0 AND `available_copies` <= `total_copies`
  ),
  CONSTRAINT `ck_books_year` CHECK (`publish_year` IS NULL OR `publish_year` BETWEEN 1000 AND 2999)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: book_series  (seri / kumpulan karya)
-- ---------------------------------------------------------------------
CREATE TABLE `book_series` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `author_id`    INT UNSIGNED NOT NULL,
  `name`         VARCHAR(150) NOT NULL,
  `slug`         VARCHAR(150) NOT NULL,
  `description`  TEXT     NULL,
  `verification` ENUM('verified','unverified') NOT NULL DEFAULT 'verified',
  `source_url`   VARCHAR(500) NULL,
  `verified_at`  DATE        NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_series_author_slug` (`author_id`, `slug`),
  KEY `idx_series_author` (`author_id`),
  CONSTRAINT `fk_series_author`
    FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: book_series_items  (urutan baca dalam sebuah seri)
--
-- `book_id` BOLEH NULL dan itu disengaja. Kolom ini mewakili judul yang
-- sudah terverifikasi secara bibliografis tetapi belum dimiliki
-- perpustakaan. Judul semacam itu tampil sebagai "belum ada di koleksi"
-- dan tidak dapat dipinjam.
--
-- Alternatifnya adalah membuat baris `books` palsu agar relasinya penuh,
-- tetapi itu justru melarang dan akan mengarang inventaris.
-- ---------------------------------------------------------------------
CREATE TABLE `book_series_items` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `series_id` INT UNSIGNED NOT NULL,
  `book_id`   INT UNSIGNED NULL,
  `position`  SMALLINT UNSIGNED NOT NULL,
  `note`      VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_series_position` (`series_id`, `position`),
  UNIQUE KEY `uq_item_series_book` (`series_id`, `book_id`),
  KEY `idx_item_book` (`book_id`),
  CONSTRAINT `fk_item_series`
    FOREIGN KEY (`series_id`) REFERENCES `book_series` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_item_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ck_item_position` CHECK (`position` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: loans  (peminjaman & pengembalian)
-- ---------------------------------------------------------------------
CREATE TABLE `loans` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `loan_code`          VARCHAR(30)  NOT NULL,
  `user_id`            INT UNSIGNED NOT NULL,
  `book_id`            INT UNSIGNED NOT NULL,
  `quantity`           SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `status`             ENUM('pending','approved','rejected','borrowed',
                            'return_requested','returned','cancelled')
                        NOT NULL DEFAULT 'pending',
  `requested_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at`        DATETIME     NULL,
  `approved_by`        INT UNSIGNED NULL,
  `rejected_at`        DATETIME     NULL,
  `rejected_reason`    VARCHAR(255) NULL,
  `borrowed_at`        DATETIME     NULL,
  `due_at`             DATETIME     NULL,
  `return_requested_at` DATETIME    NULL,
  `returned_at`        DATETIME     NULL,
  `returned_by`        INT UNSIGNED NULL,
  `return_condition`   ENUM('good','damaged','lost') NULL,
  `return_note`        VARCHAR(255) NULL,
  `admin_note`         VARCHAR(255) NULL,
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loans_code` (`loan_code`),
  KEY `idx_loans_user` (`user_id`),
  KEY `idx_loans_book` (`book_id`),
  KEY `idx_loans_status` (`status`),
  KEY `idx_loans_due_at` (`due_at`),
  KEY `idx_loans_requested_at` (`requested_at`),
  KEY `idx_loans_user_status` (`user_id`, `status`),
  CONSTRAINT `fk_loans_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_loans_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_loans_approved_by`
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_loans_returned_by`
    FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ck_loans_quantity` CHECK (`quantity` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: activity_logs  (audit trail)
-- ---------------------------------------------------------------------
CREATE TABLE `activity_logs` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NULL,
  `actor_name`  VARCHAR(100) NOT NULL,
  `action`      VARCHAR(50)  NOT NULL,   -- login, logout, book.create, loan.approve, ...
  `entity_type` VARCHAR(40)  NULL,      -- book, member, loan, auth, settings
  `entity_id`   INT UNSIGNED NULL,
  `description` VARCHAR(255) NULL,
  `metadata`    JSON         NULL,
  `ip_address`  VARCHAR(45)  NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_logs_user` (`user_id`),
  KEY `idx_logs_action` (`action`),
  KEY `idx_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TABEL: settings  (aturan operasional yang dapat dikonfigurasi)
-- ---------------------------------------------------------------------
CREATE TABLE `settings` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(50)  NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  `description`   VARCHAR(255) NULL,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
--  SEED DATA — [DEMO]
--  Seluruh data di bawah ini adalah data contoh untuk keperluan
--  demonstrasi/testing UKK. Password dalam bentuk bcrypt hash.
--
--  Login demo:
--    Admin : admin      / Admin123!
--    Siswa : andira     / Siswa123!
-- =====================================================================

-- ---------- Kategori ----------
INSERT INTO `categories` (`name`, `slug`, `description`) VALUES
  ('Fiksi',                'fiksi',        'Novel, cerita pendek, dan karya imajinatif'),
  ('Non-Fiksi',            'non-fiksi',    'Karya umum, sejarah, biografi'),
  ('Sains & Teknologi',     'sains-teknologi','Buku STEM, komputer, dan rekayasa'),
  ('Pendidikan & Referensi','pendidikan',   'Buku pelajaran dan panduan belajar'),
  ('Komik & Humor',         'komik',        'Grafis, komik, dan humor'),
  ('Bahasa & Sastra',       'bahasa',       'Bahasa, puisi, dan sastra daerah');

-- ---------- [DEMO] Penulis ----------
-- Hanya penulis yang benar-benar punya relevansi untuk fitur koleksi seri
-- yang diberi profil. Penulis lain dibuat otomatis dari kolom `books.author`
-- (lihat blok backfill di bawah) sehingga tidak ada data yang dikarang.
INSERT INTO `authors` (`id`, `name`, `slug`, `bio`, `nationality`) VALUES
  (1, 'Tere Liye', 'tere-liye',
   'Penulis Indonesia yang dikenal lewat serial dunia paralel dan serial aksi.',
   'Indonesia'),
  (2, 'Andrea Hirata', 'andrea-hirata',
   'Novelis asal Belitung. Laskar Pelangi (2005) terjual jutaan kopi dan diterjemahkan ke sejumlah bahasa.',
   'Indonesia'),
  (3, 'Eiichiro Oda', 'eiichiro-oda',
   'Manga petualangan yang masih terbit sejak 1997.', 'Jepang');

-- ---------- Pengaturan operasional ----------
INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
  ('max_loan_per_user', '3',       'Maksimal buku yang boleh dipinjam aktif secara bersamaan'),
  ('loan_duration_days','7',       'Masa pinjam dalam hari sejak buku diserahkan'),
  ('require_approval',  '1',       '1 = peminjaman harus disetujui admin, 0 = langsung aktif'),
  ('allow_self_return', '1',       '1 = siswa boleh mengajukan pengembalian via aplikasi'),
  ('late_fee_per_day',  '1000',    'Denda keterlambatan per hari (dalam Rupiah)');

-- ---------- [DEMO] Pengguna ----------
-- password_hash = bcrypt('Admin123!')  /  bcrypt('Siswa123!')
INSERT INTO `users`
  (`member_code`, `username`, `email`, `password_hash`, `full_name`, `role`, `class_name`, `phone`, `status`)
VALUES
  (NULL,        'admin',   'admin@lumen.sch.id',
   '$2a$10$96aSFenUXwHJi1C/qhOqre2cQRszvvDRwQlfKY4Dicahmp7JNsRjS',
   'Petugas Perpustakaan', 'admin', NULL, '081200000001', 'active'),

  ('MBR-2026-001', 'andira', 'andira@lumen.sch.id',
   '$2a$10$cxNe4ES72C.w9oHOnkZj6OpYFPFmj8H87K/r3FZaVVmy9REcr14yq',
   'Andira Prameswari', 'user', 'XII RPL 1', '081200000002', 'active'),

  ('MBR-2026-002', 'bima', 'bima@lumen.sch.id',
   '$2a$10$cxNe4ES72C.w9oHOnkZj6OpYFPFmj8H87K/r3FZaVVmy9REcr14yq',
   'Bima Saputra', 'user', 'XII RPL 1', '081200000003', 'active'),

  ('MBR-2026-003', 'citra', 'citra@lumen.sch.id',
   '$2a$10$cxNe4ES72C.w9oHOnkZj6OpYFPFmj8H87K/r3FZaVVmy9REcr14yq',
   'Citra Lestari', 'user', 'XI RPL 2', '081200000004', 'active');

-- ---------- [DEMO] Buku ----------
INSERT INTO `books`
  (`isbn`, `title`, `author`, `publisher`, `publish_year`, `category_id`, `description`,
   `shelf_location`, `total_copies`, `available_copies`, `status`)
VALUES
  ('978-602-03-0001-1', 'Laskar Pelangi', 'Andrea Hirata', 'KPG', 2005, 1,
   'Kisah enam siswa SMA mencari makna persahabatan di Tanjung Manis.', 'F-01-01', 4, 4, 'active'),

  ('978-602-03-0002-8', 'Bumi Manusia', 'Pramoedya Ananta Toer', 'Gramedia', 1980, 1,
   'Kisah Waang Drok melawan tirani kolonial di VOC.', 'F-01-02', 3, 3, 'active'),

  ('978-602-03-0003-5', 'Dilan 1990', 'Dilan Bandoso', 'KPG', 2013, 1,
   'Romance urban sederhana tentang Dilan di Bandung.', 'F-01-03', 3, 3, 'active'),

  ('978-602-03-0004-2', 'Habis Gelap Terbitlah Terang', 'Andrea Hirata', 'KPG', 2007, 1,
   'Kisah masa kecil dan perjuangan bertahan menghadapi kesulitan.', 'F-01-04', 2, 2, 'active'),

  ('978-602-03-0005-9', 'Sapiens: Sejarah Ringkas Umat Manusia', 'Yuval Noah Harari', 'KPG', 2017, 2,
   'Sejarah peradaban manusia dari Paleolitik hingga era digital.', 'NF-01-01', 2, 2, 'active'),

  ('978-602-03-0006-6', 'Atomic Habits', 'James Clear', 'Elex Media', 2019, 2,
   'Metode membangun kebiasaan kecil dengan dampak besar jangka panjang.', 'NF-01-02', 3, 3, 'active'),

  ('978-602-03-0007-3', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 'Prentice Hall', 2008, 3,
   'Panduan menulis kode yang mudah dibaca, diubah, dan diuji.', 'ST-01-01', 2, 2, 'active'),

  ('978-602-03-0008-0', 'Refactoring 2nd Edition', 'Martin Fowler', 'Addison-Wesley', 2018, 3,
   'Teknik memperbaiki struktur kode tanpa mengubah perilaku aplikasi.', 'ST-01-02', 2, 2, 'active'),

  ('978-602-03-0009-7', 'Belajar JavaScript untuk Pemula', 'Rizky Prayogi', 'HumaTECH', 2020, 3,
   'Panduan praktis JavaScript dari variabel hingga asynchronous.', 'ST-01-03', 3, 3, 'active'),

  ('978-602-03-0010-3', 'Matematika Diskret', 'Kenneth Rosen', 'Erlangga', 2015, 4,
   'Logika, himpunan, relasi, kombinatorika, dan teori graf.', 'PD-01-01', 2, 2, 'active'),

  ('978-602-03-0011-0', 'Pengantar Ekonomi Indonesia', 'N. Gregory Mankiw', 'Erlangga', 2018, 4,
   'Prinsip dasar ekonomi mikro dan makro beserta studi kasus Indonesia.', 'PD-01-02', 2, 2, 'active'),

  ('978-602-03-0012-7', 'Tubuh Kita', 'Dr. Evelynne Rigaud', 'Elex Media', 2016, 2,
   'Ilmu pengetahuan tentang anatomi dan fisiologi tubuh manusia.', 'NF-02-01', 2, 2, 'active'),

  ('978-602-03-0013-4', 'One Piece Volume 1', 'Eiichiro Oda', 'Elex Media', 2015, 5,
   'Petualangan Monkey D. Luffy mencari One Piece bersama krunya.', 'KM-01-01', 5, 5, 'active'),

  ('978-602-03-0014-1', 'Komik Lucu Volume 7', 'Team Philemon', 'KPG', 2019, 5,
   'Kumpulan komik pendek yang menghibur pembaca.', 'KM-01-02', 3, 3, 'active');

-- ---------- Backfill penulis dari kolom `books.author` ----------
-- Setiap penulis yang muncul di katalog dibuatkan barisnya sendiri, lalu
-- `books.author_id` diisi. Ini menjaga satu sumber kebenaran: nama penulis
-- tetap berupa teks di `books` (dipakai pencarian katalog), sementara
-- relasi yang dapat di-query ada di `authors`.
INSERT INTO `authors` (`name`, `slug`)
SELECT DISTINCT b.author, LOWER(REPLACE(TRIM(b.author), ' ', '-'))
  FROM `books` b
 WHERE TRIM(b.author) <> ''
   AND NOT EXISTS (SELECT 1 FROM `authors` a WHERE a.name = b.author);

UPDATE `books` b
  JOIN `authors` a ON a.name = b.author
   SET b.author_id = a.id
 WHERE b.author_id IS NULL;

-- ---------- [VERIFIED] Seri buku ----------
-- Metadata diverifikasi dari sumber bibliografi; rujukan lengkap dan tanggal
-- verifikasi ada di docs/METADATA_SERI.md.
--
-- PENTING: `book_id` NULL berarti judul terverifikasi ada di bibliografi
-- tetapi BELUM dimiliki perpustakaan. Itu status "belum ada di koleksi",
-- bukan buku palsu, dan judul seperti itu tidak dapat dipinjam.
INSERT INTO `book_series`
  (`id`, `author_id`, `name`, `slug`, `description`, `verification`, `source_url`, `verified_at`)
VALUES
  (1, 1, 'Serial Bumi', 'serial-bumi',
   'Saga dunia paralel Controlled Bureau, dimulai 2014. Tujuh belas judul hingga 2025.',
   'verified', 'https://en.wikipedia.org/wiki/Tere_Liye_(writer)', '2026-10-14'),
  (2, 1, 'Serial Aksi', 'serial-aksi',
   'Thriller aksi dua jalur: alur Bedebah (Thomas) dan alur Pulang-Pergi (Bujang). Pulang-Pergi adalah titik pertemuan kedua tokoh.',
   'verified', 'https://www.gramedia.com/blog/novel-berseri-tere-liye-mana-yang-jadi-favoritmu/', '2026-10-14'),
  (3, 2, 'Trilogi Laskar Pelangi', 'trilogi-laskar-pelangi',
   'Awalnya tetralogi (2005-2008). Pada cetakan 2021 beberapa judul digabung menjadi Buku Besar Peminum Kopi (2020).',
   'verified', 'https://en.wikipedia.org/wiki/Andrea_Hirata', '2026-10-14'),
  (4, 3, 'One Piece', 'one-piece',
   'Manga petualangan berlarut. Koleksi perpustakaan menyimpan satu volume.',
   'verified', 'https://en.wikipedia.org/wiki/One_Piece', '2026-10-14');

INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 1 AS s, NULL AS b, 1 AS p, 'Bumi, 2014' AS n
  UNION ALL SELECT 1, NULL,  2, 'Bulan, 2015'
  UNION ALL SELECT 1, NULL,  3, 'Matahari, 2016'
  UNION ALL SELECT 1, NULL,  4, 'Bintang, 2017'
  UNION ALL SELECT 1, NULL,  5, 'Ceros dan Batozar, 2018'
  UNION ALL SELECT 1, NULL,  6, 'Komet, 2018'
  UNION ALL SELECT 1, NULL,  7, 'Komet Minor, 2019'
  UNION ALL SELECT 1, NULL,  8, 'Selena, 2020'
  UNION ALL SELECT 1, NULL,  9, 'Nebula, 2020'
  UNION ALL SELECT 1, NULL, 10, 'Si Putih, 2021'
  UNION ALL SELECT 1, NULL, 11, 'Lumpu, 2021'
  UNION ALL SELECT 1, NULL, 12, 'Matahari Minor, 2022'
  UNION ALL SELECT 1, NULL, 13, 'Bibi Gill, 2022'
  UNION ALL SELECT 1, NULL, 14, 'SagaraS, 2022'
  UNION ALL SELECT 1, NULL, 15, 'Ily, 2023'
  UNION ALL SELECT 1, NULL, 16, 'Aldebaran, 2024'
  UNION ALL SELECT 1, NULL, 17, 'Hana-Tara-Hata, 2025'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `book_series_items` i WHERE i.series_id = seed.s AND i.position = seed.p
);

INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 2 AS s, NULL AS b, 1 AS p, 'Negeri Para Bedebah, 2012 - alur Thomas' AS n
  UNION ALL SELECT 2, NULL, 2, 'Negeri di Ujung Tanduk, 2013 - alur Thomas'
  UNION ALL SELECT 2, NULL, 3, 'Pulang, 2015 - alur Bujang'
  UNION ALL SELECT 2, NULL, 4, 'Pergi, 2018 - alur Bujang'
  UNION ALL SELECT 2, NULL, 5, 'Pulang-Pergi, 2021 - titik pertemuan Thomas dan Bujang'
  UNION ALL SELECT 2, NULL, 6, 'Bedebah di Ujung Tanduk, 2022 - alur Thomas'
  UNION ALL SELECT 2, NULL, 7, 'Tanah Para Bandit - alur Bedebah'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `book_series_items` i WHERE i.series_id = seed.s AND i.position = seed.p
);

INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 3 AS s, (SELECT id FROM books WHERE title = 'Laskar Pelangi' LIMIT 1) AS b, 1 AS p, '2005' AS n
  UNION ALL SELECT 3, NULL, 2, 'Sang Pemimpi, 2006 (cetakan 2021 menggabungkan dengan Edensor)'
  UNION ALL SELECT 3, NULL, 3, 'Edensor, 2007'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `book_series_items` i WHERE i.series_id = seed.s AND i.position = seed.p
);

INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 4 AS s, (SELECT id FROM books WHERE title = 'One Piece Volume 1' LIMIT 1) AS b, 1 AS p, 'Volume 1' AS n
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `book_series_items` i WHERE i.series_id = seed.s AND i.position = seed.p
);

-- =====================================================================
--  [DEMO] Koleksi Tere Liye, melengkapi Trilogi Laskar Pelangi, dan sampul
-- =====================================================================
SET NAMES utf8mb4;

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
--  AKHIR
-- =====================================================================
