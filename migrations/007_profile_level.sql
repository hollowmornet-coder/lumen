-- =====================================================================
--  LUMEN - Migrasi 007: Foto Profil & Level Anggota
--
--  Dua hal yang ditambahkan:
--
--    1. Foto profil    -> siswa dapat mengunggah foto sendiri (termasuk GIF)
--    2. Level anggota  -> tingkatan berdasarkan frekuensi peminjaman
--
--  Prinsip yang dipertahankan dari skema 001-006:
--    * Level TIDAK disimpan sebagai kolom. Ia diturunkan dari jumlah
--      peminjaman yang benar-benar diserahkan (`loans.borrowed_at`), sama
--      seperti `overdue` yang dihitung dari NOW(). Tidak ada angka yang
--      bisa basi karena lupa diperbarui.
--    * Foto profil hanya menyimpan PATH relatif. Berkasnya ada di disk
--      (`uploads/avatars`), bukan di dalam database, supaya dump SQL tetap
--      ringan dan bisa dipindahkan tanpa membawa biner.
--
--  Jalankan sekali:
--    mysql -u lumen_user -p lumen_db < migrations/007_profile_level.sql
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- (1) users.avatar_path
--
-- Contoh isi: `/uploads/avatars/3f9a...c1.gif`
-- NULL berarti anggota belum pernah mengunggah foto; klien menampilkan
-- inisial nama sebagai gantinya.
--
-- Kolom ini sengaja TIDAK menyimpan MIME type: ekstensi pada path sudah
-- ditentukan server dari magic bytes saat unggah, dan `express.static`
-- memakai ekstensi itu untuk header Content-Type.
-- ---------------------------------------------------------------------
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `avatar_path` VARCHAR(255) NULL
  COMMENT 'Path relatif foto profil di /uploads/avatars'
  AFTER `address`;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Catatan: ambang level ada di `backend/src/modules/levels/levels.ts`.
--
-- Ambang itu bukan aturan operasional (tidak mengubah hasil transaksi
-- apa pun), jadi tidak dimasukkan ke tabel `settings`. Yang tersimpan di
-- database hanyalah fakta yang dipakai untuk menghitungnya: riwayat
-- peminjaman. Mengubah ambang = mengubah satu konstanta di kode, dan
-- seluruh anggota langsung memakai kurva baru tanpa migrasi data.
-- ---------------------------------------------------------------------
