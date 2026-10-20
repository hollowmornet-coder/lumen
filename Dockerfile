# syntax=docker/dockerfile:1

# ---------- 1. Build frontend ----------
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- 2. Build backend (TypeScript -> dist) ----------
FROM node:20-alpine AS backend-build
WORKDIR /build
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---------- 3. Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Hanya dependensi produksi. TypeScript & tsx tidak ikut, karena hasil
# kompilasi sudah tersedia di ./dist.
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=backend-build /build/dist ./dist
COPY --from=frontend-build /build/dist ./public

# Tempat penyimpanan cover yang diunggah. Mount volume di sini agar berkas
# tidak hilang saat container dibuat ulang.
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 4000

# Healthcheck memakai endpoint yang sudah ada, bukan asumsi "port terbuka".
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
