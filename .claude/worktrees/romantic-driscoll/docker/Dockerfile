# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Package files zuerst (besseres Layer-Caching)
COPY package*.json ./
COPY packages/shared/package*.json  ./packages/shared/
COPY packages/server/package*.json  ./packages/server/
COPY packages/client/package*.json  ./packages/client/

RUN npm ci

# Shared zuerst bauen (Dependency von server + client)
COPY packages/shared ./packages/shared
RUN npm run build -w packages/shared

# Server bauen
COPY packages/server ./packages/server
RUN npm run build -w packages/server

# Client bauen
COPY packages/client ./packages/client
RUN npm run build -w packages/client

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Nur Production-Dependencies
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
RUN npm ci --omit=dev -w packages/server

# Build-Artefakte
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./public

# Migrations (werden zur Laufzeit ausgeführt)
COPY --from=builder /app/packages/server/src/db/migrations ./packages/server/dist/db/migrations

VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/system/health || exit 1

CMD ["node", "packages/server/dist/server.js"]
