#!/usr/bin/env bash
# PIFinder server deploy helper. Run ON the club server inside the repo dir:
#   cd /home/stem/apps/PIFinder && ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Create it (do NOT commit it)." >&2
  exit 1
fi

echo "→ pulling latest"
git pull --ff-only

echo "→ building & starting containers"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "→ applying database migrations"
if command -v node >/dev/null 2>&1; then
  node --env-file=.env.production scripts/db-migrate.mjs
else
  echo "node not found on host; run migrations from a machine with psql + SUPABASE_DB_URL." >&2
fi

echo "✓ deploy complete"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
