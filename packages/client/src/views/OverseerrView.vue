<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import type { OverseerrRequest } from '@nexarr/shared';

const { get, post, del } = useApi();

// ── State ────────────────────────────────────────────────────────────────────

type Filter = 'pending' | 'approved' | 'declined' | 'all';

const requests  = ref<OverseerrRequest[]>([]);
const isLoading = ref(true);
const error     = ref<string | null>(null);
const filter    = ref<Filter>('pending');
const actionMap = ref<Record<number, 'approving' | 'declining' | 'deleting' | null>>({});

// ── Labels / Helpers ──────────────────────────────────────────────────────────

const filterLabels: Record<Filter, string> = {
  pending:  'Ausstehend',
  approved: 'Genehmigt',
  declined: 'Abgelehnt',
  all:      'Alle',
};

function statusLabel(status: number): string {
  const map: Record<number, string> = {
    1: 'Ausstehend',
    2: 'Genehmigt',
    3: 'Abgelehnt',
    4: 'Verfügbar',
    5: 'In Bearbeitung',
  };
  return map[status] ?? 'Unbekannt';
}

function statusClass(status: number): string {
  if (status === 1) return 'status-pending';
  if (status === 2) return 'status-approved';
  if (status === 3) return 'status-declined';
  if (status === 4) return 'status-available';
  return 'status-neutral';
}

function mediaTypeLabel(type: string): string {
  return type === 'movie' ? 'Film' : 'Serie';
}

function mediaTypeClass(type: string): string {
  return type === 'movie' ? 'type-movie' : 'type-show';
}

function posterUrl(path?: string): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w200${path}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Computed ──────────────────────────────────────────────────────────────────

const pendingCount = computed(() =>
  requests.value.filter(r => r.status === 1).length
);

// ── Actions ───────────────────────────────────────────────────────────────────

async function loadRequests() {
  isLoading.value = true;
  error.value = null;
  try {
    const data = await get<OverseerrRequest[]>(`/api/overseerr/requests?filter=${filter.value}`);
    requests.value = Array.isArray(data) ? data : [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Laden';
  } finally {
    isLoading.value = false;
  }
}

async function switchFilter(f: Filter) {
  filter.value = f;
  await loadRequests();
}

async function approve(id: number) {
  actionMap.value[id] = 'approving';
  try {
    await post(`/api/overseerr/requests/${id}/approve`);
    // Entferne aus Liste wenn wir "pending" Ansicht zeigen
    if (filter.value === 'pending') {
      requests.value = requests.value.filter(r => r.id !== id);
    } else {
      await loadRequests();
    }
  } catch {
    // Fehler – Request bleibt
  } finally {
    actionMap.value[id] = null;
  }
}

async function decline(id: number) {
  actionMap.value[id] = 'declining';
  try {
    await post(`/api/overseerr/requests/${id}/decline`);
    if (filter.value === 'pending') {
      requests.value = requests.value.filter(r => r.id !== id);
    } else {
      await loadRequests();
    }
  } catch {
    // noop
  } finally {
    actionMap.value[id] = null;
  }
}

async function deleteRequest(id: number) {
  actionMap.value[id] = 'deleting';
  try {
    await del(`/api/overseerr/requests/${id}`);
    requests.value = requests.value.filter(r => r.id !== id);
  } catch {
    // noop
  } finally {
    actionMap.value[id] = null;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(loadRequests);
</script>

<template>
  <div class="overseerr-view">

    <!-- Header -->
    <div class="view-header">
      <div class="view-header-inner">
        <div class="header-indicator" />
        <div>
          <h1 class="view-title">Anfragen</h1>
          <p class="view-subtitle">Overseerr · Medien-Anfragen verwalten</p>
        </div>
        <div v-if="pendingCount > 0" class="pending-badge">
          {{ pendingCount }} ausstehend
        </div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="tabs-bar">
      <button
        v-for="(label, key) in filterLabels"
        :key="key"
        :class="['tab-btn', { active: filter === key }]"
        @click="switchFilter(key as Filter)"
      >
        {{ label }}
      </button>
    </div>

    <!-- Content -->
    <div class="content">

      <!-- Loading -->
      <div v-if="isLoading" class="request-list">
        <div v-for="i in 5" :key="i" class="request-card skeleton-card">
          <div class="skeleton skeleton-poster" />
          <div class="request-info">
            <div class="skeleton skeleton-title" />
            <div class="skeleton skeleton-meta" />
            <div class="skeleton skeleton-actions" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button class="btn-neutral" @click="loadRequests">Erneut versuchen</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!requests.length" class="empty-state">
        <div class="empty-icon">📬</div>
        <p class="empty-title">Keine Anfragen</p>
        <p class="empty-sub">
          {{
            filter === 'pending'
              ? 'Es gibt keine ausstehenden Anfragen.'
              : `Keine Anfragen mit Status "${filterLabels[filter]}".`
          }}
        </p>
      </div>

      <!-- Request List -->
      <div v-else class="request-list">
        <div
          v-for="req in requests"
          :key="req.id"
          :class="['request-card', `type-border-${req.type}`]"
        >
          <!-- Poster -->
          <div class="poster-wrap">
            <img
              v-if="posterUrl(req.media?.posterPath)"
              :src="posterUrl(req.media?.posterPath)!"
              :alt="req.media?.title ?? ''"
              class="poster-img"
              loading="lazy"
            />
            <div v-else class="poster-placeholder">
              {{ req.type === 'movie' ? '🎬' : '📺' }}
            </div>
          </div>

          <!-- Info -->
          <div class="request-info">
            <div class="request-top">
              <div class="request-titles">
                <span class="request-title">
                  {{ req.media?.title ?? `TMDB #${req.media?.tmdbId}` }}
                </span>
                <div class="request-badges">
                  <span :class="['type-badge', mediaTypeClass(req.type)]">
                    {{ mediaTypeLabel(req.type) }}
                  </span>
                  <span :class="['status-badge', statusClass(req.status)]">
                    {{ statusLabel(req.status) }}
                  </span>
                </div>
              </div>
              <!-- Delete Button -->
              <button
                class="btn-icon btn-delete"
                :disabled="actionMap[req.id] != null"
                title="Anfrage löschen"
                @click="deleteRequest(req.id)"
              >
                <svg v-if="actionMap[req.id] === 'deleting'" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>

            <div class="request-meta">
              <span class="meta-user">von {{ req.requestedBy?.displayName ?? '–' }}</span>
              <span class="meta-sep">·</span>
              <span class="meta-date">{{ formatDate(req.createdAt) }}</span>
            </div>

            <!-- Action Buttons – nur bei pending -->
            <div v-if="req.status === 1" class="request-actions">
              <button
                class="btn-action btn-approve"
                :disabled="actionMap[req.id] != null"
                @click="approve(req.id)"
              >
                <svg v-if="actionMap[req.id] === 'approving'" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Genehmigen
              </button>
              <button
                class="btn-action btn-decline"
                :disabled="actionMap[req.id] != null"
                @click="decline(req.id)"
              >
                <svg v-if="actionMap[req.id] === 'declining'" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Ablehnen
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.overseerr-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.view-header {
  padding: var(--space-6) var(--space-6) var(--space-4);
  border-bottom: 1px solid var(--bg-border);
}

.view-header-inner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-indicator {
  width: 4px;
  height: 36px;
  background: var(--overseerr);
  border-radius: 2px;
  flex-shrink: 0;
}

.view-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.view-subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 2px;
}

.pending-badge {
  margin-left: auto;
  padding: 4px 12px;
  background: rgba(124, 77, 255, 0.15);
  border: 1px solid rgba(124, 77, 255, 0.3);
  border-radius: 99px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--overseerr);
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.tabs-bar {
  display: flex;
  border-bottom: 1px solid var(--bg-border);
  padding: 0 var(--space-6);
}

.tab-btn {
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
  margin-bottom: -1px;
}
.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active {
  color: var(--text-primary);
  border-bottom-color: var(--overseerr);
}

/* ── Content ─────────────────────────────────────────────────────────────── */
.content {
  padding: var(--space-6);
  flex: 1;
}

/* ── Request List ────────────────────────────────────────────────────────── */
.request-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 860px;
}

.request-card {
  display: flex;
  gap: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: border-color 0.15s ease;
}

.type-border-movie { border-left: 3px solid var(--radarr); }
.type-border-tv    { border-left: 3px solid var(--sonarr); }

/* Poster */
.poster-wrap {
  flex-shrink: 0;
  width: 64px;
}

.poster-img {
  width: 64px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--bg-border);
}

.poster-placeholder {
  width: 64px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-size: 24px;
}

/* Info */
.request-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  justify-content: center;
}

.request-top {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.request-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.request-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.request-badges {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.type-badge {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: var(--text-xs);
  font-weight: 500;
}

.type-movie { background: rgba(244,165,74,0.12); color: var(--radarr); border: 1px solid rgba(244,165,74,0.25); }
.type-show  { background: rgba(53,197,244,0.12); color: var(--sonarr); border: 1px solid rgba(53,197,244,0.25); }

.status-badge {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: var(--text-xs);
  font-weight: 500;
}

.status-pending   { background: rgba(245,197,24,0.1); color: var(--sabnzbd); border: 1px solid rgba(245,197,24,0.25); }
.status-approved  { background: rgba(34,197,94,0.1); color: var(--status-success); border: 1px solid rgba(34,197,94,0.25); }
.status-declined  { background: rgba(248,113,113,0.1); color: var(--status-error); border: 1px solid rgba(248,113,113,0.25); }
.status-available { background: rgba(124,77,255,0.1); color: var(--overseerr); border: 1px solid rgba(124,77,255,0.25); }
.status-neutral   { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }

.request-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.meta-user { color: var(--overseerr); font-weight: 500; }
.meta-sep  { color: var(--bg-border); }

/* Delete button */
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  transition: background 0.15s ease, opacity 0.15s ease;
  flex-shrink: 0;
}
.btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-delete {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
}
.btn-delete:not(:disabled):hover {
  background: rgba(248,113,113,0.12);
  border-color: rgba(248,113,113,0.25);
  color: var(--status-error);
}

/* Action Buttons */
.request-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-1);
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background 0.15s ease, opacity 0.15s ease;
  cursor: pointer;
}
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-approve {
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.3);
  color: var(--status-success);
}
.btn-approve:not(:disabled):hover {
  background: rgba(34,197,94,0.22);
  border-color: rgba(34,197,94,0.5);
}

.btn-decline {
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.25);
  color: var(--status-error);
}
.btn-decline:not(:disabled):hover {
  background: rgba(248,113,113,0.2);
  border-color: rgba(248,113,113,0.45);
}

.btn-neutral {
  padding: 8px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  margin-top: var(--space-4);
}
.btn-neutral:hover { background: var(--bg-border); }

/* Animations */
@keyframes spin { to { transform: rotate(360deg); } }
.spin-icon { animation: spin 0.8s linear infinite; }

/* ── Skeletons ────────────────────────────────────────────────────────────── */
.skeleton-card {
  min-height: 120px;
}

.skeleton-poster {
  width: 64px;
  height: 96px;
  border-radius: var(--radius-md);
}

.skeleton-title {
  height: 18px;
  width: 60%;
  border-radius: var(--radius-sm);
}

.skeleton-meta {
  height: 13px;
  width: 40%;
  border-radius: var(--radius-sm);
  margin-top: 6px;
}

.skeleton-actions {
  height: 32px;
  width: 220px;
  border-radius: var(--radius-md);
  margin-top: 10px;
}

/* ── Empty / Error ───────────────────────────────────────────────────────── */
.empty-state {
  padding: var(--space-12) var(--space-8);
  text-align: center;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-sub {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.error-state {
  padding: var(--space-8);
  text-align: center;
  color: var(--status-error);
  font-size: var(--text-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}
</style>
