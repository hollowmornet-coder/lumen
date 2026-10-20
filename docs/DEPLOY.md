# Deploy LUMEN ke cloud gratis (durasi 7 hari)

Ringkasan opsi tercepat & aman untuk demo/ujian, **tanpa port 24x7 uptime**:
free tier Render "hibernates" setelah 15 menit tidak aktif (masih hidup
sewaktu-waktu).

> **Penting:** backend membaca variabel `DB_HOST`, `DB_PORT`, `DB_USER`,
> `DB_PASSWORD`, `DB_NAME`, dan `CORS_ORIGIN`. Backend **tidak** memahami
> `DATABASE_URL`. Saat mengisi environment di platform mana pun, pakai nama
> variabel tersebut satu per satu.

## Opsi A — Render.com (satu service, frontend + backend + DB di cloud)

1. **Database**: akses TiDB Cloud Free (https://tidbcloud.com), buat cluster
   Serverless (gratis 5GB), lalu **Import** `database.sql` di folder root repo.
2. **Source** di GitHub (fork/private) atau push ke repo GitHub Anda:
   ```
   git init && git add . && git commit -m "initial"
   ```
3. Buat service **Web Service** di Render, pilih repo dan env Docker (otomatis
   membaca `render.yaml`).
4. Set env vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
   `JWT_SECRET`, `CORS_ORIGIN=https://<domain>.onrender.com`.
5. Deploy → tunggu build ~5 menit → domain onrender.com.

> `database.sql` memakai `USE lumen_db`, jadi impor akan menimpa basis data
> bernama itu. Pada TiDB, sesuaikan nama basis data di baris `CREATE DATABASE`
> dan `USE` bila cluster Anda memakai nama lain.

## Opsi B — Railway.app (trial USD 5, paling dekat dengan prod-like)

1. Buat proyek Railway → **New → Deploy from GitHub**.
2. Tambah MariaDB (built-in) + import `database.sql`.
3. Isi variabel environment: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`, `JWT_SECRET`, `CORS_ORIGIN`.
4. Railway menyediakan frontend + backend sekaligus.

## Kenapa Vercel tidak cocok langsung

- Backend Express & koneksi DB bukan serverless by default.
- Akses subdomain `lumen.vercel.app` sudah jauh kemungkinan dipakai dan susah
  diambil.
- Jika memakai Vercel, minimal full rewrite jadi Vercel Function + TiDB —
  pekerjaan sedang. Berkas `vercel.json` dan `api/index.ts` disertakan sebagai
  titik awal, bukan konfigurasi yang sudah terbukti jalan.

## Catatan Docker

`Dockerfile` melakukan tiga tahap:

1. **build frontend** — `npm ci` + `npm run build` di `frontend/`.
2. **build backend** — `npm ci` + `npm run build` (TypeScript → `dist/`) di
   `backend/`, lalu `npm ci --omit=dev` untuk dependensi runtime saja.
3. **runtime** — hanya `dist/`, `node_modules` produksi, dan hasil build
   frontend yang disalin ke `public/`. Backend dijalankan dengan
   `node dist/server.js`.

Konsekuensinya image runtime tidak membawa `tsx` maupun `typescript`. Sebelumnya
backend dijalankan dengan `npx tsx src/server.ts`, yang membuat image ikut
membawa transpiler hanya untuk dipakai sekali di setiap boot.

> **Cadangan & pemulihan di container:** fitur ini memanggil biner `mysqldump`
> dan `mysql`. Image runtime tidak menyertakannya secara default. Bila tombol
> cadangan/restore dipakai di deployment, instal `mariadb-client` pada tahap
> runtime, atau arahkan `MYSQLDUMP_PATH` / `MYSQLCLIENT_PATH` ke biner yang
> tersedia. Tanpa itu endpoint mengembalikan error yang menyebutkan biner mana
> yang tidak ditemukan — bukan kegagalan senyap.

## Command untuk push cepat

```
cd D:\UKK
git init
git add Dockerfile render.yaml database.sql backend/src backend/package*.json frontend/package*.json frontend/vite.config.ts
git commit -m "lumen deployable"
```

Upload ke GitHub lalu sambung di Render / Railway.
