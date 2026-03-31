<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.store.js';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const collapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true');

function toggleCollapsed() {
  collapsed.value = !collapsed.value;
  localStorage.setItem('sidebar-collapsed', String(collapsed.value));
}

const navItems = [
  { name: 'Dashboard',   path: '/dashboard',  icon: 'grid',       color: 'var(--accent)' },
  { name: 'Filme',       path: '/movies',      icon: 'film',       color: 'var(--radarr)' },
  { name: 'Serien',      path: '/series',      icon: 'tv',         color: 'var(--sonarr)' },
  { name: 'Musik',       path: '/music',       icon: 'music',      color: 'var(--lidarr)' },
  { name: 'Downloads',   path: '/downloads',   icon: 'download',   color: 'var(--sabnzbd)' },
  { name: 'Kalender',    path: '/calendar',    icon: 'calendar',   color: 'var(--text-tertiary)' },
  { name: 'Suche',       path: '/search',      icon: 'search',     color: 'var(--text-tertiary)' },
  { name: 'Einstellungen', path: '/settings', icon: 'settings',   color: 'var(--text-tertiary)' },
];

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/');
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
        <span class="nav-icon" v-html="getIcon(item.icon)" />
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
        <span class="nav-icon" v-html="getIcon('logout')" />
        <Transition name="label">
          <span v-if="!collapsed" class="nav-label">{{ auth.user?.username }}</span>
        </Transition>
      </button>
    </div>
  </aside>
</template>

<script lang="ts">
// Inline SVG Icons – kein Font, kein Import-Overhead
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
    logout:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
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
  transition: width 0.25s var(--ease-standard),
              min-width 0.25s var(--ease-standard);
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
  padding: var(--space-4) var(--space-4);
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
  letter-spacing: -0.5px;
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

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  flex-shrink: 0;
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

/* Label slide transition */
.label-enter-active,
.label-leave-active {
  transition: opacity 0.15s ease, width 0.25s var(--ease-standard);
  overflow: hidden;
}
.label-enter-from,
.label-leave-to {
  opacity: 0;
  width: 0;
}
</style>
