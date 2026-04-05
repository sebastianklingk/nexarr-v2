import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { OverseerrRequest } from '@nexarr/shared';

function client() {
  if (!env.OVERSEERR_URL || !env.OVERSEERR_API_KEY) {
    throw Object.assign(new Error('Overseerr nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: `${env.OVERSEERR_URL}/api/v1`,
    headers: { 'X-Api-Key': env.OVERSEERR_API_KEY },
    timeout: 10_000,
  });
}

export async function getRequests(filter = 'pending'): Promise<OverseerrRequest[]> {
  return C.fetch(`overseerr_requests_${filter}`, async () => {
    const { data } = await client().get('/request', {
      params: { take: 20, skip: 0, filter, sort: 'added' },
    });
    return (data?.results ?? []) as OverseerrRequest[];
  }, TTL.STATS);
}

export async function approveRequest(id: number): Promise<void> {
  await client().post(`/request/${id}/approve`);
  C.invalidate('overseerr_requests_pending');
  C.invalidate('overseerr_requests_all');
}

export async function declineRequest(id: number): Promise<void> {
  await client().post(`/request/${id}/decline`);
  C.invalidate('overseerr_requests_pending');
  C.invalidate('overseerr_requests_all');
}

export async function deleteRequest(id: number): Promise<void> {
  await client().delete(`/request/${id}`);
  C.invalidate('overseerr_requests_pending');
  C.invalidate('overseerr_requests_all');
}
