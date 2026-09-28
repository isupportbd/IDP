#!/bin/sh

# Auto-migrate database tables and sync initial setup
if [ -n "$DATABASE_URL" ]; then
  echo "=> Syncing database migrations..."
  bun run maker db:migrate:run || true
  bun src/database/init-superadmin-db.ts || true
fi

# Start IDP-V2 server
echo "=> Starting IDP-V2 server on port ${APP_PORT:-80}..."
exec bun src/framework/server.ts
