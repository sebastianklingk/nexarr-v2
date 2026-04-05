#!/bin/bash
# nexarr v2 – Icon Download Script
# Downloads all media icons from Tautulli GitHub + Wikimedia Commons
# Run from project root: bash scripts/download-icons.sh

set -e
PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ICON_DIR="$PROJ_DIR/packages/client/public/icons/media"
RATING_DIR="$PROJ_DIR/packages/client/public/icons/rating"
WIKI_DIR="$PROJ_DIR/packages/client/public/icons/brands"
TAUTULLI_RAW="https://raw.githubusercontent.com/Tautulli/Tautulli/master/data/interfaces/default/images"

echo "=== nexarr v2 Icon Downloader ==="
echo "Project: $PROJ_DIR"
echo ""

# ─── 1. Tautulli Rating SVGs ────────────────────────────────────
echo "▸ [1/3] Downloading Tautulli Rating SVGs..."
mkdir -p "$RATING_DIR"
for f in imdb.svg popcorn-spilled.svg popcorn-upright.svg themoviedb.svg thetvdb.svg tomato-ripe.svg tomato-rotten.svg; do
  echo "  ↓ $f"
  curl -sL "$TAUTULLI_RAW/rating/$f" -o "$RATING_DIR/$f"
done
echo "  ✓ $(ls "$RATING_DIR"/*.svg 2>/dev/null | wc -l) Rating SVGs"
echo ""

# ─── 2. Tautulli Media Flags PNGs ───────────────────────────────
echo "▸ [2/3] Downloading Tautulli Media Flag PNGs..."

# Video Codec
mkdir -p "$ICON_DIR/video_codec"
for f in h264 hevc mpeg1video mpeg2video mpeg4 vc1 wmv wmvhd; do
  curl -sL "$TAUTULLI_RAW/media_flags/video_codec/${f}.png" -o "$ICON_DIR/video_codec/${f}.png"
done
echo "  ✓ video_codec: $(ls "$ICON_DIR/video_codec"/*.png 2>/dev/null | wc -l) PNGs"

# Audio Codec
mkdir -p "$ICON_DIR/audio_codec"
for f in aac aif aifc aiff alac ape cdda dca-ma dolby_digital dolby_truehd dts eac3 flac m4a mlp mp2 mp3 mpc ogg pcm ra shn wav wave wma wmahd wmapro wmav2 wv; do
  curl -sL "$TAUTULLI_RAW/media_flags/audio_codec/${f}.png" -o "$ICON_DIR/audio_codec/${f}.png"
done
echo "  ✓ audio_codec: $(ls "$ICON_DIR/audio_codec"/*.png 2>/dev/null | wc -l) PNGs"

# Audio Channels
mkdir -p "$ICON_DIR/audio_channels"
for f in 1 2 5 6 7 8; do
  curl -sL "$TAUTULLI_RAW/media_flags/audio_channels/${f}.png" -o "$ICON_DIR/audio_channels/${f}.png"
done
echo "  ✓ audio_channels: $(ls "$ICON_DIR/audio_channels"/*.png 2>/dev/null | wc -l) PNGs"

# Video Resolution
mkdir -p "$ICON_DIR/video_resolution"
for f in 1080 1080i 270 360 432 468 480 480i 4k 540 544 576 576i 720 8k hdtv sd; do
  curl -sL "$TAUTULLI_RAW/media_flags/video_resolution/${f}.png" -o "$ICON_DIR/video_resolution/${f}.png"
done
echo "  ✓ video_resolution: $(ls "$ICON_DIR/video_resolution"/*.png 2>/dev/null | wc -l) PNGs"

# Content Rating (US only for now)
mkdir -p "$ICON_DIR/content_rating"
for f in "G" "NC-17" "NR" "Not Rated" "PG-13" "PG" "R" "TV-14" "TV-G" "TV-MA" "TV-PG" "TV-Y" "TV-Y7-FV" "TV-Y7" "Unrated" "X"; do
  curl -sL "$TAUTULLI_RAW/media_flags/content_rating/$(echo "$f" | sed 's/ /%20/g').png" -o "$ICON_DIR/content_rating/${f}.png"
done
echo "  ✓ content_rating: $(ls "$ICON_DIR/content_rating"/*.png 2>/dev/null | wc -l) PNGs"

echo ""

# ─── 3. Wikimedia Brand SVGs ────────────────────────────────────
echo "▸ [3/3] Downloading Wikimedia Brand SVGs..."
mkdir -p "$WIKI_DIR"

# Wikimedia Special:FilePath auto-redirects to the actual file
WIKI_BASE="https://commons.wikimedia.org/wiki/Special:FilePath"

declare -A WIKI_SVGS=(
  # Dolby family
  ["dolby-digital"]="Dolby-Digital-Logo%202009.svg"
  ["dolby-digital-plus"]="Dolby-Digital-Plus-Logo.svg"
  ["dolby-truehd"]="Dolby%20TrueHD.svg"
  ["dolby-atmos"]="Dolby%20Atmos%20(logo).svg"
  ["dolby-vision"]="Dolby%20Vision%20(logo).svg"
  ["dolby-logo"]="Dolby%20logo.svg"
  # DTS family
  ["dts"]="DTS%20(2020).svg"
  ["dts-hdma"]="DTS-HD-MA.svg"
  # Video Codecs
  ["av1"]="AV1%20logo%202018.svg"
  ["vp9"]="Vp9-logo-for-mediawiki.svg"
  ["h264"]="H.264%2C%20MPEG-4%20AVC%20logo.svg"
  ["hevc"]="X265%20(HEVC%20encoder%2C%20logo).svg"
  # HDR
  ["hdr10"]="HDR%2010%20logo%20(black).svg"
  ["hdr10plus"]="HDR10%2B%20Logo.svg"
  # Audio
  ["opus"]="Opus%20logo2.svg"
  ["flac"]="FLAC%20logo%20vector.svg"
  ["aac"]="AAC%20original%20logo.svg"
  # Other
  ["imax"]="IMAX.svg"
  ["thx"]="THX%20logo.svg"
  ["bluray"]="Blu-ray%20Disc.svg"
  ["uhd-bluray"]="Ultra%20HD%20Blu-ray%20(logo).svg"
)

for key in "${!WIKI_SVGS[@]}"; do
  file="${WIKI_SVGS[$key]}"
  echo "  ↓ $key.svg"
  curl -sL "$WIKI_BASE/$file" -o "$WIKI_DIR/$key.svg" 2>/dev/null || echo "    ⚠ Failed: $key"
done
echo "  ✓ $(ls "$WIKI_DIR"/*.svg 2>/dev/null | wc -l) Brand SVGs"
echo ""

# ─── 4. Generate ratingIcons.ts ─────────────────────────────────
echo "▸ Generating ratingIcons.ts..."
RATING_TS="$PROJ_DIR/packages/client/src/utils/ratingIcons.ts"
export RATING_DIR

node << 'NODEGEN' > "$RATING_TS"
const fs = require('fs');
const path = require('path');

const ratingDir = process.env.RATING_DIR || path.join(process.cwd(), 'packages/client/public/icons/rating');
const files = fs.readdirSync(ratingDir).filter(f => f.endsWith('.svg')).sort();

const lines = [
  '// Auto-generated from Tautulli rating icons',
  '// Source: https://github.com/Tautulli/Tautulli/tree/master/data/interfaces/default/images/rating',
  '// Run: bash scripts/download-icons.sh',
  '',
  'const icons: Record<string, string> = {',
];

for (const f of files) {
  const name = f.replace('.svg', '');
  let svg = fs.readFileSync(path.join(ratingDir, f), 'utf-8').trim();
  // Clean SVG
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');
  svg = svg.replace(/<\?xml[^?]*\?>/g, '');
  svg = svg.replace(/\s+/g, ' ').trim();
  svg = svg.replace(/>\s+</g, '><');
  // Escape backticks
  svg = svg.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  lines.push(`  '${name}': \`${svg}\`,`);
}

lines.push('};');
lines.push('');
lines.push('export type RatingSource =');
lines.push("  | 'imdb' | 'themoviedb' | 'thetvdb'");
lines.push("  | 'tomato-ripe' | 'tomato-rotten'");
lines.push("  | 'popcorn-upright' | 'popcorn-spilled';");
lines.push('');
lines.push('export function getRatingIcon(source: string): string | null {');
lines.push('  const s = source.toLowerCase().trim();');
lines.push('  if (icons[s]) return icons[s];');
lines.push('  // Aliases');
lines.push("  if (s.includes('imdb')) return icons['imdb'] ?? null;");
lines.push("  if (s.includes('tmdb') || s.includes('themoviedb')) return icons['themoviedb'] ?? null;");
lines.push("  if (s.includes('tvdb') || s.includes('thetvdb')) return icons['thetvdb'] ?? null;");
lines.push("  if (s.includes('rotten') && s.includes('fresh')) return icons['tomato-ripe'] ?? null;");
lines.push("  if (s.includes('rotten')) return icons['tomato-rotten'] ?? null;");
lines.push("  if (s.includes('audience') && s.includes('up')) return icons['popcorn-upright'] ?? null;");
lines.push("  if (s.includes('audience') && s.includes('down')) return icons['popcorn-spilled'] ?? null;");
lines.push('  return null;');
lines.push('}');

console.log(lines.join('\n'));
NODEGEN

echo "  ✓ ratingIcons.ts generated ($(wc -l < "$RATING_TS") lines)"
echo ""

# ─── Summary ────────────────────────────────────────────────────
echo "=== Download Complete ==="
echo ""
echo "Rating SVGs:      $(ls "$RATING_DIR"/*.svg 2>/dev/null | wc -l) files"
echo "Media Flag PNGs:  $(find "$ICON_DIR" -name '*.png' 2>/dev/null | wc -l) files"
echo "Brand SVGs:       $(ls "$WIKI_DIR"/*.svg 2>/dev/null | wc -l) files"
echo ""
echo "Locations:"
echo "  $RATING_DIR/"
echo "  $ICON_DIR/"
echo "  $WIKI_DIR/"
echo "  $RATING_TS"
echo ""
echo "Next: Claude builds mediaIcons.ts with the brand SVG registry"
