# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------
# Stage 1 — build the Vite frontend
# ---------------------------------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/. .
RUN npm run build

# ---------------------------------------------------------------------
# Stage 2 — production image: Node API + static assets + Prisma-less DB client
# ---------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# Install only production deps for the backend.
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm i -g serve 2>/dev/null || true

# Backend source.
COPY backend/src ./src
COPY backend/drizzle.config.* ./
COPY backend/tsconfig.json ./
COPY backend/.env.example ./.env.example 2>/dev/null || true

# Built frontend.
COPY --from=frontend-build /build/dist ./public

# We ship typed backend via tsx runtime; ensure it is available.
RUN npm i --no-save tsx >/dev/null 2>&1 || true

EXPOSE 4000

# Honour Render/Railway-provided PORT; default to 4000.
ENV PORT=4000
ENV NODE_ENV=production

CMD ["sh", "-c", "npx tsx src/server.ts"]
