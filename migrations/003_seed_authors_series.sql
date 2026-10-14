-- =====================================================================
--  LUMEN - Seed 003: Metadata penulis & seri (DIVERIFIKASI)
--
--  Setiap metadata seri di bawah disertai sumber yang benar-benar diperiksa
--  dan tanggal verifikasi. Rujukan lengkap ada di
--  docs/METADATA_SERI.md.
--
--  PENTING: judul yang tidak ada di katalog perpustakaan sengaja disimpan
--  dengan book_id = NULL. Itu berarti "terverifikasi ada di bibliografi,
--  tapi belum dimiliki perpustakaan" - BUKAN buku palsu.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Penulis
-- ---------------------------------------------------------------------
INSERT INTO `authors` (`id`, `name`, `slug`, `bio`, `nationality`) VALUES
  (1, 'Tere Liye', 'tere-liye',
   'Penulis Indonesia yang dikenal lewat serial dunia paralel dan serial aksi. Karyanya memakai kode nama yang berbeda pula untuk tiap saga.',
   'Indonesia'),
  (2, 'Andrea Hirata', 'andrea-hirata',
   'Novelis asal Belitung. Laskar Pelangi (2005) terjual jutaan kopi dan diterjemahkan ke sejumlah bahasa.',
   'Indonesia'),
  (3, 'Eiichiro Oda', 'eiichiro-oda',
   'Manga petualangan One Piece, ongoing sejak 1997.', 'Jepang')
ON DUPLICATE KEY UPDATE
  `bio` = VALUES(`bio`),
  `nationality` = VALUES(`nationality`);

-- Sisipkan sisa penulis langsung dari katalog yang sudah ada.
INSERT INTO `authors` (`name`, `slug`)
SELECT DISTINCT b.author,
       LOWER(REPLACE(TRIM(b.author), ' ', '-'))
  FROM `books` b
 WHERE b.author IS NOT NULL AND TRIM(b.author) <> ''
   AND NOT EXISTS (SELECT 1 FROM `authors` a WHERE a.name = b.author);

-- Backfill books.author_id (aman dijalankan berkali-kali).
UPDATE `books` b
  JOIN `authors` a ON a.name = b.author
   SET b.author_id = a.id
 WHERE b.author_id IS NULL;

-- ---------------------------------------------------------------------
-- Seri
-- ---------------------------------------------------------------------
INSERT INTO `book_series`
  (`id`, `author_id`, `name`, `slug`, `description`, `verification`, `source_url`, `verified_at`)
VALUES
  -- 1. Serial Bumi -------------------------------------------------
  (1, 1, 'Serial Bumi', 'serial-bumi',
   'Saga dunia paralel Controlled Bureau, dimulai 2014. Tujuh belas judul hingga 2025, membentang di Klan Bulan, Matahari, Bumi, dan Bintang beserta Mate.',
   'verified',
   'https://en.wikipedia.org/wiki/Tere_Liye_(writer)',
   '2026-10-14'),

  -- 2. Serial Aksi -------------------------------------------------
  (2, 1, 'Serial Aksi', 'serial-aksi',
   'Thriller aksi dua jalur: alur Bedebah (Thomas) dan alur Pulang-Pergi (Bujang). Pulang-Pergi, buku kelima, adalah titik pertemuan kedua tokoh.',
   'verified',
   'https://www.gramedia.com/blog/novel-berseri-tere-liye-mana-yang-jadi-favoritmu/',
   '2026-10-14'),

  -- 3. Trilogi Laskar Pelangi -------------------------------------
  (3, 2, 'Trilogi Laskar Pelangi', 'trilogi-laskar-pelangi',
   'Awalnya tetralogi (2005-2008). Pada cetakan 2021 Sang Pemimpi digabung dengan Edensor, lalu Maryamah Karpov, Padang Bulan, dan Cinta di Dalam Gelas disatukan menjadi Buku Besar Peminum Kopi (2020).',
   'verified',
   'https://en.wikipedia.org/wiki/Andrea_Hirata',
   '2026-10-14'),

  -- 4. One Piece ---------------------------------------------------
  (4, 3, 'One Piece', 'one-piece',
   'Manga petualangan berlarut yang terbit sejak 1997. Koleksi perpustakaan menyimpan satu volume.',
   'verified',
   'https://en.wikipedia.org/wiki/One_Piece',
   '2026-10-14')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `source_url` = VALUES(`source_url`),
  `verified_at` = VALUES(`verified_at`);

-- ---------------------------------------------------------------------
-- Isi seri - Serial Bumi (urutan dari Wikipedia + Goodreads)
-- book_id NULL = belum ada di katalog LUMEN
-- ---------------------------------------------------------------------
INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 1 AS s, (SELECT id FROM books WHERE title = 'Bumi' LIMIT 1) AS b, 1 AS p, 'Diterbitkan 2014' AS n
  UNION ALL SELECT 1, (SELECT id FROM books WHERE title = 'Bulan' LIMIT 1), 2, '2015'
  UNION ALL SELECT 1, (SELECT id FROM books WHERE title = 'Matahari' LIMIT 1), 3, '2016'
  UNION ALL SELECT 1, (SELECT id FROM books WHERE title = 'Bintang' LIMIT 1), 4, '2017'
  UNION ALL SELECT 1, NULL, 5, 'Ceros dan Batozar, 2018'
  UNION ALL SELECT 1, NULL, 6, 'Komet, 2018'
  UNION ALL SELECT 1, NULL, 7, 'Komet Minor, 2019'
  UNION ALL SELECT 1, NULL, 8, 'Selena, 2020'
  UNION ALL SELECT 1, NULL, 9, 'Nebula, 2020'
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

-- ---------------------------------------------------------------------
-- Isi seri - Serial Aksi
-- ---------------------------------------------------------------------
INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 2 AS s, NULL AS b, 1 AS p, 'Negeri Para Bedebah, 2012 - alur Thomas' AS n
  UNION ALL SELECT 2, NULL, 2, 'Negeri di Ujung Tanduk, 2013 - alur Thomas'
  UNION ALL SELECT 2, NULL, 3, 'Pulang, 2015 - alur Bujang'
  UNION ALL SELECT 2, NULL, 4, 'Pergi, 2018 - alur Bujang'
  UNION ALL SELECT 2, NULL, 5, 'Pulang-Pergi, 2021 - titik pertemuan Thomas & Bujang'
  UNION ALL SELECT 2, NULL, 6, 'Bedebah di Ujung Tanduk, 2022 - alur Thomas'
  UNION ALL SELECT 2, NULL, 7, 'Tanah Para Bandit - alur Bedebah'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `book_series_items` i WHERE i.series_id = seed.s AND i.position = seed.p
);

-- ---------------------------------------------------------------------
-- Isi seri - Trilogi Laskar Pelangi
-- Hanya Laskar Pelangi yang ada di koleksi LUMEN.
-- ---------------------------------------------------------------------
INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 3 AS s, (SELECT id FROM books WHERE title = 'Laskar Pelangi' LIMIT 1) AS b, 1 AS p, '2005' AS n
  UNION ALL SELECT 3, NULL, 2, 'Sang Pemimpi, 2006 (cetakan 2021 menggabungkan dengan Edensor)'
  UNION ALL SELECT 3, NULL, 3, 'Edensor, 2007'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `book_series_items` i WHERE i.series_id = seed.s AND i.position = seed.p
);

-- ---------------------------------------------------------------------
-- Isi seri - One Piece
-- ---------------------------------------------------------------------
INSERT INTO `book_series_items` (`series_id`, `book_id`, `position`, `note`)
SELECT * FROM (
  SELECT 4 AS s, (SELECT id FROM books WHERE title = 'One Piece Volume 1' LIMIT 1) AS b, 1 AS p,
         'Volume 1'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `book_series_items` i WHERE i.series_id = seed.s AND i.position = seed.p
);
