#!/bin/bash
# Fix broken Brand SVGs - re-download with correct Wikimedia URLs
# Run: bash scripts/fix-brand-icons.sh

set -e
PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WIKI_DIR="$PROJ_DIR/packages/client/public/icons/brands"

echo "=== Fixing Brand SVGs ==="
mkdir -p "$WIKI_DIR"

# Dolby family (using best versions with full logos)
echo "  ↓ dolby-atmos.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/a/a8/Dolby_Atmos_%28logo%29.svg" -o "$WIKI_DIR/dolby-atmos.svg"
echo "  ↓ dolby-vision.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/3/3f/Dolby_Vision_%28logo%29.svg" -o "$WIKI_DIR/dolby-vision.svg"
echo "  ↓ dolby-digital.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/3/3e/Dolby-Digital-Logo_2009.svg" -o "$WIKI_DIR/dolby-digital.svg"
echo "  ↓ dolby-digital-plus.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/e/ef/Dolby-Digital-Plus.svg" -o "$WIKI_DIR/dolby-digital-plus.svg"
echo "  ↓ dolby-truehd.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/9/90/Dolby_TrueHD.svg" -o "$WIKI_DIR/dolby-truehd.svg"
echo "  ↓ dolby-logo.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/3/32/Dolby_logo.svg" -o "$WIKI_DIR/dolby-logo.svg"

# DTS family
echo "  ↓ dts.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/0/06/DTS_%282020%29.svg" -o "$WIKI_DIR/dts.svg"
echo "  ↓ dts-hdma.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/b/bd/DTS-HD-MA.svg" -o "$WIKI_DIR/dts-hdma.svg"

# Video Codecs
echo "  ↓ av1.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/8/84/AV1_logo_2018.svg" -o "$WIKI_DIR/av1.svg"
echo "  ↓ vp9.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/c/c7/Vp9-logo-for-mediawiki.svg" -o "$WIKI_DIR/vp9.svg"
echo "  ↓ h264.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/c/cd/H.264%2C_MPEG-4_AVC_logo.svg" -o "$WIKI_DIR/h264.svg"
echo "  ↓ hevc.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/2/2f/X265_%28HEVC_encoder%2C_logo%29.svg" -o "$WIKI_DIR/hevc.svg"

# HDR
echo "  ↓ hdr10.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/d/df/HDR_10_logo_%28black%29.svg" -o "$WIKI_DIR/hdr10.svg"
echo "  ↓ hdr10plus.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/3/39/HDR10%2B_Logo.svg" -o "$WIKI_DIR/hdr10plus.svg"

# Audio Codecs
echo "  ↓ opus.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/0/02/Opus_logo2.svg" -o "$WIKI_DIR/opus.svg"
echo "  ↓ flac.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/a/a2/FLAC_logo_vector.svg" -o "$WIKI_DIR/flac.svg"
echo "  ↓ aac.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/e/e0/AAC_original_logo.svg" -o "$WIKI_DIR/aac.svg"

# Other
echo "  ↓ imax.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/1/17/IMAX.svg" -o "$WIKI_DIR/imax.svg"
echo "  ↓ thx.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/5/54/THX_logo.svg" -o "$WIKI_DIR/thx.svg"
echo "  ↓ bluray.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/d/d5/Blu-ray_Disc.svg" -o "$WIKI_DIR/bluray.svg"
echo "  ↓ uhd-bluray.svg"
curl -sL "https://upload.wikimedia.org/wikipedia/commons/f/f9/Ultra_HD_Blu-ray_%28logo%29.svg" -o "$WIKI_DIR/uhd-bluray.svg"

# Verify all are real SVGs
echo ""
echo "=== Verification ==="
GOOD=0; BAD=0
for f in "$WIKI_DIR"/*.svg; do
  name=$(basename "$f")
  if head -5 "$f" | grep -q '<svg\|<?xml'; then
    GOOD=$((GOOD+1))
  else
    echo "  ❌ $name is NOT a valid SVG"
    BAD=$((BAD+1))
  fi
done
echo "  ✅ $GOOD valid SVGs, ❌ $BAD broken"
