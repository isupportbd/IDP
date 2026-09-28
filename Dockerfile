ARG BUN_VERSION=latest
FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /app

ARG UI=true
ENV UI=${UI}

COPY package.json ./
RUN bun install

COPY . .

# Build Vue 3 / Vite Frontend
RUN bun run build:ui

# ── Production Stage ─────────────────────────────────────────
FROM oven/bun:${BUN_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production

# Production dependencies
COPY package.json ./
RUN bun install --production

# Backend source
COPY src ./src

# Frontend build output
COPY --from=builder /app/public ./public

# Config files
COPY drizzle.config.ts ./
COPY tsconfig.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["bun", "src/framework/server.ts"]
