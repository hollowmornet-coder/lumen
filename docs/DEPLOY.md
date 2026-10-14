# Deploy LUMEN ke cloud gratis (durasi 7 hari)

Ringkasan opsi tercepat & aman untuk demo/ujian, **tanpa port 24x7 uptime**: free tier Render "hibernates" setelah 15 menit tidak aktif (masih hidup sewaktu-sewaktu).

## Opsi A — Render.com (satu service, frontend + backend + DB di cloud)

1. **Database**: akses TiDB Cloud Free (https://tidbcloud.com), buat cluster Serverless (gratis 5GB), masuk ke Data Export -> import `database.sql` di folder root repo.
2. **Source** di GitHub (fork/private) atau push ke repo GitHub Anda:
   ```
   git init && git add . && git commit -m "initial"
   ```
3. Buat service **Web Service** di Render, pilih repo dan env Docker (otomatis membaca `render.yaml`).
4. Set env vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGIN=https://<domain>.onrender.com`.
5. Deploy → tunggu build ~5 menit → domain onrender.com.

## Opsi B — Railway.app (trial USD 5, paling dekat dengan prod-like)

1. Buat proyek Railway → “New → Deploy from Sketch”.
2. Tambah MariaDB (built-in) + import `database.sql`.
3. Link termasuk perintah pengaturan variabel (hubungan \_.env).
4. Railway menyediakan frontend + backend sekaligus.

## Kenapa Vercel tidak cocok langsung

- Backend Express & koneksi DB bukan serverless by default.
- Akses subdomain `lumen.vercel.app` sudah jauh kemungkinan dipakai dan susah diambil.
- Jika memakai Vercel, minimal full rewrite jadi Vercel Function + TiDB — pekerjaan sedang.

## Command untuk push cepat

```
cd D:\UKK
git init
git add Dockerfile render.yaml database.sql backend/src backend/package*.json frontend/package*.json frontend/vite.config.ts
git commit -m "lumen deployable"
```
Upload ke GitHub lalu sambung di Render / Railway.
