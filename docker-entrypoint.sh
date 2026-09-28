#!/bin/sh
set -e

# Start IDP-V2 server (kernel automatically runs database schema sync and SuperAdmin initialization on boot)
echo "=> Starting IDP-V2 server on port ${APP_PORT:-3000}..."
exec bun src/framework/server.ts
