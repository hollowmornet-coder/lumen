-- =====================================================================
--  LUMEN - Migrasi 006: Operasional Lanjutan
--
--  Menambahkan kemampuan yang dibutuhkan perpustakaan sekolah yang
--  benar-benar berjalan, bukan fitur hiasan:
--
--    1. Hari libur         -> jatuh tempo tidak jatuh saat perpustakaan tutup
--    2. Kunjungan          -> laporan kunjungan harian dari scan kartu
--    3. Stok opname        -> audit fisik vs sistem, selisih tercatat
--    4. Ulasan & rating    -> rekomendasi buku dari siswa
--    5. Pengumuman         -> pesan admin ke seluruh/sebagian pengguna
--    6. Daftar keinginan   -> siswa menandai buku yang ingin dibaca
--
--  Prinsip yang dipertahankan dari skema 001-005:
--    * Status waktu (terlambat, kedaluwarsa) tetap DERIVED dari NOW().
--    * Tidak ada kolom yang bisa "basi" dan harus dihitung ulang manual.
--    * Setiap tabel baru punya UNIQUE yang mencegah data ganda saat
--      tombol diklik dua kali.
--
--  Jalankan sekali:
--    mysql -u lumen_user -p lumen_db < migrations/006_operations.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- (1) holidays - kalender hari libur
--
-- Dipakai saat menghitung `due_at`: bila tanggal jatuh tempo mengenai hari
-- libur, tenggat digeser ke hari kerja berikutnya. Tanpa tabel ini, buku
-- yang jatuh tempo saat libur sekolah dihitung terlambat padahal siswa
-- tidak punya kesempatan mengembalikannya.
--
-- `holiday_date` UNIQUE: satu tanggal hanya boleh tercatat sekali, jadi
-- mengimpor kalender dua kali tidak menggandakan hari libur.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `holidays` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `holiday_date` DATE NOT NULL,
  `name`         VARCHAR(120) NOT NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (2) library_visits - kunjungan harian
--
-- Satu baris = satu kunjungan. Siswa memindai kartu di pintu masuk, atau
-- petugas mencatat manual bagi yang tidak membawa kartu (`user_id` NULL
-- dan `guest_name` terisi).
--
-- `visit_date` diisi oleh SQL (CURDATE()), bukan aplikasi, agar konsisten
-- dengan zona waktu server. UNIQUE (user_id, visit_date) membuat satu
-- siswa terhitung sekali per hari walau kartunya dipindai berkali-kali.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `library_visits` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NULL,
  `guest_name` VARCHAR(100) NULL,
  `purpose`    ENUM('read','borrow','return','study','other') NOT NULL DEFAULT 'read',
  `visit_date` DATE NOT NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_visit_user_day` (`user_id`, `visit_date`),
  KEY `idx_visit_date` (`visit_date`),
  CONSTRAINT `fk_visit_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_visit_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (3) stock_opnames - audit stok fisik
--
-- Satu baris = satu sesi opname untuk satu buku. `expected` adalah angka
-- sistem SAAT sesi dimulai (di-snapshot, bukan dihitung ulang nanti),
-- `counted` adalah hasil hitung fisik.
--
-- Selisih TIDAK langsung mengubah stok. Petugas harus menyetujui lebih
-- dulu (`applied_at`), karena hitungan fisik bisa salah. Ini memisahkan
-- "catatan" dari "perubahan data".
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_opnames` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `book_id`     INT UNSIGNED NOT NULL,
  `expected`    SMALLINT UNSIGNED NOT NULL,
  `counted`     SMALLINT UNSIGNED NOT NULL,
  `note`        VARCHAR(255) NULL,
  `applied_at`  DATETIME NULL,
  `applied_by`  INT UNSIGNED NULL,
  `created_by`  INT UNSIGNED NOT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_opname_book` (`book_id`, `created_at`),
  KEY `idx_opname_pending` (`applied_at`),
  CONSTRAINT `fk_opname_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_opname_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_opname_applied_by`
    FOREIGN KEY (`applied_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (4) book_reviews - ulasan & rating
--
-- UNIQUE (book_id, user_id): satu siswa satu ulasan per buku. Mengubah
-- pendapat = mengedit ulasan yang sama, bukan menumpuk baris baru.
--
-- Ulasan hanya boleh ditulis oleh siswa yang PERNAH meminjam buku itu.
-- Aturan itu ditegakkan di service (butuh data loans), bukan di skema.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `book_reviews` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `book_id`    INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `rating`     TINYINT UNSIGNED NOT NULL,
  `comment`    VARCHAR(1000) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_book_user` (`book_id`, `user_id`),
  KEY `idx_review_book` (`book_id`, `created_at`),
  CONSTRAINT `fk_review_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_review_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ck_review_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (5) announcements - pengumuman admin
--
-- `audience` menentukan siapa yang melihat:
--   all     -> semua pengguna aktif
--   user    -> hanya siswa
--   admin   -> hanya petugas
--
-- `expires_at` NULL berarti tidak pernah kedaluwarsa. Pengumuman yang
-- kedaluwarsa tetap tersimpan sebagai riwayat tetapi tidak ditampilkan.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `announcements` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`      VARCHAR(150) NOT NULL,
  `body`       VARCHAR(2000) NOT NULL,
  `audience`   ENUM('all','user','admin') NOT NULL DEFAULT 'all',
  `pinned`     TINYINT(1) NOT NULL DEFAULT 0,
  `expires_at` DATETIME NULL,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ann_visible` (`audience`, `created_at`),
  CONSTRAINT `fk_ann_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (6) wishlists - daftar keinginan
--
-- Berbeda dari `reservations`: wishlist TIDAK memesan stok dan tidak
-- memberi posisi antrean. Ia hanya penanda pribadi ("ingin dibaca") yang
-- bisa dipakai petugas untuk melihat judul mana yang paling diminati.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wishlists` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `book_id`    INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wish_user_book` (`user_id`, `book_id`),
  KEY `idx_wish_book` (`book_id`),
  CONSTRAINT `fk_wish_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wish_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- (7) users.must_change_password
--
-- Accounts created by the Excel importer share one batch password (hashing a
-- separate password for each of 500 students would block the request for
-- ~40 seconds). A shared secret is only acceptable if it cannot be used
-- indefinitely, so the flag forces a change on first login.
-- ---------------------------------------------------------------------
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `must_change_password` TINYINT(1) NOT NULL DEFAULT 0
  AFTER `status`;

-- ---------------------------------------------------------------------
-- (8) Pengaturan baru
--
-- `due_date_skip_holidays` default 1: perilaku yang diharapkan sekolah.
-- `max_reservations_per_user` menutup celah "satu siswa mengantre 20
-- judul" yang sebelumnya tidak dibatasi sama sekali.
-- ---------------------------------------------------------------------
INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
  ('due_date_skip_holidays',      '1', '1 = tanggal jatuh tempo digeser ke hari kerja bila mengenai hari libur'),
  ('max_reservations_per_user',   '3', 'Maksimal antrean aktif yang boleh dimiliki satu anggota'),
  ('review_requires_loan',        '1', '1 = hanya anggota yang pernah meminjam buku boleh mengulas'),
  ('visit_tracking_enabled',      '1', '1 = pencatatan kunjungan perpustakaan aktif')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);

-- ---------------------------------------------------------------------
-- (8) Seed hari libur nasional Indonesia 2026
--
-- Hanya tanggal yang pasti. Cuti bersama yang tanggalnya berubah tiap
-- tahun sengaja tidak dimasukkan agar tidak menjadi data yang salah;
-- admin dapat menambahkannya lewat menu Pengaturan.
-- ---------------------------------------------------------------------
INSERT INTO `holidays` (`holiday_date`, `name`) VALUES
  ('2026-01-01', 'Tahun Baru Masehi'),
  ('2026-03-19', 'Hari Suci Nyepi'),
  ('2026-03-20', 'Hari Raya Idul Fitri'),
  ('2026-03-21', 'Hari Raya Idul Fitri'),
  ('2026-04-03', 'Wafat Isa Al Masih'),
  ('2026-05-01', 'Hari Buruh Internasional'),
  ('2026-05-14', 'Kenaikan Isa Al Masih'),
  ('2026-05-27', 'Hari Raya Idul Adha'),
  ('2026-06-01', 'Hari Lahir Pancasila'),
  ('2026-08-17', 'Hari Kemerdekaan RI'),
  ('2026-12-25', 'Hari Raya Natal')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`);
