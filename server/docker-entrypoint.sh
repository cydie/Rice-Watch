#!/bin/sh
set -e

echo "Waiting for Postgres and syncing schema..."
i=0
until npx prisma db push --skip-generate; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "Database did not become ready in time."
    exit 1
  fi
  echo "Database not ready yet (attempt $i)..."
  sleep 2
done

echo "Starting RiceWatch API..."
exec node dist/index.js
