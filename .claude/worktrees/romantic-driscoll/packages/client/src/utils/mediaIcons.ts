// nexarr v2 – Media Icons Registry
// Zentrale Icon-Zuordnung für Video/Audio Codecs, Auflösungen, Kanäle, Content-Ratings
// Quellen: Tautulli media_flags (PNGs), Wikimedia Commons (Brand SVGs), Tautulli rating (SVGs)
// Regenerieren: bash scripts/download-icons.sh

// ─── Types ──────────────────────────────────────────────────────

export type MediaIconCategory =
  | 'video_codec'
  | 'audio_codec'
  | 'video_resolution'
  | 'audio_channels'
  | 'content_rating';

export interface MediaIconResult {
  /** URL path to the icon (relative to public/) */
  src: string;
  /** Human-readable label */
  label: string;
  /** 'svg' for brand SVGs, 'png' for Tautulli media flags */
  type: 'svg' | 'png';
}

// ─── Brand SVG Overrides ────────────────────────────────────────
// These take priority over Tautulli PNGs when available

const brandIcons: Record<string, { src: string; label: string }> = {
  // Video Codecs
  'h264':          { src: '/icons/brands/h264.svg', label: 'H.264' },
  'h265':          { src: '/icons/brands/hevc.svg', label: 'H.265' },
  'hevc':          { src: '/icons/brands/hevc.svg', label: 'HEVC' },
  'av1':           { src: '/icons/brands/av1.svg', label: 'AV1' },
  'vp9':           { src: '/icons/brands/vp9.svg', label: 'VP9' },
  // Audio Codecs
  'dolby_digital':  { src: '/icons/brands/dolby-digital.svg', label: 'Dolby Digital' },
  'ac3':            { src: '/icons/brands/dolby-digital.svg', label: 'Dolby Digital' },
  'eac3':           { src: '/icons/brands/dolby-digital-plus.svg', label: 'DD+' },
  'dolby_truehd':   { src: '/icons/brands/dolby-truehd.svg', label: 'TrueHD' },
  'truehd':         { src: '/icons/brands/dolby-truehd.svg', label: 'TrueHD' },
  'flac':           { src: '/icons/brands/flac.svg', label: 'FLAC' },
  'opus':           { src: '/icons/brands/opus.svg', label: 'Opus' },
  'aac':            { src: '/icons/brands/aac.svg', label: 'AAC' },
  // HDR / Features (can be used as standalone badges)
  'dolby_vision':   { src: '/icons/brands/dolby-vision.svg', label: 'Dolby Vision' },
  'dolby_atmos':    { src: '/icons/brands/dolby-atmos.svg', label: 'Dolby Atmos' },
  'hdr10':          { src: '/icons/brands/hdr10.svg', label: 'HDR10' },
  'hdr10plus':      { src: '/icons/brands/hdr10plus.svg', label: 'HDR10+' },
  'hdr10+':         { src: '/icons/brands/hdr10plus.svg', label: 'HDR10+' },
  // DTS family
  'dts':            { src: '/icons/brands/dts.svg', label: 'DTS' },
  'dca':            { src: '/icons/brands/dts.svg', label: 'DTS' },
  'dts-hd_ma':      { src: '/icons/brands/dts-hdma.svg', label: 'DTS-HD MA' },
  'dca-ma':         { src: '/icons/brands/dts-hdma.svg', label: 'DTS-HD MA' },
  // Misc
  'imax':           { src: '/icons/brands/imax.svg', label: 'IMAX' },
  'thx':            { src: '/icons/brands/thx.svg', label: 'THX' },
  'bluray':         { src: '/icons/brands/bluray.svg', label: 'Blu-ray' },
  'uhd_bluray':     { src: '/icons/brands/uhd-bluray.svg', label: 'UHD Blu-ray' },
};

// ─── Tautulli PNG Paths ─────────────────────────────────────────

const pngBase: Record<MediaIconCategory, string> = {
  video_codec: '/icons/media/video_codec/',
  audio_codec: '/icons/media/audio_codec/',
  video_resolution: '/icons/media/video_resolution/',
  audio_channels: '/icons/media/audio_channels/',
  content_rating: '/icons/media/content_rating/',
};

// Files available per category (without .png extension)
const pngFiles: Record<MediaIconCategory, string[]> = {
  video_codec: ['h264', 'hevc', 'mpeg1video', 'mpeg2video', 'mpeg4', 'vc1', 'wmv', 'wmvhd'],
  audio_codec: [
    'aac', 'aif', 'aifc', 'aiff', 'alac', 'ape', 'cdda', 'dca-ma',
    'dolby_digital', 'dolby_truehd', 'dts', 'eac3', 'flac', 'm4a', 'mlp',
    'mp2', 'mp3', 'mpc', 'ogg', 'pcm', 'ra', 'shn', 'wav', 'wave',
    'wma', 'wmahd', 'wmapro', 'wmav2', 'wv',
  ],
  video_resolution: [
    '1080', '1080i', '270', '360', '432', '468', '480', '480i', '4k',
    '540', '544', '576', '576i', '720', '8k', 'hdtv', 'sd',
  ],
  audio_channels: ['1', '2', '5', '6', '7', '8'],
  content_rating: [
    'G', 'NC-17', 'NR', 'Not Rated', 'PG-13', 'PG', 'R',
    'TV-14', 'TV-G', 'TV-MA', 'TV-PG', 'TV-Y', 'TV-Y7-FV', 'TV-Y7',
    'Unrated', 'X',
  ],
};

// ─── Alias Maps ─────────────────────────────────────────────────
// Normalize incoming values to match our icon filenames

const aliases: Record<string, string> = {
  // Video codec aliases
  'x264': 'h264',
  'avc': 'h264',
  'avc1': 'h264',
  'x265': 'hevc',
  'h265': 'hevc',
  'hev1': 'hevc',
  'mpeg-4': 'mpeg4',
  'mpeg-2': 'mpeg2video',
  'mpeg-1': 'mpeg1video',
  'mpeg2': 'mpeg2video',
  'mpeg1': 'mpeg1video',
  'wmv3': 'wmvhd',
  // Audio codec aliases
  'ac3': 'dolby_digital',
  'dd': 'dolby_digital',
  'dolby digital': 'dolby_digital',
  'e-ac-3': 'eac3',
  'dd+': 'eac3',
  'dolby digital plus': 'eac3',
  'truehd': 'dolby_truehd',
  'dolby truehd': 'dolby_truehd',
  'dca': 'dts',
  'dts-hd ma': 'dca-ma',
  'dts-hd': 'dca-ma',
  'dts-hdma': 'dca-ma',
  'dts-x': 'dts',
  'mp4a': 'aac',
  'vorbis': 'ogg',
  // Resolution aliases
  '2160': '4k',
  '2160p': '4k',
  '4320': '8k',
  '4320p': '8k',
  '1080p': '1080',
  '720p': '720',
  '480p': '480',
  '576p': '576',
  '360p': '360',
  // Audio channel aliases
  'mono': '1',
  'stereo': '2',
  '2.0': '2',
  '2.1': '2',
  '5.1': '6',
  '6.1': '7',
  '7.1': '8',
};

// ─── Resolution labels ──────────────────────────────────────────

const resolutionLabels: Record<string, string> = {
  '270': '270p', '360': '360p', '432': '432p', '468': '468p',
  '480': '480p', '480i': '480i', '540': '540p', '544': '544p',
  '576': '576p', '576i': '576i', '720': '720p',
  '1080': '1080p', '1080i': '1080i', '4k': '4K', '8k': '8K',
  'sd': 'SD', 'hdtv': 'HDTV',
};

// ─── Channel labels ─────────────────────────────────────────────

const channelLabels: Record<string, string> = {
  '1': 'Mono', '2': 'Stereo', '5': '4.1', '6': '5.1', '7': '6.1', '8': '7.1',
};

// ─── Codec labels ───────────────────────────────────────────────

const codecLabels: Record<string, string> = {
  'h264': 'H.264', 'hevc': 'HEVC', 'mpeg4': 'MPEG-4', 'mpeg2video': 'MPEG-2',
  'mpeg1video': 'MPEG-1', 'vc1': 'VC-1', 'wmv': 'WMV', 'wmvhd': 'WMV HD',
  'av1': 'AV1', 'vp9': 'VP9', 'vp8': 'VP8',
  'aac': 'AAC', 'ac3': 'DD', 'eac3': 'DD+', 'dolby_digital': 'DD',
  'dolby_truehd': 'TrueHD', 'dts': 'DTS', 'dca-ma': 'DTS-HD MA',
  'flac': 'FLAC', 'mp3': 'MP3', 'mp2': 'MP2', 'opus': 'Opus',
  'alac': 'ALAC', 'pcm': 'PCM', 'ogg': 'OGG', 'wav': 'WAV',
  'wma': 'WMA', 'aif': 'AIF', 'aiff': 'AIFF', 'm4a': 'M4A',
};

// ─── Main Lookup ────────────────────────────────────────────────

/**
 * Get media icon for a given category and value.
 * Returns brand SVG if available, otherwise falls back to Tautulli PNG.
 */
export function getMediaIcon(
  category: MediaIconCategory,
  value: string,
): MediaIconResult | null {
  if (!value) return null;

  const normalized = value.toLowerCase().trim();
  const resolved = aliases[normalized] ?? normalized;

  // 1. Try brand SVG override
  const brand = brandIcons[resolved] ?? brandIcons[normalized];
  if (brand) {
    return { src: brand.src, label: brand.label, type: 'svg' };
  }

  // 2. Try Tautulli PNG
  const base = pngBase[category];
  const files = pngFiles[category];
  if (base && files) {
    // Exact match
    if (files.includes(resolved)) {
      const label = getLabelFor(category, resolved);
      return { src: `${base}${resolved}.png`, label, type: 'png' };
    }
    // Case-insensitive match for content_rating
    if (category === 'content_rating') {
      const match = files.find(f => f.toLowerCase() === resolved);
      if (match) {
        return { src: `${base}${match}.png`, label: match, type: 'png' };
      }
    }
  }

  return null;
}

/**
 * Get brand icon by key (for standalone usage like HDR badges, Dolby Vision etc.)
 */
export function getBrandIcon(key: string): MediaIconResult | null {
  const normalized = key.toLowerCase().trim();
  const resolved = aliases[normalized] ?? normalized;
  const brand = brandIcons[resolved] ?? brandIcons[normalized];
  if (brand) {
    return { src: brand.src, label: brand.label, type: 'svg' };
  }
  return null;
}

/**
 * Get a human-readable label for a value in a category
 */
export function getMediaLabel(category: MediaIconCategory, value: string): string {
  const normalized = value.toLowerCase().trim();
  const resolved = aliases[normalized] ?? normalized;
  return getLabelFor(category, resolved) || value.toUpperCase();
}

function getLabelFor(category: MediaIconCategory, value: string): string {
  switch (category) {
    case 'video_resolution':
      return resolutionLabels[value] ?? value;
    case 'audio_channels':
      return channelLabels[value] ?? `${value}ch`;
    case 'video_codec':
    case 'audio_codec':
      return codecLabels[value] ?? value.toUpperCase();
    case 'content_rating':
      return value;
    default:
      return value;
  }
}
