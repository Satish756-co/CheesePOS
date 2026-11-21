#!/bin/sh
# Remove stale Chromium profile locks from previous container runs.
find /app/sessions -name "SingletonLock"   -delete 2>/dev/null || true
find /app/sessions -name "SingletonSocket" -delete 2>/dev/null || true
echo "Session locks cleaned"

# Pre-download WhatsApp Web from GitHub to bypass CDN restrictions on cloud servers.
# wppconnect-team mirrors every WhatsApp Web version at:
#   https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/<version>.html
mkdir -p /app/sessions/wa-cache

if ! ls /app/sessions/wa-cache/*.html 1>/dev/null 2>&1; then
  echo "No cached WA Web found — fetching from GitHub..."
  # Try to get the latest version tag from wppconnect-team
  LATEST=$(curl -sf --max-time 20 \
    "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/index.json" \
    | grep -o '"latest":"[^"]*"' | sed 's/"latest":"//;s/"//g') || LATEST=""

  [ -z "$LATEST" ] && LATEST="2.3000.1023002615"

  echo "Downloading WA Web v${LATEST}..."
  if curl -sf --max-time 60 \
      -o "/app/sessions/wa-cache/${LATEST}.html" \
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${LATEST}.html" && \
     [ -s "/app/sessions/wa-cache/${LATEST}.html" ]; then
    echo "Cached WA Web v${LATEST} ($(wc -c < /app/sessions/wa-cache/${LATEST}.html | tr -d ' ') bytes)"
    echo "$LATEST" > /app/sessions/wa-cache/.version
  else
    echo "Warning: pre-fetch failed — will fall back to CDN during init"
    rm -f "/app/sessions/wa-cache/${LATEST}.html"
  fi
else
  CACHED=$(ls /app/sessions/wa-cache/*.html 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/\.html//')
  echo "Using cached WA Web v${CACHED}"
fi

exec node server.js
