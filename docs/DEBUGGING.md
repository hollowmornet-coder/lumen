# Debugging — LUMEN

Dokumen ini mencatat masalah nyata yang ditemukan selama proses pengembangan,
penyebabnya, cara mendeteksinya, dan solusinya. **Semua masalah di bawah benar
terjadi dan benar telah diperbaiki** — bukan contoh karangan.

---

## Ringkasan

| # | Masalah | Gejala | Penyebab | Status |
|---|---|---|---|---|
| 1 | `mariadb-install-db` gagal | `FATAL ERROR: OpenSCManager failed (5)` | Meminta pendaftaran Windows Service (butuh admin) | Selesai |
| 2 | MariaDB tidak mau start | Server tidak pernah listen | BOM UTF-8 pada `my.ini` | Selesai |
| 3 | `tsc`/`vitest` rusak | `esbuild` tidak bisa jalan | npm 11 memblokir postinstall | Selesai |
| 4 | Syntax error SQL | `error ... near 'SELECT l.id, ...'` | `COUNT(*)` digabung dengan blok `SELECT` | Selesai |
| 5 | 404 saat membuat peminjaman | `"Transaksi tidak ditemukan."` | Baca di dalam transaksi belum di-commit | Selesai |
| 6 | 500 pada pembuatan transaksi | `Type 'number' is not assignable` | `return withTransaction` (bukan `await`) | Selesai |
| 7 | Validasi tidak jalan | ISBN tidak valid tetap `201` | Skema Zod tidak pernah dipasang | Selesai |
| 8 | Server crash saat start | `updateBookSchema.pick is not a function` | `.pick()` pada `ZodEffects` | Selesai |
| 9 | Impor data gagal | `Column 'isbn' cannot be null` | Efek samping #7 | Selesai |
| 10 | `@/` tidak dikenali TS | `TS2307 Cannot find module '@/lib/api'` | `paths` belum ada di `tsconfig.app.json` | Selesai |
| 11 | Uji gagal: ISBN ditolak | `got 201` lalu `404` | ISBN uji 15 digit (tes yang salah) | Selesai |
| 12 | Uji gagal: 429 | Login ditolak saat mengulang | Rate limit bekerja seperti desain | Dihandle |
| 13 | Denda tidak bisa dihitung | TS `possibly null` | `daysLate` belum di-narrow | Selesai |
| 14 | Getter tipe gagal | `Cannot read properties of undefined` | Getter pada objek hasil query | Selesai |
| 15 | Skrip uji gagal terparse | `The string is missing the terminator` | `.ps1` UTF-8 tanpa BOM dibaca ANSI | Selesai |
| 16 | Uji berulang gagal | `got 422` pada skenario peminjaman | Data sisa percobaan sebelumnya | Selesai |
| 17 | Token reset langsung kedaluwarsa | `TOKEN_INVALID` beberapa detik setelah dibuat | `toISOString()` (UTC) dibanding `NOW()` (lokal) | Selesai |
| 18 | Kode transaksi bertanggal kemarin | `LN-20261020-…` padahal tanggal 21 | `toISOString()` (UTC) untuk segmen tanggal | Selesai |
| 19 | Dasbor pagi hari kosong | Rentang tanggal berakhir "kemarin" | `isoDate` memakai UTC | Selesai |
| 20 | Build frontend gagal | `No qualified name in attribute selector` | Selector kelas dengan wildcard regex | Selesai |
| 21 | Rute opname 404 | `POST /api/opname` tidak ditemukan | Modul di-mount di `/opnames` (jamak) | Selesai |
| 22 | Peringatan bundel `sonner` | Impor dinamis tidak berguna | Sudah diimpor statis di tempat lain | Selesai |
| 23 | Impor 500 anggota terasa hang | Request ±40 detik | Satu hash bcrypt per baris | Selesai |

---

## 1. Inisialisasi MariaDB Gagal — `OpenSCManager failed (5)`

**Gejala**
```
Running bootstrap
Registering service 'LUMENDB'
mariadb-install-db.exe : FATAL ERROR: OpenSCManager failed (5)
```

**Penyebab**
Perintah `mariadb-install-db.exe --service=LUMENDB` mencoba mendaftarkan
Windows Service. API Service Control Manager (`OpenSCManager`) membutuhkan
 hak Administrator.

**Solusi**
Tidak memerlukan service. Jalankan `mysqld.exe` langsung sebagai proses:

```powershell
Start-Process -FilePath "$root\bin\mysqld.exe" `
  -ArgumentList "--defaults-file=$root\my.ini" -WindowStyle Hidden
```

Perintah inisialisasi yang berhasil:
```powershell
& "$root\bin\mariadb-install-db.exe" --datadir="$data" --password= --port=3307
```

**Pelajaran:** aplikasi tidak perlu service Windows untuk keperluan UKK.
Menjalankan proses secara langsung lebih sederhana dan tidak butuh hak admin.

---

## 2. MariaDB Tidak Mau Start — BOM pada `my.ini`

**Gejala**
```
mysql.exe : error: Found option without preceding group in config file:
D:\UKK\_vendor\mariadb-11.4.7-winx64\my.ini at line: 1
Fatal error in defaults handling. Program aborted.
```
`mysqld` juga tidak mau start, dan `data-error.log` tidak pernah dibuat.

**Penyebab**
`Set-Content -Encoding UTF8` di PowerShell 5.1 menulis **BOM** (3 byte
`EF BB BF`) di awal file. Parser INI MariaDB mengira baris pertama adalah
kelanjutan baris sebelumnya, sehingga gagal.

**Solusi**
Tulis tanpa BOM:
```powershell
[System.IO.File]::WriteAllText($path, $ini, (New-Object System.Text.UTF8Encoding($false)))
```

**Pelajaran:** di Windows PowerShell 5.1, `UTF8` berarti "UTF-8 dengan BOM".
Untuk berkas yang dibaca program lain, gunakan `UTF8Encoding($false)`.

---

## 3. `esbuild` Tidak Berjalan — npm 11 Memblokir Postinstall

**Gejala**
```
npm warn install-scripts  2 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts    esbuild@0.28.2 (postinstall: node install.js)
```
`tsx` dan `vitest` ikut mati karena keduanya bergantung pada `esbuild`.

**Penyebab**
npm 11.x menambah fitur `allowScripts`; demi keamanan, skrip `postinstall`
paket baru **tidak** dijalankan sampai diizinkan secara eksplisit.

**Solusi**
```bash
npm install-scripts approve esbuild
```

**Catatan tambahan:** peringatan deprecation `multer@1.x`
("impacted by a number of vulnerabilities") mendorong upgrade ke `multer@2`,
yang sudah berhasil dilakukan (`package.json` kini memakai `^2.0.0`).

---

## 4. Syntax Error SQL pada `listLoans`

**Gejala** (terekor di log server)
```
You have an error in your SQL syntax; ... near 'SELECT
    l.id, l.loan_code, l.user_id, l.book_id, l.quantity, l.status,
  ...' at line 3
    at listLoans (src/modules/loans/loans.service.ts:262:26)
```

**Penyebab**
Kueri jumlah data disusun dengan menempelkan `LOAN_SELECT` yang **sudah
memulai dengan `SELECT`**:

```ts
// SEBELUM (salah)
`SELECT COUNT(*) AS total ${LOAN_SELECT} ${whereSql}`
// → SELECT COUNT(*) AS total SELECT l.id, ... FROM ...   ✗
```

**Solusi**
Pisahkan bagian kolom dan bagian `FROM` agar bisa dipakai ulang:

```ts
const LOAN_FROM = `
  FROM loans l
  JOIN books b ON b.id = l.book_id
  ...`;

const LOAN_SELECT = `SELECT ... ${LOAN_FROM}`;

// SEBELUM SESUDAH
`SELECT COUNT(*) AS total ${LOAN_FROM} ${whereSql}`   // ✓
```

**Pelajaran:** string SQL yang di-template harus dipisah berdasarkan klausa
(`SELECT` vs `FROM`), bukan menyalin seluruh blok.

---

## 5. "Transaksi tidak ditemukan" Saat Membuat Peminjaman

**Gejala**
```
POST /api/loans  →  404  {"code":"NOT_FOUND","message":"Transaksi tidak ditemukan."}
```

**Penyebab**
Di dalam `withTransaction`, fungsi memanggil:

```ts
await withTransaction(async (conn) => {
  await conn.execute('INSERT INTO loans ...');
  const loan = await getLoanById(loanId);   // ← MASALAH
  return loan;
});
```

`getLoanById` memakai **koneksi lain** dari pool. Data yang baru di-`INSERT`
masih berada di dalam transaksi yang belum di-`COMMIT`, sehingga koneksi lain
**tidak melihatnya** (isolation level default MariaDB = `REPEATABLE READ`).

**Solusi**
Baca datanya **setelah** transaksi selesai:

```ts
let loanId = 0;
await withTransaction(async (conn) => {
  // ... INSERT ...
  loanId = Number(idRows[0].id);
});

const loan = await getLoanById(loanId);   // ← setelah COMMIT
return loan;
```

Pola yang sama diterapkan pada `approveLoan`, `confirmBorrow`, `rejectLoan`,
`cancelLoan`, `requestReturn`, dan `confirmReturn` (7 fungsi).

**Pelajaran:** di dalam transaksi, **selalu** gunakan objek `conn` yang sama
untuk membaca. Fungsi query yang memakai pool global hanya boleh dipanggil
setelah transaksi selesai.

---

## 6. 500 pada Semua Operasi Transaksi

**Gejala**
```
POST /api/loans  →  500
src/modules/loans/loans.service.ts(473,3): error TS2322:
  Type 'number' is not assignable to type 'Loan'.
```

**Penyebab**
Saat memperbaiki #5, hanya bagian **akhir** fungsi yang diubah, sedangkan
bagian **awal** masih `return withTransaction(...)`. Akibatnya fungsi
mengembalikan `Promise<number>` (hasil transaksi), bukan `Promise<Loan>`.
Di produksi, controller menerima angka lalu gagal saat akses `loan.book`.

**Solusi**
Ganti seluruh 7 kemunculan:
```ts
-  return withTransaction(async (conn) => {
+  await withTransaction(async (conn) => {
```

**Pelajaran:** perbaikan harus mempertimbangkan keseluruhan kode, bukan hanya baris yang
sedang diamati. Dokumentasi TypeScript (`npm run typecheck`) menangkap hal ini
—inilah gunanya pemeriksaan tipe otomatis.

---

## 7. Validasi Input Tidak Pernah Dijalankan

**Gejala**
```
ISBN tidak valid ditolak            got 201     ← seharusnya 422
Kata sandi lemah ditolak           got 201     ← seharusnya 422
Pencarian judul berfungsi           total=0
```

**Penyebab**
Skema Zod (`books.schema.ts`, `auth.schema.ts`, dll.) sudah **ditulis**, tetapi
middleware validasi belum pernah dibuat dan dipasang. Controller melakukan
*type assertion* yang tidak memvalidasi apa pun:

```ts
const body = req.body as CreateBookInput;   // hanya klaim tipe, bukan cek
```

Akibatnya `createBookSchema` sama sekali tidak pernah dipanggil.

**Solusi**
Membuat `middleware/validate.ts`:

```ts
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;   // diganti dengan hasil parse
    next();
  };
}
```

Lalu dipasang di setiap route, misalnya:
```ts
router.post('/books', requireAdmin, coverUpload.single('cover'),
             validateBody(createBookSchema), controller.create);
```

`errorHandler` sudah menangani `ZodError` → 422 dengan peta
`{ field: pesan }` per field.

**Pelajaran:** menulis skema validasi saja tidak cukup — harus ada mekanisme
yang memanggilnya. Asserted types (`as T`) hanya untuk compiler, bukan runtime.

---

## 8. Server Crash — `.pick is not a function`

**Gejala**
```
TypeError: import_books.updateBookSchema.pick is not a function
    at books.routes.ts:31
Node.js v24.21.0
```

**Penyebab**
`updateBookSchema` berakhir dengan `.refine(...)`, sehingga tipenya menjadi
`ZodEffects`, bukan `ZodObject`. `ZodEffects` **tidak** memiliki metode `.pick()`.

**Solusi**
Membuat skema khusus status, terpisah dari skema update:
```ts
export const bookStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], { errorMap: () => ({ message: '...' }) }),
});
```
Hal sama diterapkan untuk `memberStatusSchema` di modul anggota.

**Pelajaran:** `.refine()` mengubah tipe menjadi `ZodEffects` dan menutup akses
ke metode khusus `ZodObject` seperti `.pick()`, `.omit()`, dan `.partial()`.

---

## 9. `Column 'isbn' cannot be null`

**Gejala**
```
[ERROR] Unhandled error Column 'isbn' cannot be null
    at createBook (src/modules/books/books.service.ts:88:24)
```

**Penyebab**
Efek samping langsung dari #7: body tidak divalidasi, sehingga `input.isbn`
bernilai `undefined` dan diteruskan ke query sebagai `NULL`.

**Status:** Selesai otomatis setelah #7 diperbaiki.

---

## 10. Alias `@/` Tidak Dikenali TypeScript

**Gejala**
```
src/hooks/useApi.ts(8,31): error TS2307: Cannot find module '@/lib/api'
src/App.tsx(4,30): error TS2307: Cannot find module '@/features/auth/AuthContext'
... (sekitar 200 baris error serupa)
```

**Peny-cause**
`vite.config.ts` sudah mendefinisikan `resolve.alias`, sehingga **build Vite**
berjalan. Tetapi `tsconfig.app.json` (dari template Vite) tidak punya entri
`paths`, sehingga **pemeriksa tipe** tidak bisa me-resolve alias yang sama.

**Solusi**
```jsonc
"paths": { "@/*": ["./src/*"] },
"strict": true,
"lib": ["ES2023", "DOM", "DOM.Iterable"]
```

**Pelajaran:** alias harus didaftarkan **dua kali** — di konfigurasi bundler
*dan* di konfigurasi TypeScript. Salah satu saja akan menghasilkan pengalaman
yang membingungkan: build lolos, tetapi `tsc` gagal (atau sebaliknya).

---

## 11. Pengujian Gagal karena ISBN Uji Terlalu Panjang

**Gejala**
```
[FAIL] ISBN tidak valid ditolak  got 201
[SKIP] Gagal membuat buku uji:
```

**Analisis**
Validasi ISBN **benar** menolak input uji. Generator ISBN di skrip pengujian
menghasilkan 15 digit:

```
978-602-99-123456-1  →  978(3) + 602(3) + 99(2) + 123456(6) + 1(1) = 15 digit  ✗
```

**Solusi** — perbaiki skrip uji (bukan validasi):
```powershell
isbn = "978-602-$((Get-Random -Minimum 100000 -Maximum 999999))-1"   # 13 digit ✓
```

**Pelajaran:** pengujian bisa gagal karena **tesnya** yang salah, bukan kodenya.
Selalu periksa apakah kode atau asumsinya yang keliru sebelum mengubah
implementasi.

---

## 12. Rate Limit Menghentikan Pengujian Berulang — 429

**Gejala**
```
[FAIL] Login dengan kata sandi salah ditolak  got 429
[FAIL] Login admin berhasil                 got 429
```

**Analisis**
Ini **bukan bug** — `authLimiter` (20 percobaan / 15 menit / IP) bekerja
sesuai desain setelah beberapa kali pengujian berturut-turut, karena setiap
percobaan login gagal dihitung.

**Penanganan**
Karena store rate limiter bersifat in-memory, **memulai ulang server** akan
mengosongkan penghitung. Pengujian otomatis dijalankan setelah restart.

**Catatan:** `skipSuccessfulRequests: true` berarti login yang **berhasil**
tidak pernah dihitung, sehingga pengguna sah tidak pernah terkunci hanya karena
login berulang.

**Pelemahan untuk produksi:** memakai `express-rate-limit` dengan
`standardHeaders: true` sehingga klien melihat header `RateLimit-*` dan
`Retry-After`.

---

## 13. Kesalahan TypeScript pada Perhitungan Denda

**Gejala**
```
src/modules/loans/loans.service.ts(123,41): error TS18047:
  'daysLate' is possibly 'null'.
```

**Penyebab**
`daysLate` bisa `null` (bila `due_at` kosong atau transaksi sudah selesai),
tetapi dipakai langsung dalam perkalian.

**Solusi**
```ts
lateFee: settings && daysLate !== null && daysLate > 0
  ? daysLate * settings.lateFeePerDay
  : null,
```

**Pelajaran:** TypeScript menangkap jalur nilai `null` yang akan menghasilkan
`NaN` dihitungannya. Ini terlihat langsung di nilai yang ditampilkan pengguna.

---

## 14. Kesalahan pada Getter Tipe

**Gejala**
```
src/layouts/AppShell.tsx(416,11): error TS2339: Property 'data' does not exist
  on type '{ count: number; items: ... } | null'
src/hooks/useApi.ts(218,37): error TS2339: Property 'useSearchParams' does not
  exist on type 'typeof React'
```

**Penyebab**
- `usePendingCount()` mengembalikan objek secara langsung, tetapi dipanggil
  dengan `const { data } = ...` (mengurai properti yang tidak ada).
- `useSearchParams` berasal dari **`react-router-dom`**, bukan `React`.

**Solusi**
```ts
const data = usePendingCount(isAdmin);
```
```ts
import { useSearchParams } from 'react-router-dom';
const [params, setParams] = useSearchParams();
```

**Pelajaran:** mengaktifkan `strict` + `noUnusedLocals` Justru berguna —
banyak salah ketik yang lolos di `tsc` dan baru muncul saat tipenya diperketat.

---

## 15. Skrip PowerShell Gagal Terparse

**Gejala**
```
The string is missing the terminator: ".
At D:\UKK\scripts\api-test.ps1:291 char:118
```

**Penyebab**
Skrip `.ps1` ditulis sebagai UTF-8 **tanpa BOM**. Windows PowerShell 5.1
membaca berkas `.ps1` sebagai ANSI bila tidak ada BOM, sehingga karakter
berbahasa Indonesia (seperti `é`, `—`) menjadi byte aneh yang menutup string
sebelumnya.

**Solusi**
```powershell
[System.IO.File]::WriteAllText($p, $text, (New-Object System.Text.UTF8Encoding($true)))
```

**Pelajaran:** skrip yang berisi teks non-ASCII harus disimpan dengan BOM
apabila akan dijalankan dengan Windows PowerShell 5.1.

---

## 16. Polusi Data pada Pengujian Berulang

**Gejala**
```
[FAIL] Siswa dapat mengajukan peminjaman  got 422
```
ketika test pertama berhasil, test berikutnya gagal karena siswa masih punya
peminjaman `pending` atas buku yang sama — dan itu **benar**, karena sistem
memblokir permintaan ganda.

**Solusi**
Menjadikan pengujian dapat diulang: `api-test.ps1` mengimpor ulang
`database.sql` di awal (opsional `-SkipReset`), sehingga setiap dijalankan
memulai dari kondisi seed yang sama.

**Pelajaran:** pengujian harus bersifat deterministik. Data sisa dari
percobaan sebelumnya bukan bug aplikasi.

---

## 17. Token Reset Kata Sandi Langsung Kedaluwarsa

**Gejala**
Token yang baru dibuat ditolak dengan pesan "Token tidak valid atau sudah
kedaluwarsa", padahal baru beberapa detik sebelumnya.

**Penyebab**
`expires_at` diisi dari JavaScript:

```ts
const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString(); // UTC
```

`toISOString()` selalu menghasilkan waktu **UTC** dengan akhiran `Z`, sementara
kolom `DATETIME` dibandingkan dengan `NOW()` milik MySQL yang memakai **waktu
lokal** server (UTC+7). Selisih 7 jam itu jauh lebih besar daripada masa berlaku
30 menit, sehingga token dianggap kedaluwarsa sejak barisnya ditulis.

**Solusi**
Menyerahkan penulisan **dan** pemeriksaan waktu ke satu jam yang sama:

```sql
-- saat menulis
INSERT INTO password_resets (user_id, token_hash, expires_at)
VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE));

-- saat memeriksa
SELECT ... WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW();
```

**Pelajaran:** jangan mencampur jam aplikasi dengan jam database. Kalau kolom
dibandingkan terhadap `NOW()`, nilainya juga harus ditulis dengan `NOW()`.
Aturan yang sama dipakai untuk `due_at`, `pickup_deadline`, dan `expires_at`
pada reservasi — semuanya dihitung di SQL.

---

## 18. Kode Transaksi Bertanggal Kemarin

**Gejala**
Peminjaman yang dibuat pukul 01.00 tanggal 21 Oktober mendapat kode
`LN-20261020-E9A6FC` — bertanggal **20** Oktober.

**Penyebab**
```ts
const prefix = `LN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
```
`toISOString()` selalu UTC. Di Jakarta (UTC+7), pukul 01.00 tanggal 21 masih
pukul 18.00 tanggal 20 menurut UTC. Segmen tanggal pada kode jadi mundur satu
hari untuk **setiap transaksi yang dibuat sebelum pukul 07.00**.

**Solusi**
Segmen tanggal diambil dari MySQL, sumber waktu yang sama dengan `due_at`:
```ts
const [rows] = await conn.query("SELECT DATE_FORMAT(NOW(), '%Y%m%d') AS stamp");
const prefix = `LN-${rows[0].stamp}-`;
```

**Pelajaran:** kode yang terlihat "hanya kosmetik" tetap bug bila dibaca
manusia. Petugas menyortir berkas berdasarkan tanggal pada kode, jadi tanggal
yang salah membuat penelusuran ikut salah.

---

## 19. Dasbor Pagi Hari Terlihat Kosong

**Gejala**
Saat aplikasi dibuka sebelum pukul 07.00, grafik tren tidak memuat aktivitas
hari itu.

**Penyebab**
```ts
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
```
Rentang default adalah "30 hari terakhir sampai hari ini", tetapi `hari ini`
dihitung dalam UTC. Sebelum pukul 07.00 WIB, UTC masih menunjuk tanggal
kemarin, sehingga `to` berakhir kemarin dan data hari ini tersaring keluar.

**Solusi**
Format tanggal memakai komponen waktu lokal:
```ts
const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
```

Perbaikan yang sama diterapkan pada nama berkas ekspor Excel dan cadangan
`mysqldump` — keduanya dulu memakai tanggal UTC sehingga berkas yang dibuat
pagi hari diberi nama tanggal kemarin.

**Pelajaran:** satu pola (`toISOString().slice(0, 10)`) muncul di empat tempat
berbeda dan semuanya salah di zona waktu UTC+7. Setelah memperbaiki satu,
seluruh kode dicari dengan `grep toISOString` untuk menemukan saudara-saudaranya.

---

## 20. Build Frontend Gagal — Selector CSS Tidak Valid

**Gejala**
```
SyntaxError: [lightningcss minify] No qualified name in attribute selector: Delim('.').
2858 |    .max-h-\\[.*\\] {
```

**Penyebab**
Saat menulis aturan cetak, saya ingin "membuka" kontainer yang punya
`max-height`, lalu menulis selector kelas dengan wildcard gaya regex:

```css
.max-h-\[.*\] { max-height: none !important; }
```

CSS tidak mengenal wildcard di dalam nama kelas. Tailwind menghasilkan kelas
seperti `.max-h-96` dan `.max-h-\[60vh\]`, tetapi `.max-h-\[.*\]` bukan salah
satunya — ia hanya teks yang kebetulan terlihat mirip regex. Vite (mode dev)
sempat menerimanya; `lightningcss` saat build produksi menolaknya.

**Solusi**
Hapus selector karangan itu dan andalkan dua hal yang memang benar:

```css
.overflow-x-auto,
.overflow-y-auto { overflow: visible !important; max-height: none !important; }
```

**Pelajaran:** dev server yang "jalan baik-baik saja" bukan bukti CSS valid.
`npm run build` menjalankan minifier yang jauh lebih ketat, jadi build produksi
harus dijalankan sebelum menyatakan pekerjaan selesai — bukan sesudah.

---

## 21. Rute Opname 404 — Nama Modul Jamak

**Gejala**
`POST /api/opname` mengembalikan 404 padahal modulnya sudah ter-mount.

**Penyebab**
`routes/index.ts` memasang modul dengan bentuk jamak:

```ts
router.use('/opnames', opnameRoutes);
```

Frontend sudah memakai `/opnames`, tetapi uji API yang baru saya tulis memakai
`/opname`. Rute yang tidak ada memang dijawab 404 — bukan kesalahan server.

**Solusi**
Samakan seluruh pemanggil ke `/opnames`. Konvensi di proyek ini adalah **kata
benda jamak** untuk koleksi (`/books`, `/members`, `/loans`, `/holidays`,
`/visits`, `/announcements`, `/opnames`), jadi pemanggil barulah yang salah.

**Pelajaran:** saat menambah modul, cek `routes/index.ts` lebih dulu — satu baris
di sana menentukan seluruh URL publik modul tersebut.

---

## 22. Peringatan Bundel — `sonner` Diimpor Dinamis

**Gejala**
Saat build muncul peringatan bahwa `sonner` diimpor secara dinamis padahal juga
diimpor statis di tempat lain, sehingga pemisahan bundelnya tidak berguna.

**Penyebab**
Beberapa handler memakai `import('sonner').then(({ toast }) => …)` agar "tidak
membebani bundel", padahal `sonner` sudah diimpor statis di komponen lain. Bundler
tetap menggabungkannya, jadi yang tersisa hanyalah kode yang lebih sulit dibaca.

**Solusi**
Ganti seluruh pemakaian dengan satu `import { toast } from 'sonner'` di bagian atas
berkas, lalu panggil `toast.success(...)` langsung.

**Pelajaran:** dynamic import hanya menghemat sesuatu bila modul itu benar-benar
tidak pernah diimpor statis di bundel yang sama. Untuk pustaka kecil yang dipakai
di hampir setiap halaman, ia hanya menambah kompleksitas.

---

## 23. Impor Anggota 500 Baris Terasa "Hang"

**Gejala**
Rancangan awal menghitung satu kata sandi per baris. Berkas 500 siswa membuat
request berjalan sekitar 40 detik dan proksi/browser menyerah lebih dulu.

**Penyebab**
bcrypt sengaja lambat: sekitar 80 ms per hash pada cost yang dipakai. 500 hash
berurutan berarti 40 detik kerja CPU yang memblokir event loop.

**Solusi**
Satu kata sandi untuk **seluruh batch**, di-hash **sekali**, lalu ditandai dengan
`users.must_change_password = 1` sehingga setiap akun wajib menggantinya saat
login pertama. Kata sandi batch dikembalikan tepat satu kali di respons.

**Pelajaran:** biaya kriptografi yang benar untuk satu pengguna menjadi salah
untuk seribu pengguna. Ketika operasi massal memakai primitif yang lambat, ubah
bentuk operasinya (satu hash untuk banyak akun + kewajiban ganti), bukan menurunkan
cost keamanannya.

---

## Hasil Akhir Verifikasi

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Tipe backend | `npm run typecheck` | Lulus, 0 error |
| Build backend | `npm run build` | Lulus → `dist/server.js` |
| Tipe frontend | `npx tsc -p tsconfig.app.json --noEmit` | Lulus, 0 error |
| Build frontend | `npm run build` | Lulus → `dist/` |
| Uji API otomatis | `scripts\api-test.ps1` | **251/251 lulus** |
| Uji regresi sirkulasi | Manual via API (R1-R28) | **28/28 lulus** |

Lihat [`TESTING.md`](TESTING.md) untuk rincian skenario dan hasil.
