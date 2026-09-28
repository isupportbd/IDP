#!/bin/sh

# Auto-migrate database tables and sync initial setup
if [ -n "$DATABASE_URL" ]; then
  echo "=> Running Drizzle migrations (db:migrate:run)..."
  bun src/framework/maker-cli/index.mjs db:migrate:run || echo "[WARN] Drizzle migrate:run failed or partially applied, continuing..."

  echo "=> Syncing database schema and SuperAdmin account..."
  bun src/database/init-superadmin-db.ts || echo "[WARN] SuperAdmin sync failed, continuing..."
fi

# Start IDP-V2 server
echo "=> Starting IDP-V2 server on port ${APP_PORT:-80}..."
exec bun src/framework/server.ts
