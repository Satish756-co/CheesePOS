#!/bin/bash
# CheesePOS – Full deployment with SSL
# Usage: bash deployment/deploy.sh yourdomain.com your@email.com
set -e

DOMAIN=${1:?"Usage: $0 <domain> <email>"}
EMAIL=${2:?"Usage: $0 <domain> <email>"}

echo "==> Deploying CheesePOS for domain: $DOMAIN"

# 1. Inject domain into nginx HTTPS config
sed -i "s/YOUR_DOMAIN_HERE/$DOMAIN/g" deployment/nginx.conf.https
echo "    nginx.conf.https updated with $DOMAIN"

# 2. Start backend + frontend (no nginx yet)
docker compose up -d postgres redis backend frontend
echo "    Backend + frontend started"

# 3. Temporary HTTP nginx for ACME challenge
cat > /tmp/nginx-init.conf << EOF
worker_processes 1;
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 200 'CheesePOS initializing...'; add_header Content-Type text/plain; }
    }
}
EOF

docker run --rm -d \
  --name nginx-init \
  -p 80:80 \
  -v /tmp/nginx-init.conf:/etc/nginx/nginx.conf:ro \
  -v certbot_www:/var/www/certbot \
  nginx:alpine
echo "    Temporary HTTP nginx started for ACME challenge"

# 4. Obtain SSL certificate
docker run --rm \
  -v certbot_conf:/etc/letsencrypt \
  -v certbot_www:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"
echo "    SSL certificate obtained"

# 5. Stop temp nginx, activate production HTTPS config
docker stop nginx-init
cp deployment/nginx.conf.https deployment/nginx.conf
docker compose up -d nginx
echo "    Production nginx started with HTTPS"

echo ""
echo "==> Done! CheesePOS is live at https://$DOMAIN"
