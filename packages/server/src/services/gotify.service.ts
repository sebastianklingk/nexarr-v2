import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { GotifyMessage } from '@nexarr/shared';

function client() {
  if (!env.GOTIFY_URL || !env.GOTIFY_TOKEN) {
    throw Object.assign(new Error('Gotify nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: env.GOTIFY_URL,
    headers: { 'X-Gotify-Key': env.GOTIFY_TOKEN },
    timeout: 5_000,
  });
}

interface GotifyMessagesResponse {
  messages: GotifyMessage[];
  paging: { limit: number; offset: number; since: number; size: number };
}

export async function getMessages(limit = 40): Promise<GotifyMessage[]> {
  return C.fetch(`gotify_messages_${limit}`, async () => {
    const { data } = await client().get<GotifyMessagesResponse>('/message', {
      params: { limit },
    });
    return data.messages ?? [];
  }, TTL.STATS);
}

export async function deleteMessage(id: number): Promise<void> {
  await client().delete(`/message/${id}`);
  C.invalidatePattern('gotify_messages');
}

export async function deleteAllMessages(): Promise<void> {
  await client().delete('/message');
  C.invalidatePattern('gotify_messages');
}

export async function getHealth(): Promise<{ health: string }> {
  return C.fetch('gotify_health', async () => {
    const { data } = await client().get<{ health: string }>('/health');
    return data;
  }, TTL.LONG);
}
