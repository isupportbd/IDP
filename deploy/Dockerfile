ARG BUN_VERSION=latest
FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /app

ARG UI=true
ENV UI=${UI}

COPY package.json ./
RUN bun install

COPY . .

# শুধু Vue/Vite frontend build (backend এ compile নেই)
RUN bun run build:ui

# ── Production Stage ─────────────────────────────────────────
FROM oven/bun:${BUN_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production

# Production dependencies only
COPY package.json ./
RUN bun install --production

# Backend source — Bun TypeScript সরাসরি চালায়
COPY src ./src

# Frontend build output
COPY --from=builder /app/public ./public

# Config files
COPY drizzle.config.ts ./
COPY tsconfig.json ./

EXPOSE 80 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD bun --eval "fetch(\`http://localhost:\${process.env.APP_PORT || 80}/health\`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "src/framework/server.ts"]
