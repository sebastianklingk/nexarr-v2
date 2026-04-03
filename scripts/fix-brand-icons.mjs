#!/usr/bin/env node
// Fix Brand SVGs - correct URLs + 1.5s delay to avoid 429
// Run: node scripts/fix-brand-icons.mjs

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = path.join(__dirname, '..', 'packages', 'client', 'public', 'icons', 'brands');
fs.mkdirSync(WIKI_DIR, { recursive: true });

// All URLs verified via Wikimedia API 2026-04-03
const FILES = {
  'dolby-digital':      'https://upload.wikimedia.org/wikipedia/commons/3/3e/Dolby-Digital-Logo_2009.svg',
  'dolby-digital-plus': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Dolby-Digital-Plus.svg',
  'dolby-truehd':       'https://upload.wikimedia.org/wikipedia/commons/9/90/Dolby_TrueHD.svg',
  'dolby-atmos':        'https://upload.wikimedia.org/wikipedia/commons/a/a8/Dolby_Atmos_%28logo%29.svg',
  'dolby-vision':       'https://upload.wikimedia.org/wikipedia/commons/3/3f/Dolby_Vision_%28logo%29.svg',
  'dolby-logo':         'https://upload.wikimedia.org/wikipedia/commons/3/32/Dolby_logo.svg',
  'dts':                'https://upload.wikimedia.org/wikipedia/commons/0/06/DTS_%282020%29.svg',
  'dts-hdma':           'https://upload.wikimedia.org/wikipedia/commons/b/bd/DTS-HD-MA.svg',
  'av1':                'https://upload.wikimedia.org/wikipedia/commons/8/84/AV1_logo_2018.svg',
  'vp9':                'https://upload.wikimedia.org/wikipedia/commons/c/c7/Vp9-logo-for-mediawiki.svg',
  'h264':               'https://upload.wikimedia.org/wikipedia/commons/c/cd/H.264%2C_MPEG-4_AVC_logo.svg',
  'hevc':               'https://upload.wikimedia.org/wikipedia/commons/2/2f/X265_%28HEVC_encoder%2C_logo%29.svg',
  'hdr10':              'https://upload.wikimedia.org/wikipedia/commons/9/94/HDR_10_logo_%28black%29.svg',
  'hdr10plus':          'https://upload.wikimedia.org/wikipedia/commons/7/7c/HDR10%2B_Logo.svg',
  'opus':               'https://upload.wikimedia.org/wikipedia/commons/0/02/Opus_logo2.svg',
  'flac':               'https://upload.wikimedia.org/wikipedia/commons/a/a2/FLAC_logo_vector.svg',
  'aac':                'https://upload.wikimedia.org/wikipedia/commons/3/3e/AAC_original_logo.svg',
  'imax':               'https://upload.wikimedia.org/wikipedia/commons/2/22/IMAX.svg',
  'thx':                'https://upload.wikimedia.org/wikipedia/commons/d/d5/THX_logo.svg',
  'bluray':             'https://upload.wikimedia.org/wikipedia/commons/1/14/Blu-ray_Disc.svg',
  'uhd-bluray':         'https://upload.wikimedia.org/wikipedia/commons/2/21/Ultra_HD_Blu-ray_%28logo%29.svg',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, {
      headers: { 'User-Agent': 'nexarr/2.0 (self-hosted media dashboard; contact: github.com/sebastianklingk)' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
  });
}

async function main() {
  console.log('=== Downloading Brand SVGs (with 1.5s delay) ===\n');
  let good = 0, bad = 0;
  const entries = Object.entries(FILES);

  for (let i = 0; i < entries.length; i++) {
    const [name, url] = entries[i];
    const dest = path.join(WIKI_DIR, `${name}.svg`);

    // Skip if already valid
    if (fs.existsSync(dest)) {
      const existing = fs.readFileSync(dest, 'utf-8');
      if (existing.includes('<svg') || existing.includes('<?xml')) {
        console.log(`  ✓ ${name}.svg (already valid, skip)`);
        good++;
        continue;
      }
    }

    process.stdout.write(`  ↓ ${name}.svg ... `);
    try {
      await download(url, dest);
      const content = fs.readFileSync(dest, 'utf-8');
      if (content.includes('<svg') || content.includes('<?xml')) {
        console.log(`✅ (${content.length}b)`);
        good++;
      } else {
        console.log('❌ not SVG');
        bad++;
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      bad++;
    }

    // Wait 1.5s between requests to avoid rate limiting
    if (i < entries.length - 1) await sleep(1500);
  }

  console.log(`\n=== Result: ${good} ✅ / ${bad} ❌ ===`);
}

main();
