-- =====================================================================
--  LUMEN - Migrasi 005: Sirkulasi Lanjutan
--
--  Menambahkan enam kemampuan yang sebelumnya tidak ada:
--    1. Sirkulasi langsung di meja petugas (tidak butuh request siswa)
--    2. Batas waktu pengambilan untuk peminjaman yang sudah disetujui
--    3. Perpanjangan pinjaman (renewal)
--    4. Denda sebagai DATA (bukan angka yang dihitung ulang lalu hilang)
--    5. Notifikasi in-app
--    6. Antrean/reservasi saat stok habis
--    7. Buku rusak/hilang yang benar-benar memengaruhi stok
--    8. Reset kata sandi mandiri (token sekali pakai)
--
--  Prinsip yang dipertahankan dari skema lama:
--    * `overdue` tetap DERIVED, bukan kolom. Begitu juga `expired`.
--    * `available_copies` hanya berubah di dalam transaksi + FOR UPDATE.
--    * Setiap kolom baru punya alasan; tidak ada tabel hiasan.
--
--  Jalankan sekali:  mysql -u lumen_user -p lumen_db < migrations/005_circulation_features.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- (1) loans: perpanjangan & tenggat pengambilan
--
-- `pickup_deadline` DISIMPAN, bukan dihitung dari setting saat dibaca.
-- Alasannya: tenggat melekat pada keputusan admin pada saat itu. Kalau
-- `pickup_window_days` diubah besok, transaksi kemarin tidak boleh ikut
-- bergeser - itu akan membuat buku yang sudah "kedaluwarsa" tiba-tiba
-- hidup lagi.
-- ---------------------------------------------------------------------
ALTER TABLE `loans`
  ADD COLUMN `renew_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Berapa kali sudah diperpanjang' AFTER `quantity`,
  ADD COLUMN `pickup_deadline` DATETIME NULL
    COMMENT 'Batas pengambilan setelah disetujui; NULL bila tidak relevan' AFTER `approved_by`;

CREATE INDEX `idx_loans_pickup` ON `loans` (`pickup_deadline`);

-- ---------------------------------------------------------------------
-- (2) books: eksemplar rusak
--
-- Buku rusak TIDAK boleh dihitung "tersedia" (bisa dipinjam), tetapi juga
-- belum tentu dibuang. Karena itu ia mendapat kolom sendiri.
--
-- Invarian baru:
--   available_copies + damaged_copies + (yang sedang dipinjam) = total_copies
-- ---------------------------------------------------------------------
ALTER TABLE `books`
  ADD COLUMN `damaged_copies` SMALLINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Eksemplar rusak, tidak dapat dipinjam' AFTER `available_copies`;

ALTER TABLE `books`
  ADD CONSTRAINT `ck_books_damaged` CHECK (
    `available_copies` + `damaged_copies` <= `total_copies`
  );

-- ---------------------------------------------------------------------
-- (3) fines - denda sebagai data
--
-- Denda di-SNAPSHOT saat buku dikembalikan. Kalau tarif harian diubah
-- bulan depan, denda yang sudah tercatat tidak ikut berubah. Ini yang
-- membedakan "catatan keuangan" dari "angka tampilan".
--
-- UNIQUE (loan_id, kind): satu transaksi tidak bisa punya dua denda
-- keterlambatan, sehingga pengembalian yang di-klik dua kali tidak
-- menggandakan tagihan.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fines` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `loan_id`     INT UNSIGNED NOT NULL,
  `user_id`     INT UNSIGNED NOT NULL,
  `kind`        ENUM('late','damaged','lost') NOT NULL,
  `amount`      INT UNSIGNED NOT NULL,
  `status`      ENUM('unpaid','paid','waived') NOT NULL DEFAULT 'unpaid',
  `settled_at`  DATETIME NULL,
  `settled_by`  INT UNSIGNED NULL,
  `note`        VARCHAR(255) NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fines_loan_kind` (`loan_id`, `kind`),
  KEY `idx_fines_user_status` (`user_id`, `status`),
  KEY `idx_fines_created` (`created_at`),
  CONSTRAINT `fk_fines_loan`
    FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_fines_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_fines_settled_by`
    FOREIGN KEY (`settled_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (4) notifications - pesan dalam aplikasi
--
-- `dedupe_key` mencegah pengingat yang sama ditulis berkali-kali.
-- Contoh: "due-<loanId>-2026-10-20". Unik per pengguna, jadi satu
-- pengingat hanya muncul sekali untuk satu orang.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `type`       VARCHAR(40)  NOT NULL,   -- loan.approved, loan.due_soon, fine.created, ...
  `title`      VARCHAR(150) NOT NULL,
  `body`       VARCHAR(500) NULL,
  `link`       VARCHAR(200) NULL,
  `read_at`    DATETIME NULL,
  `dedupe_key` VARCHAR(120) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notif_dedupe` (`user_id`, `dedupe_key`),
  KEY `idx_notif_user_read` (`user_id`, `read_at`),
  KEY `idx_notif_created` (`created_at`),
  CONSTRAINT `fk_notif_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (5) reservations - antrean saat stok habis
--
-- Urutan antrean ditentukan `created_at` (yang lebih dulu menunggu,
-- dilayani lebih dulu). Tidak ada kolom `position` yang harus dihitung
-- ulang setiap ada pembatalan - itu sumber drift.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reservations` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `book_id`    INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `status`     ENUM('waiting','ready','fulfilled','expired','cancelled')
               NOT NULL DEFAULT 'waiting',
  `ready_at`   DATETIME NULL,
  `expires_at` DATETIME NULL,
  `note`       VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_res_book_status` (`book_id`, `status`),
  KEY `idx_res_user_status` (`user_id`, `status`),
  CONSTRAINT `fk_res_book`
    FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_res_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (6) password_resets - reset kata sandi mandiri
--
-- Yang disimpan HANYA hash SHA-256 dari token. Bocornya isi tabel ini
-- tidak memberi penyerang token yang bisa dipakai.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at`    DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pr_token` (`token_hash`),
  KEY `idx_pr_user` (`user_id`),
  CONSTRAINT `fk_pr_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- (7) Pengaturan baru
-- ---------------------------------------------------------------------
INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
  ('max_renewals',        '1',     'Maksimal berapa kali satu peminjaman boleh diperpanjang'),
  ('pickup_window_days',  '2',     'Batas hari pengambilan setelah peminjaman disetujui'),
  ('fine_block_borrow',   '1',     '1 = siswa dengan denda belum lunas tidak boleh meminjam'),
  ('damaged_fee',         '5000',  'Denda tetap bila buku dikembalikan dalam kondisi rusak'),
  ('lost_fee',            '50000', 'Denda tetap bila buku hilang'),
  ('reservation_hold_days','2',    'Lama buku ditahan untuk pemesan setelah tersedia')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);

-- ---------------------------------------------------------------------
-- (8) Backfill: peminjaman `approved` yang belum punya tenggat
--
-- Tanpa ini, transaksi lama akan selamanya "menunggu diambil" karena
-- `pickup_deadline` NULL berarti tidak ada tenggat.
-- ---------------------------------------------------------------------
UPDATE `loans`
   SET `pickup_deadline` = DATE_ADD(`approved_at`, INTERVAL 2 DAY)
 WHERE `status` = 'approved'
   AND `pickup_deadline` IS NULL
   AND `approved_at` IS NOT NULL;
