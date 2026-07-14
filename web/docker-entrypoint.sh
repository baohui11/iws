#!/bin/sh
set -eu

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  node scripts/migrate-runtime.mjs
fi

if [ "${SEED_ADMIN_ON_STARTUP:-true}" = "true" ]; then
  node scripts/seed-admin.mjs
fi

if [ "${SEED_WEEKS_ON_STARTUP:-true}" = "true" ]; then
  node scripts/seed-weeks.mjs
fi

exec "$@"
