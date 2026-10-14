# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY --from=frontend-build /build/dist ./public
EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production
CMD ["sh", "-c", "npx tsx src/server.ts"]
