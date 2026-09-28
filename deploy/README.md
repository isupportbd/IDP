# Deploy

Generated from current project .env.

- Database mode: postgres
- Redis enabled: no
- Runtime: bun

## Prerequisites

- External docker networks exist:

```bash
docker network create nginx-proxy || true
docker network create infra || true
```

- Proxy stack from `server-setup` is running (jwilder + letsencrypt companion).

## Start app stack

```bash
docker compose --env-file deploy/server/.env --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

Equivalent maker command:

```bash
bun maker deploy:workflow --app-only
```

## DB Import

Import SQL dump into local Docker container (auto-detects MySQL or PostgreSQL):

```bash
bun maker deploy:db:import --file=deploy/nexgen.sql --database=nexgen
```

PostgreSQL restores into a fresh database by default (drops and recreates the
target database first). Pass `--no-drop` to keep the existing database.

Import SQL dump into remote Docker container (auto-detects MySQL or PostgreSQL):

```bash
bun maker deploy:db:import:remote --config=deploy/workflow.remote.json --file=deploy/nexgen.sql --database=nexgen
```

## Runtime

Supervisor starts:

- API: `maker serve --prod --runtime=bun`
- Scheduler: `maker schedule:work --prod --runtime=bun`



This deploy style follows `server-setup` and `statistic_postgre` patterns (external `nginx-proxy` + `infra` networks).

