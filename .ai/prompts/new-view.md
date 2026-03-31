# Prompt Template: Neue Vue View

**Verwendung durch Chat-Claude:**
```
"Führe .ai/prompts/new-view.md aus für:
 View: [ViewName]View.vue
 Route: /[path] (und /[path]/:id für Detail-Views)
 Beschreibung: [Was diese View macht]
 Backend-Endpoints: [welche /api/... Endpoints werden genutzt]
 App-Kontext-Farbe: var(--[app]) oder keiner
 Besonderheiten: [Grid/Detail/Dashboard/Liste etc.]"
```

---

## Anweisungen für Claude Code

Lies zuerst diese Dateien vollständig:
1. `.ai/CONTEXT.md` – aktueller Projekt-State
2. `.ai/CONVENTIONS.md` – Vue Coding-Regeln (PFLICHT)
3. `packages/client/src/views/MoviesView.vue` – Referenz für Grid-Views
4. `packages/client/src/views/MovieDetailView.vue` – Referenz für Detail-Views
5. `packages/client/src/composables/useApi.ts` – wie API-Calls gemacht werden

---

## Schritte

### Schritt 1: Store anlegen (wenn nötig)

Prüfe ob ein passender Pinia Store bereits existiert.
Falls nicht: `packages/client/src/stores/[name].store.ts`

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import type { [Type] } from '@nexarr/shared';

export const use[Name]Store = defineStore('[name]', () => {
  const items = ref<[Type][]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const itemById = computed(() => (id: number) =>
    items.value.find(i => i.id === id)
  );

  async function fetchItems() {
    isLoading.value = true;
    error.value = null;
    try {
      const { data } = await useApi<[Type][]>('/api/[endpoint]');
      items.value = data;
    } catch {
      error.value = 'Fehler beim Laden';
    } finally {
      isLoading.value = false;
    }
  }

  return { items, isLoading, error, itemById, fetchItems };
});
```

### Schritt 2: View erstellen

`packages/client/src/views/[Name]View.vue`

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { use[Name]Store } from '@/stores/[name].store';
import PosterCard from '@/components/media/PosterCard.vue';
import ViewToggle from '@/components/ui/ViewToggle.vue';
import LoadingGrid from '@/components/ui/LoadingGrid.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import type { [Type] } from '@nexarr/shared';

const store = use[Name]Store();

// Filter & Sort State
const searchQuery = ref('');
const sortBy = ref<'title' | 'year' | 'rating' | 'added'>('title');
const viewMode = ref<'poster' | 'focus' | 'list'>('poster');

const filteredItems = computed(() => {
  let result = [...store.items];
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(i => i.title.toLowerCase().includes(q));
  }
  
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'title':  return a.title.localeCompare(b.title);
      case 'year':   return (b.year ?? 0) - (a.year ?? 0);
      case 'rating': return (b.rating ?? 0) - (a.rating ?? 0);
      default:       return 0;
    }
  });
  
  return result;
});

onMounted(() => store.fetchItems());
</script>

<template>
  <div class="view-root" style="--context-color: var(--[app])">
    
    <!-- View Header -->
    <header class="view-header">
      <h1 class="view-title">[Titel]</h1>
      <div class="view-controls">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Suchen..."
          class="search-input"
        />
        <select v-model="sortBy" class="sort-select">
          <option value="title">A–Z</option>
          <option value="year">Jahr</option>
          <option value="rating">Rating</option>
          <option value="added">Hinzugefügt</option>
        </select>
        <ViewToggle v-model="viewMode" />
      </div>
    </header>

    <!-- Loading State -->
    <LoadingGrid v-if="store.isLoading" />
    
    <!-- Empty State -->
    <EmptyState
      v-else-if="!store.isLoading && filteredItems.length === 0"
      :message="searchQuery ? 'Keine Ergebnisse' : 'Bibliothek leer'"
    />
    
    <!-- Poster Grid -->
    <div v-else-if="viewMode === 'poster'" class="poster-grid">
      <PosterCard
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :app-color="'var(--[app])'"
        @click="$router.push('/[path]/' + item.id)"
      />
    </div>

    <!-- Focus / List Views via PosterCard prop -->
    <div v-else :class="viewMode === 'focus' ? 'focus-grid' : 'list-view'">
      <PosterCard
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :view-mode="viewMode"
        :app-color="'var(--[app])'"
        @click="$router.push('/[path]/' + item.id)"
      />
    </div>

  </div>
</template>

<style scoped>
.view-root {
  padding: var(--space-6);
}

.view-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.view-title {
  font-size: var(--text-xl);
  color: var(--text-primary);
  font-weight: 500;
  padding-left: var(--space-3);
  border-left: 3px solid var(--context-color);
}

.view-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-left: auto;
}

.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-3);
}

.focus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}

.list-view {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

@media (max-width: 768px) {
  .view-root { padding: var(--space-4); }
  .view-header { flex-wrap: wrap; }
  .view-controls { width: 100%; }
}
</style>
```

### Schritt 3: Route registrieren

`packages/client/src/router/index.ts`

```typescript
// In routes Array einfügen:
{
  path: '/[path]',
  name: '[Name]',
  component: () => import('@/views/[Name]View.vue'),
  meta: { requiresAuth: true }
},
// Falls Detail-View:
{
  path: '/[path]/:id',
  name: '[Name]Detail',
  component: () => import('@/views/[Name]DetailView.vue'),
  meta: { requiresAuth: true }
},
```

### Schritt 4: Sidebar-Eintrag (falls neue Seite)

`packages/client/src/components/layout/Sidebar.vue`

```typescript
// In navItems Array einfügen:
{
  label: '[Label]',
  path: '/[path]',
  icon: '[IconName]',
  appColor: 'var(--[app])',
  section: 'library' // oder 'discover' | 'system'
}
```

### Schritt 5: Validierung

```bash
npx tsc --noEmit
# Muss fehlerfrei sein
```

### Schritt 6: Commit

```bash
git add -A
git commit -m "feat([name]): add [Name]View with poster/focus/list grid"
```

---

## Detail-View Zusatz-Schritte

Für Detail-Views (Movie Detail, Series Detail etc.) zusätzlich:

1. `HeroSection.vue` nutzen für Fanart-Header
2. Tab-Navigation implementieren (Übersicht / Dateien / History / Suche)
3. Route-Param `id` via `useRoute().params.id` auslesen
4. Einzelnen Store-Eintrag via `store.itemById(id)` laden
5. Falls nicht im Store: direkten API-Call für Details

---

## Häufige Fehler vermeiden

- ❌ Kein `document.getElementById` in Vue
- ❌ Kein `window.location.href` – immer `router.push()`
- ❌ Kein Options API
- ❌ Kein hardcoded Farb-Hex in CSS – immer CSS Variables
- ❌ App-Farbe niemals als `color:` Text-Farbe für Body-Text
- ✅ `viewMode` Präferenz in localStorage oder SQLite speichern
- ✅ Skeleton Loading State während Daten laden
- ✅ Empty State wenn keine Ergebnisse
- ✅ Mobile Responsive von Anfang an
