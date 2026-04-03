<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth.store.js';
import { useQueueStore } from '../../stores/queue.store.js';
import { useGotifyStore } from '../../stores/gotify.store.js';

const route      = useRoute();
const auth       = useAuthStore();
const queueStore  = useQueueStore();
const gotifyStore = useGotifyStore();

const collapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true');

onMounted(() => queueStore.subscribe());

function toggleCollapsed() {
  collapsed.value = !collapsed.value;
  localStorage.setItem('sidebar-collapsed', String(collapsed.value));
}

const navItems = [
  { name: 'Dashboard',     path: '/dashboard',  icon: 'grid',     color: 'var(--accent)' },
  { name: 'Filme',         path: '/movies',      icon: 'film',     color: 'var(--radarr)' },
  { name: 'Serien',        path: '/series',      icon: 'tv',       color: 'var(--sonarr)' },
  { name: 'Musik',         path: '/music',       icon: 'music',    color: 'var(--lidarr)' },
  { name: 'Entdecken',     path: '/discover',    icon: 'compass',  color: 'var(--tmdb)' },
  { name: 'Indexer',       path: '/indexer',     icon: 'indexer',  color: 'var(--prowlarr)' },
  { name: 'Downloads',     path: '/downloads',   icon: 'download', color: 'var(--sabnzbd)' },
  { name: 'Kalender',      path: '/calendar',    icon: 'calendar', color: 'var(--text-tertiary)' },
  { name: 'Suche',         path: '/search',      icon: 'search',   color: 'var(--text-tertiary)' },
  { name: 'Streams',       path: '/streams',     icon: 'cast',     color: 'var(--tautulli)' },
  { name: 'Anfragen',           path: '/overseerr',       icon: 'inbox',  color: 'var(--overseerr)' },
  { name: 'Audiobookshelf',     path: '/audiobookshelf',  icon: 'book',   color: 'var(--abs)' },
  { name: 'Benachrichtigungen', path: '/gotify',           icon: 'bell',   color: 'var(--gotify)' },
  { name: 'Einstellungen',      path: '/settings',    icon: 'settings', color: 'var(--text-tertiary)' },
];

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/');
}

function showBadge(path: string): boolean {
  if (path === '/downloads') return queueStore.totalCount > 0 && !isActive('/downloads');
  if (path === '/gotify')    return gotifyStore.unreadCount > 0 && gotifyStore.configured && !isActive('/gotify');
  return false;
}

function badgeLabel(path: string): string {
  if (path === '/downloads') return queueStore.totalCount > 99 ? '99+' : String(queueStore.totalCount);
  if (path === '/gotify')    return gotifyStore.unreadCount > 99 ? '99+' : String(gotifyStore.unreadCount);
  return '';
}
</script>

<template>
  <aside :class="['sidebar', { collapsed }]">

    <!-- Logo -->
    <div class="sidebar-logo" @click="toggleCollapsed">
      <div class="logo-mark">n</div>
      <Transition name="label">
        <span v-if="!collapsed" class="logo-text">nexarr</span>
      </Transition>
    </div>

    <!-- Nav Items -->
    <nav class="sidebar-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="['nav-item', { active: isActive(item.path) }]"
        :style="isActive(item.path) ? `--item-color: ${item.color}` : ''"
        :title="collapsed ? item.name : undefined"
      >
        <span class="nav-icon-wrap">
          <span class="nav-icon" v-html="getIcon(item.icon)" />
          <span v-if="showBadge(item.path)" class="nav-badge">{{ badgeLabel(item.path) }}</span>
        </span>
        <Transition name="label">
          <span v-if="!collapsed" class="nav-label">{{ item.name }}</span>
        </Transition>
      </RouterLink>
    </nav>

    <!-- User / Logout -->
    <div class="sidebar-footer">
      <button
        class="nav-item logout-btn"
        :title="collapsed ? 'Abmelden' : undefined"
        @click="auth.logout()"
      >
        <span class="nav-icon-wrap">
          <span class="nav-icon" v-html="getIcon('logout')" />
        </span>
        <Transition name="label">
          <span v-if="!collapsed" class="nav-label">{{ auth.user?.username }}</span>
        </Transition>
      </button>
    </div>

  </aside>
</template>

<script lang="ts">
function getIcon(name: string): string {
  const icons: Record<string, string> = {
    grid:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    film:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    tv:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    music:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    download: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    search:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    chart:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
    inbox:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    bell:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    book:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    logout:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    compass:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    indexer:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    cast:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>`,
  };
  return icons[name] ?? '';
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-surface);
  border-right: 1px solid var(--bg-border);
  display: flex;
  flex-direction: column;
  transition: width 0.25s var(--ease-standard), min-width 0.25s var(--ease-standard);
  overflow: hidden;
  z-index: 100;
}

.sidebar.collapsed {
  width: var(--sidebar-width-collapsed);
  min-width: var(--sidebar-width-collapsed);
}

/* Logo */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  height: 56px;
  cursor: pointer;
  border-bottom: 1px solid var(--bg-border);
  flex-shrink: 0;
}

.logo-mark {
  width: 28px;
  height: 28px;
  min-width: 28px;
  background: var(--accent);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #fff;
}

.logo-text {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

/* Nav */
.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2);
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
  text-decoration: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  width: 100%;
  font-size: var(--text-base);
}

.nav-item:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.nav-item.active {
  background: var(--accent-muted);
  color: var(--text-primary);
  border-left-color: var(--item-color, var(--accent));
}

/* Icon + Badge wrapper */
.nav-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  flex-shrink: 0;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Download-Badge */
.nav-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--sabnzbd);
  color: #000;
  font-size: 10px;
  font-weight: 700;
  border-radius: 99px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  animation: badge-pop 0.2s ease;
}

@keyframes badge-pop {
  0%   { transform: scale(0); }
  70%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer */
.sidebar-footer {
  border-top: 1px solid var(--bg-border);
  padding: var(--space-2);
  flex-shrink: 0;
}

.logout-btn {
  background: none;
  border: none;
  font-size: var(--text-base);
}

/* Label transition */
.label-enter-active,
.label-leave-active {
  transition: opacity 0.15s ease, width 0.25s var(--ease-standard);
  overflow: hidden;
}
.label-enter-from,
.label-leave-to { opacity: 0; width: 0; }
</style>
