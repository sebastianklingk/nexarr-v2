import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/* ── Widget Registry ─────────────────────────────────────────────────────── */

export interface WidgetDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  /** Default column span in a 3-column grid */
  defaultColSpan: 1 | 2 | 3;
  minColSpan: 1 | 2 | 3;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: 'health',     label: 'Integration Health', icon: '🔗', description: 'Status aller Integrationen',  defaultColSpan: 3, minColSpan: 2 },
  { id: 'stats',      label: 'Statistiken',        icon: '📊', description: 'Filme, Serien, Musik, Downloads', defaultColSpan: 3, minColSpan: 2 },
  { id: 'recent',     label: 'Zuletzt hinzugefügt', icon: '🆕', description: 'Neueste Poster-Reihe',       defaultColSpan: 3, minColSpan: 2 },
  { id: 'downloads',  label: 'Downloads',           icon: '⬇️', description: 'Aktive Downloads (SABnzbd)', defaultColSpan: 1, minColSpan: 1 },
  { id: 'calendar',   label: 'Kalender',            icon: '📅', description: 'Nächste 7 Tage Releases',    defaultColSpan: 1, minColSpan: 1 },
  { id: 'streams',    label: 'Streams',             icon: '📺', description: 'Aktive Plex-Streams',        defaultColSpan: 1, minColSpan: 1 },
  { id: 'gotify',     label: 'Benachrichtigungen',  icon: '🔔', description: 'Gotify Nachrichten',         defaultColSpan: 1, minColSpan: 1 },
  { id: 'overseerr',  label: 'Anfragen',            icon: '🙋', description: 'Overseerr Anfragen',         defaultColSpan: 1, minColSpan: 1 },
  { id: 'plexabs',    label: 'Plex & ABS',          icon: '🎞️', description: 'Plex Sessions + Audiobookshelf', defaultColSpan: 1, minColSpan: 1 },
  { id: 'history',    label: 'Letzte Aktivität',    icon: '🕐', description: 'Tautulli Watch-History',     defaultColSpan: 3, minColSpan: 2 },
];

/* ── Layout Item ─────────────────────────────────────────────────────────── */

export interface LayoutItem {
  widgetId: string;
  visible: boolean;
}

const STORAGE_KEY = 'nx_dashboard_layout_v1';

function defaultLayout(): LayoutItem[] {
  return WIDGET_REGISTRY.map(w => ({ widgetId: w.id, visible: true }));
}

function loadLayout(): LayoutItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    const parsed = JSON.parse(raw) as LayoutItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultLayout();

    // Merge with registry: add new widgets, keep order + visibility of existing
    const existing = new Map(parsed.map(l => [l.widgetId, l]));
    const registryIds = new Set(WIDGET_REGISTRY.map(w => w.id));

    // Keep only known widgets in their saved order
    const result: LayoutItem[] = [];
    for (const item of parsed) {
      if (registryIds.has(item.widgetId)) {
        result.push(item);
      }
    }
    // Append any new widgets from registry
    for (const w of WIDGET_REGISTRY) {
      if (!existing.has(w.id)) {
        result.push({ widgetId: w.id, visible: true });
      }
    }
    return result;
  } catch {
    return defaultLayout();
  }
}

/* ── Store ────────────────────────────────────────────────────────────────── */

export const useDashboardStore = defineStore('dashboard', () => {
  const layout = ref<LayoutItem[]>(loadLayout());
  const catalogOpen = ref(false);
  const editMode = ref(false);

  // Visible widgets in order
  const visibleWidgets = computed(() =>
    layout.value.filter(l => l.visible)
  );

  // Widget def lookup
  const widgetDef = (id: string): WidgetDef | undefined =>
    WIDGET_REGISTRY.find(w => w.id === id);

  // Persist
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout.value));
  }

  // Toggle widget visibility
  function toggleWidget(widgetId: string) {
    const item = layout.value.find(l => l.widgetId === widgetId);
    if (item) {
      item.visible = !item.visible;
      save();
    }
  }

  // Move widget from one index to another (for DnD)
  function moveWidget(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const items = [...layout.value];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    layout.value = items;
    save();
  }

  // Reset to default
  function resetLayout() {
    layout.value = defaultLayout();
    save();
  }

  // Toggle edit mode
  function toggleEditMode() {
    editMode.value = !editMode.value;
    if (!editMode.value) catalogOpen.value = false;
  }

  return {
    layout,
    catalogOpen,
    editMode,
    visibleWidgets,
    widgetDef,
    toggleWidget,
    moveWidget,
    resetLayout,
    toggleEditMode,
    save,
  };
});
