import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { SabnzbdState } from '@nexarr/shared';

// ── Axios-Wrapper (alle SABnzbd Calls gehen durch /api?mode=...) ──────────────

function client(mode: string, extra: Record<string, string | number> = {}) {
  if (!env.SABNZBD_URL || !env.SABNZBD_API_KEY) {
    throw Object.assign(new Error('SABnzbd nicht konfiguriert'), { status: 503 });
  }
  return axios.get(`${env.SABNZBD_URL}/api`, {
    params: { output: 'json', apikey: env.SABNZBD_API_KEY, mode, ...extra },
    timeout: 10_000,
  });
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export async function getQueue(): Promise<SabnzbdState> {
  return C.fetch('sabnzbd_queue', async () => {
    const { data } = await client('queue');
    const q = data.queue;

    return {
      paused:             q.paused === true || q.status === 'Paused',
      speedMbs:           Math.round((parseFloat(q.kbpersec ?? '0') / 1024) * 10) / 10,
      speedLimitPercent:  parseInt(q.speedlimit ?? '100', 10),
      mbTotal:            parseFloat(q.mb ?? '0'),
      mbLeft:             parseFloat(q.mbleft ?? '0'),
      slotCount:          parseInt(q.noofslots ?? '0', 10),
      slots: (q.slots ?? []).map((slot: Record<string, string>) => ({
        nzo_id:    slot.nzo_id,
        filename:  slot.filename,
        status:    slot.status,
        percentage: parseFloat(slot.percentage ?? '0'),
        mbTotal:   parseFloat(slot.mb ?? '0'),
        mbLeft:    parseFloat(slot.mbleft ?? '0'),
        eta:       slot.eta ?? '',
        timeleft:  slot.timeleft ?? '',
        cat:       slot.cat ?? '',
        priority:  slot.priority ?? 'Normal',
      })),
    } satisfies SabnzbdState;
  }, TTL.QUEUE);
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getHistory(): Promise<unknown> {
  return C.fetch('sabnzbd_history', async () => {
    const { data } = await client('history', { limit: 50 });
    return data.history;
  }, TTL.HISTORY);
}

// ── Control Actions ───────────────────────────────────────────────────────────

export async function pause(): Promise<void> {
  await client('pause');
  C.invalidate('sabnzbd_queue');
}

export async function resume(): Promise<void> {
  await client('resume');
  C.invalidate('sabnzbd_queue');
}

export async function setSpeedLimit(percent: number): Promise<void> {
  await client('speedlimit', { value: percent });
  C.invalidate('sabnzbd_queue');
}

export async function deleteItem(nzoId: string): Promise<void> {
  await client('queue', { name: 'delete', value: nzoId, del_files: 1 });
  C.invalidate('sabnzbd_queue');
}

export async function pauseItem(nzoId: string): Promise<void> {
  await client('queue', { name: 'pause', value: nzoId });
  C.invalidate('sabnzbd_queue');
}

export async function resumeItem(nzoId: string): Promise<void> {
  await client('queue', { name: 'resume', value: nzoId });
  C.invalidate('sabnzbd_queue');
}

// Priorität setzen: Force=2, High=1, Normal=0, Low=-1
export async function setPriority(nzoId: string, priority: 'Force' | 'High' | 'Normal' | 'Low'): Promise<void> {
  const priorityMap: Record<string, number> = { Force: 2, High: 1, Normal: 0, Low: -1 };
  const value = priorityMap[priority] ?? 0;
  await client('queue', { name: 'priority', value: nzoId, value2: value });
  C.invalidate('sabnzbd_queue');
}

// Job an Anfang der Queue verschieben (Position 0)
export async function moveToTop(nzoId: string): Promise<void> {
  await client('queue', { name: 'switch', value: nzoId, value2: 0 });
  C.invalidate('sabnzbd_queue');
}
