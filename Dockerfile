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
ENV APP_PORT=3000

# Production dependencies
COPY package.json ./
RUN bun install --production

# Backend source
COPY src ./src

# Frontend build output
COPY --from=builder /app/public ./public

# Config files & Startup Entrypoint
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD bun --eval "fetch(\`http://localhost:\${process.env.APP_PORT || process.env.PORT || 3000}/health\`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["/bin/sh", "/app/docker-entrypoint.sh"]
