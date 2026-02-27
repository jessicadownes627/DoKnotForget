#!/usr/bin/env bash
set -euo pipefail

INPUT="${1:-assets/source/dkf-ribbon-k-source.png}"

OUT_LOGO="assets/logo"
OUT_APPICON="assets/appicon"

BIN="/tmp/dkf_brand_assets"

clang -O2 \
  -framework Foundation \
  -framework CoreGraphics \
  -framework ImageIO \
  scripts/generate_dkf_brand_assets.m \
  -o "$BIN"

"$BIN" --keep-background --input "$INPUT" --out-logo "$OUT_LOGO" --out-appicon "$OUT_APPICON"
