#!/bin/bash
# CheesePOS – First-time server setup script
set -e

echo "=============================="
echo "  CheesePOS – Initial Setup"
echo "=============================="

# Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ .env file created from .env.example"
  echo "⚠️  Edit .env with your real credentials before continuing"
  echo "    nano .env"
  exit 0
fi

# Build and start containers
echo ""
echo "Starting Docker containers..."
docker compose up -d postgres redis

echo "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U barpro_user -d barpro_db 2>/dev/null; do
  sleep 2
done

echo ""
echo "Creating tables and seeding data..."
docker compose run --rm backend flask init-db
docker compose run --rm backend flask seed-plans
docker compose run --rm backend flask create-superadmin

echo ""
echo "Running SQL migrations..."
for f in backend/migrations/*.sql; do
  echo "  Applying $f..."
  docker compose exec -T postgres psql -U barpro_user -d barpro_db < "$f"
done

echo ""
echo "Starting all services..."
docker compose up -d

echo ""
echo "=============================="
echo "  Setup Complete!"
echo "=============================="
echo ""
echo "Application running on port 80."
echo "Super admin email is set from your .env SUPER_ADMIN_EMAIL."
echo ""
echo "Next: run certbot to get SSL, then switch to nginx.conf.https"
echo "=============================="
