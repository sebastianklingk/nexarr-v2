/**
 * Transmission RPC Service
 *
 * Kommuniziert mit Transmission via JSON-RPC API.
 * Handhabt den CSRF-Session-Token (X-Transmission-Session-Id) automatisch.
 *
 * Konfiguration via .env:
 *   TRANSMISSION_URL   z.B. http://192.168.188.69:9091
 *   TRANSMISSION_USER  (optional, wenn Auth aktiviert)
 *   TRANSMISSION_PASS  (optional)
 */

import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { NormalizedSlot } from '@nexarr/shared';

// ── Transmission Status Codes ─────────────────────────────────────────────────
// 0: Stopped     → paused
// 1: Check Wait  → checking
// 2: Checking    → checking
// 3: DL Wait     → queued
// 4: Downloading → downloading
// 5: Seed Wait   → seeding
// 6: Seeding     → seeding

export interface TransmissionTorrent {
  id: number;
  hashString: string;
  name: string;
  status: number;
  percentDone: number;    // 0.0–1.0
  totalSize: number;      // bytes
  leftUntilDone: number;  // bytes
  rateDownload: number;   // bytes/s
  rateUpload: number;     // bytes/s
  uploadRatio: number;
  uploadedEver: number;   // bytes
  eta: number;            // seconds, -1 = unknown, -2 = infinite
  peersConnected: number;
  downloadDir: string;
  error: number;          // 0 = no error
  errorString: string;
}

// ── Session Token (CSRF) ──────────────────────────────────────────────────────

let sessionId = '';

// ── RPC Client ────────────────────────────────────────────────────────────────

async function rpc(method: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!env.TRANSMISSION_URL) {
    throw Object.assign(new Error('Transmission nicht konfiguriert'), { status: 503 });
  }

  const url = `${env.TRANSMISSION_URL}/transmission/rpc`;
  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionId) h['X-Transmission-Session-Id'] = sessionId;
    if (env.TRANSMISSION_USER && env.TRANSMISSION_PASS) {
      h['Authorization'] = `Basic ${Buffer.from(`${env.TRANSMISSION_USER}:${env.TRANSMISSION_PASS}`).toString('base64')}`;
    }
    return h;
  };

  const doRequest = async () =>
    axios.post(url, { method, arguments: args }, { headers: buildHeaders(), timeout: 10_000 });

  try {
    const { data } = await doRequest();
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { status: number; headers: Record<string, string> } };
    // Transmission gibt 409 zurück wenn Session-Token fehlt/abgelaufen
    if (e.response?.status === 409) {
      sessionId = e.response.headers['x-transmission-session-id'] ?? '';
      const { data } = await doRequest();
      return data;
    }
    throw err;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapStatus(status: number, error: number): NormalizedSlot['status'] {
  if (error !== 0) return 'error';
  switch (status) {
    case 0: return 'paused';
    case 1: case 2: return 'checking';
    case 3: return 'queued';
    case 4: return 'downloading';
    case 5: case 6: return 'seeding';
    default: return 'queued';
  }
}

function formatEta(seconds: number): string | undefined {
  if (seconds < 0) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getTorrents(): Promise<TransmissionTorrent[]> {
  return C.fetch('transmission_queue', async () => {
    const resp = await rpc('torrent-get', {
      fields: [
        'id', 'hashString', 'name', 'status', 'percentDone',
        'totalSize', 'leftUntilDone', 'rateDownload', 'rateUpload',
        'uploadRatio', 'uploadedEver', 'eta', 'peersConnected',
        'downloadDir', 'error', 'errorString',
      ],
    }) as { arguments?: { torrents?: TransmissionTorrent[] } };
    return resp.arguments?.torrents ?? [];
  }, TTL.QUEUE);
}

/** Gibt normalisierte Slots für den Queue-Aggregator zurück */
export async function getNormalizedSlots(): Promise<NormalizedSlot[]> {
  const torrents = await getTorrents();
  return torrents.map(t => ({
    id:            `transmission:${t.hashString}`,
    nativeId:      t.hashString,
    downloader:    'transmission' as const,
    filename:      t.name,
    status:        mapStatus(t.status, t.error),
    percentage:    Math.round(t.percentDone * 100),
    mbTotal:       Math.round(t.totalSize / 1024 / 1024 * 10) / 10,
    mbLeft:        Math.round(t.leftUntilDone / 1024 / 1024 * 10) / 10,
    speedMbs:      Math.round(t.rateDownload / 1024 / 1024 * 100) / 100,
    timeleft:      formatEta(t.eta),
    seeds:         t.peersConnected,
    seedRatio:     Math.round(t.uploadRatio * 100) / 100,
    uploadedMb:    Math.round(t.uploadedEver / 1024 / 1024 * 10) / 10,
    canPause:      true,
    canMoveToTop:  false,  // Transmission unterstützt Queue-Reihenfolge nicht
    canSetPriority: false,
  }));
}

export async function getGlobalStats() {
  const torrents = await getTorrents();
  const active = torrents.filter(t => t.status === 4);
  const speedMbs = active.reduce((sum, t) => sum + t.rateDownload, 0) / 1024 / 1024;
  const totalMb = torrents.reduce((sum, t) => sum + t.totalSize / 1024 / 1024, 0);
  const leftMb = torrents.reduce((sum, t) => sum + t.leftUntilDone / 1024 / 1024, 0);
  const allPaused = torrents.length > 0 && torrents.every(t => t.status === 0);

  return { speedMbs: Math.round(speedMbs * 100) / 100, totalMb, leftMb, paused: allPaused };
}

// ── Per-Torrent Actions ───────────────────────────────────────────────────────

export async function pauseTorrent(hash: string): Promise<void> {
  await rpc('torrent-stop', { ids: [hash] });
  C.invalidate('transmission_queue');
}

export async function resumeTorrent(hash: string): Promise<void> {
  await rpc('torrent-start', { ids: [hash] });
  C.invalidate('transmission_queue');
}

/**
 * @param deleteFiles true = lokale Dateien ebenfalls löschen
 */
export async function deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
  await rpc('torrent-remove', { ids: [hash], 'delete-local-data': deleteFiles });
  C.invalidate('transmission_queue');
}

// ── Global Controls ───────────────────────────────────────────────────────────

/** Alle Torrents pausieren (keine ids = alle) */
export async function pauseAll(): Promise<void> {
  await rpc('torrent-stop', {});
  C.invalidate('transmission_queue');
}

/** Alle Torrents fortsetzen */
export async function resumeAll(): Promise<void> {
  await rpc('torrent-start', {});
  C.invalidate('transmission_queue');
}
