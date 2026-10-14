-- =====================================================================
--  LUMEN - Migrasi 002: Authors & Book Series
--  Menambahkan metadata penulis dan seri buku tanpa merusak data lama.
--
--  Jalankan pada instalasi yang SUDAH ada:
--    mysql -u root -p lumen_db < migrations/002_authors_series.sql
--
--  Skema:
--    authors           -> penulis (sumber kebenaran nama penulis)
--    book_series       -> seri / kumpulan karya
--    book_series_items -> urutan buku dalam seri, dengan book_idopsional
--    books.author_id   -> relasi buku ke penulis (backfill dari kolom author)
--
--  Catatan desain penting:
--  `book_series_items.book_id` boleh NULL. Itu disengaja: seri yang sudah
--  terverifikasi bibliografis dapat memuat judul yang belum dimiliki
--  perpustakaan. Judul seperti itu tampil sebagai "belum ada di koleksi"
--  dan TIDAK bisa dipinjam. Tanpa kolom opsional ini, kita akan dipaksa
--  membuat baris books palsu demi memenuhi relasi - yang justru dilarang.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- authors
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `authors` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(150) NOT NULL,
  `slug`       VARCHAR(150) NOT NULL,
  `bio`        TEXT         NULL,
  `nationality` VARCHAR(80) NULL,
  `birth_year` SMALLINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_authors_name` (`name`),
  UNIQUE KEY `uq_authors_slug` (`slug`),
  KEY `idx_authors_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- book_series
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `book_series` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `author_id`   INT UNSIGNED NOT NULL,
  `name`        VARCHAR(150) NOT NULL,
  `slug`        VARCHAR(150) NOT NULL,
  `description` TEXT     NULL,
  -- 'verified'  : metadata diverifikasi dari sumber tepercaya
  -- 'unverified': menunggu verifikasi; ditampilkan dengan penanda
  `verification` ENUM('verified','unverified') NOT NULL DEFAULT 'verified',
  `source_url`  VARCHAR(500) NULL,
  `verified_at` DATE        NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_series_author_slug` (`author_id`, `slug`),
  KEY `idx_series_author` (`author_id`),
  CONSTRAINT `fk_series_author`
    FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- book_series_items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `book_series_items` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `series_id` INT UNSIGNED NOT NULL,
  -- NULL = judul ada di bibliografi tapi belum ada di katalog perpustakaan
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
-- books.author_id  (backfill: cocokkan dengan kolom author yang sudah ada)
-- ---------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'author_id'
);

SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `books` ADD COLUMN `author_id` INT UNSIGNED NULL AFTER `author`',
  'DO 0');

PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill hanya bila kolom baru saja dibuat, supaya data tidak tertimpa.
SET @just_added := IF(@col_exists = 0, 1, 0);
SET @backfill := IF(@just_added = 1,
  'UPDATE `books` b JOIN `authors` a ON b.author = a.name SET b.author_id = a.id WHERE b.author_id IS NULL',
  'DO 0');

PREPARE stmt2 FROM @backfill;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books'
     AND CONSTRAINT_NAME = 'fk_books_author'
);

SET @add_fk := IF(@fk_exists = 0,
  'ALTER TABLE `books` ADD CONSTRAINT `fk_books_author` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'DO 0');

PREPARE stmt3 FROM @add_fk;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books'
     AND INDEX_NAME = 'idx_books_author_id'
);

SET @add_idx := IF(@idx_exists = 0,
  'ALTER TABLE `books` ADD INDEX `idx_books_author_id` (`author_id`)',
  'DO 0');

PREPARE stmt4 FROM @add_idx;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;
