#!/bin/sh
set -e

echo "⏳ Checking connection to PostgreSQL ($DATABASE_URL)..."

# Extract hostname from DATABASE_URL or default to 'db'
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

# Wait for DB to be reachable
count=0
max_retries=30
until nc -z -w 2 "$DB_HOST" "$DB_PORT" || [ $count -ge $max_retries ]; do
  echo "⏳ PostgreSQL is not ready yet - waiting... ($count/$max_retries)"
  sleep 1
  count=$((count+1))
done

if [ $count -ge $max_retries ]; then
  echo "⚠️ Warning: DB connection timeout. Attempting migration anyway..."
fi

echo "🚀 Running database schema migrations and master seeds..."
npm run db:migrate || echo "⚠️ Migration exited with code $?"

echo "✅ Backend initialization complete. Starting server..."
exec "$@"
