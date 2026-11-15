#!/bin/bash
# BarPro POS – First-time setup script
set -e

echo "=============================="
echo "  BarPro POS – Initial Setup"
echo "=============================="

# Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ .env file created from .env.example"
  echo "⚠️  Edit .env with your real credentials before production use"
fi

# Build and start containers
echo ""
echo "Starting Docker containers..."
docker-compose up -d postgres redis

echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U barpro_user -d barpro_db 2>/dev/null; do
  sleep 2
done

echo ""
echo "Running database migrations..."
docker-compose run --rm backend flask db upgrade

echo ""
echo "Creating tables and seeding data..."
docker-compose run --rm backend flask init-db
docker-compose run --rm backend flask seed-plans
docker-compose run --rm backend flask create-superadmin

echo ""
echo "Starting all services..."
docker-compose up -d

echo ""
echo "=============================="
echo "  Setup Complete!"
echo "=============================="
echo ""
echo "Application URLs:"
echo "  Frontend:    http://localhost:3000"
echo "  Backend API: http://localhost:5000/api/health"
echo ""
echo "Default Super Admin:"
echo "  Email:    admin@barpro.in"
echo "  Password: Admin@123"
echo ""
echo "⚠️  Change the default password immediately!"
echo "=============================="
