# DKF brand asset generation

This repo generates logo + iOS app icon assets from the official ribbon “K” source image.

## 1) Add the source image

Save the high‑resolution source image into:

- `assets/source/dkf-ribbon-k-source.png`

Tip: Use the original, highest-quality file available (avoid chat screenshots).

## 2) Generate assets

Run:

```bash
chmod +x scripts/generate_dkf_brand_assets.sh
scripts/generate_dkf_brand_assets.sh assets/source/dkf-ribbon-k-source.png
```

Outputs:

- `assets/logo/dkf-ribbon-k.png` (transparent, centered)
- `assets/logo/dkf-ribbon-k.svg` (SVG wrapper embedding the PNG)
- `assets/logo/dkf-ribbon-k.pdf` (PDF wrapper)
- `assets/appicon/DKF.appiconset/` (PNG sizes + `Contents.json`)
- `assets/appicon/dkf-appicon-1024.png` (preview)

## 3) If the matte needs tuning

If the navy background isn’t fully removed or edges look clipped, try adjusting:

- `--matte-low` (lower = more aggressive transparency)
- `--matte-high` (higher = preserves more edge detail)

Example:

```bash
clang -O2 \
  -framework Foundation \
  -framework CoreGraphics \
  -framework ImageIO \
  scripts/generate_dkf_brand_assets.m \
  -o /tmp/dkf_brand_assets

/tmp/dkf_brand_assets \
  --input assets/source/dkf-ribbon-k-source.png \
  --matte-low 0.05 \
  --matte-high 0.16 \
  --out-logo assets/logo \
  --out-appicon assets/appicon
```
