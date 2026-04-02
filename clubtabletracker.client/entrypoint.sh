#!/bin/sh
set -e

# Replace build-time placeholder with the runtime value of VITE_GOOGLE_CLIENT_ID.
# This allows pre-built images to receive the Google Client ID via docker-compose .env
# without needing to rebuild the image.
# Escape characters that are special in the sed replacement string when using | as delimiter.
ESCAPED_ID=$(printf '%s' "${VITE_GOOGLE_CLIENT_ID:-}" | sed 's/[|&\]/\\&/g')
find /usr/share/nginx/html -name "*.js" \
  -exec sed -i "s|__VITE_GOOGLE_CLIENT_ID__|${ESCAPED_ID}|g" {} +

# Replace Yandex.Metrika counter ID placeholder in index.html at runtime.
# Set YANDEX_METRIKA_ID in docker-compose .env to activate the counter without
# storing the ID in the repository.
ESCAPED_YM_ID=$(printf '%s' "${YANDEX_METRIKA_ID:-0}" | sed 's/[|&\]/\\&/g')
sed -i "s|__YANDEX_METRIKA_ID__|${ESCAPED_YM_ID}|g" /usr/share/nginx/html/index.html

nginx -g "daemon off;"
