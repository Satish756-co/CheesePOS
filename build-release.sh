#!/bin/bash
# Build a fully obfuscated, self-contained release for local customer distribution.
# Usage: bash build-release.sh [version]
# Output: ./release/cheesepos-<version>/

set -e

VERSION=${1:-"v1.0.0"}
RELEASE_DIR="./release/cheesepos-${VERSION}"

echo "=========================================="
echo " CheesePOS Release Builder — ${VERSION}"
echo "=========================================="

# ── 1. Clean previous build ──────────────────────────────────────────────────
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# ── 2. Obfuscate backend with PyArmor ────────────────────────────────────────
echo ""
echo "[1/4] Obfuscating backend Python code..."

if ! command -v pyarmor &> /dev/null; then
  echo "  Installing PyArmor..."
  pip install pyarmor --quiet
fi

# Obfuscate the app folder into a temp directory
OBFUSCATED_BACKEND="./release/.obfuscated_backend"
rm -rf "$OBFUSCATED_BACKEND"
mkdir -p "$OBFUSCATED_BACKEND"

cp -r backend "$OBFUSCATED_BACKEND/"
pyarmor gen -r "$OBFUSCATED_BACKEND/backend/app/" --output "$OBFUSCATED_BACKEND/backend/app_obf/"

# Replace the app folder with obfuscated version
rm -rf "$OBFUSCATED_BACKEND/backend/app"
mv "$OBFUSCATED_BACKEND/backend/app_obf/app" "$OBFUSCATED_BACKEND/backend/app"
cp -r "$OBFUSCATED_BACKEND/backend/app_obf/pyarmor_runtime_"* "$OBFUSCATED_BACKEND/backend/app/" 2>/dev/null || true
rm -rf "$OBFUSCATED_BACKEND/backend/app_obf"

echo "  Backend obfuscated."

# ── 3. Build Docker images ────────────────────────────────────────────────────
echo ""
echo "[2/4] Building Docker images (with JS obfuscation)..."

# Build frontend with obfuscation enabled
NODE_ENV=production docker compose build --no-cache frontend
docker compose build --no-cache backend

echo "  Images built."

# ── 4. Export images as tar files ────────────────────────────────────────────
echo ""
echo "[3/4] Exporting Docker images..."

docker save barpro-frontend:latest | gzip > "$RELEASE_DIR/cheesepos-frontend.tar.gz"
docker save barpro-backend:latest  | gzip > "$RELEASE_DIR/cheesepos-backend.tar.gz"

echo "  Images exported."

# ── 5. Write customer docker-compose.yml ─────────────────────────────────────
echo ""
echo "[4/4] Writing customer files..."

cat > "$RELEASE_DIR/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: barpro_db
      POSTGRES_USER: barpro_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U barpro_user -d barpro_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data

  backend:
    image: barpro-backend:latest
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://barpro_user:${DB_PASSWORD}@postgres:5432/barpro_db
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      SECRET_KEY: ${SECRET_KEY}
      SUPER_ADMIN_EMAIL: ${SUPER_ADMIN_EMAIL}
      SUPER_ADMIN_PASSWORD: ${SUPER_ADMIN_PASSWORD}
      MAIL_USERNAME: ${MAIL_USERNAME}
      MAIL_PASSWORD: ${MAIL_PASSWORD}
      CORS_ORIGINS: "http://localhost:3000"
    volumes:
      - uploads_data:/app/uploads

  frontend:
    image: barpro-frontend:latest
    restart: always
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
  uploads_data:
EOF

cat > "$RELEASE_DIR/.env.example" << 'EOF'
# Database
DB_PASSWORD=change_this_strong_password

# Security — generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=change_this_to_a_random_64char_string
SECRET_KEY=change_this_to_another_random_string

# Super Admin login
SUPER_ADMIN_EMAIL=admin@yourbusiness.com
SUPER_ADMIN_PASSWORD=change_this_strong_password

# Email (Gmail app password for password reset emails)
MAIL_USERNAME=youremail@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
EOF

cat > "$RELEASE_DIR/SETUP.txt" << 'EOF'
===========================================
  CheesePOS — Local Installation Guide
===========================================

REQUIREMENTS
------------
- Docker Desktop (download: https://www.docker.com/products/docker-desktop)
- Windows 10/11, macOS, or Linux

STEP 1 — Load the images
-------------------------
Open a terminal in this folder and run:

  docker load < cheesepos-frontend.tar.gz
  docker load < cheesepos-backend.tar.gz

STEP 2 — Configure
-------------------
Copy .env.example to .env and fill in your details:

  copy .env.example .env      (Windows)
  cp .env.example .env        (Mac/Linux)

Edit .env with a text editor and set strong passwords.

STEP 3 — First-time setup
--------------------------
  docker compose up -d
  docker compose exec backend flask setup

STEP 4 — Open the app
---------------------
Go to: http://localhost:3000

Log in with the SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD you set in .env.

DAILY USAGE
-----------
Start:  docker compose up -d
Stop:   docker compose down   (data is kept)

SUPPORT
-------
Email: cheesepossupport@gmail.com
===========================================
EOF

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo " Release ready: $RELEASE_DIR"
echo ""
echo " Contents:"
ls -lh "$RELEASE_DIR"
echo ""
echo " Share the entire '$(basename $RELEASE_DIR)' folder with the customer."
echo "=========================================="
