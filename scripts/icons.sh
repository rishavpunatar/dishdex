#!/bin/sh
# Regenerates PNG app icons from scripts/icon.svg (needs rsvg-convert: brew install librsvg).
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
sed 's/SCALE/1/' scripts/icon.svg > "$tmp/full.svg"
sed 's/SCALE/0.72/' scripts/icon.svg > "$tmp/mask.svg"
# Rounded variant for favicon / Android legacy icon
sed -e 's/SCALE/1/' -e 's/<rect width="512" height="512"/<rect width="512" height="512" rx="128"/' scripts/icon.svg > public/favicon.svg
rsvg-convert -w 192 -h 192 public/favicon.svg -o public/pwa-192.png
rsvg-convert -w 512 -h 512 public/favicon.svg -o public/pwa-512.png
rsvg-convert -w 512 -h 512 "$tmp/mask.svg" -o public/maskable-512.png
rsvg-convert -w 180 -h 180 "$tmp/full.svg" -o public/apple-touch-icon.png
rm -rf "$tmp"
echo "icons written to public/"
