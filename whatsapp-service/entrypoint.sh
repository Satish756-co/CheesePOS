#!/bin/sh
# Remove stale Chromium profile locks from previous container runs.
# These locks cause "profile in use by another computer" errors on restart.
find /app/sessions -name "SingletonLock"   -delete 2>/dev/null || true
find /app/sessions -name "SingletonSocket" -delete 2>/dev/null || true
echo "Session locks cleaned"
exec node server.js
