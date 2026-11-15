#!/bin/bash
# BarPro VPS deployment script
# Usage: bash deployment/deploy.sh yourdomain.com your@email.com
set -e

DOMAIN=${1:?"Usage: $0 <domain> <email>"}
EMAIL=${2:?"Usage: $0 <domain> <email>"}

echo "==> Deploying BarPro for domain: $DOMAIN"

# 1. Replace DOMAIN_PLACEHOLDER in nginx.conf
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" deployment/nginx.conf
echo "    nginx.conf updated with $DOMAIN"

# 2. Start everything except nginx first (no certs yet)
docker compose up -d postgres redis backend frontend
echo "    Backend + frontend started"

# 3. Start nginx with a temporary HTTP-only config for the ACME challenge
cat > /tmp/nginx-init.conf << EOF
worker_processes 1;
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 200 'BarPro initializing...'; add_header Content-Type text/plain; }
    }
}
EOF

docker run --rm -d \
  --name nginx-init \
  -p 80:80 \
  -v /tmp/nginx-init.conf:/etc/nginx/nginx.conf:ro \
  -v barpro_certbot_www:/var/www/certbot \
  nginx:alpine
echo "    Temporary HTTP nginx started for ACME challenge"

# 4. Obtain the certificate
docker run --rm \
  -v barpro_certbot_conf:/etc/letsencrypt \
  -v barpro_certbot_www:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"
echo "    SSL certificate obtained"

# 5. Stop the temporary nginx
docker stop nginx-init
echo "    Temporary nginx stopped"

# 6. Start the real nginx (with HTTPS)
docker compose up -d nginx certbot
echo "    Production nginx started with HTTPS"

echo ""
echo "==> Done! BarPro is live at https://$DOMAIN"
echo "    Certificates auto-renew every 12 hours."
