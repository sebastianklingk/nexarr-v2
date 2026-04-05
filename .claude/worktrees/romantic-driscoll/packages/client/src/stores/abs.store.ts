import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ABSLibrary, ABSLibraryItem } from '@nexarr/shared';

export const useAbsStore = defineStore('abs', () => {
  const libraries     = ref<ABSLibrary[]>([]);
  const activeLibId   = ref<string | null>(null);
  const items         = ref<ABSLibraryItem[]>([]);
  const totalItems    = ref(0);
  const currentPage   = ref(0);
  const isLoading     = ref(false);
  const isLoadingMore = ref(false);
  const error         = ref<string | null>(null);
  const configured    = ref(true);
  const searchQuery   = ref('');
  const searchResults = ref<ABSLibraryItem[]>([]);
  const isSearching   = ref(false);

  const PAGE_SIZE = 40;
  const hasMore = computed(() => items.value.length < totalItems.value);

  const activeLibrary = computed(() =>
    libraries.value.find(l => l.id === activeLibId.value) ?? null
  );

  async function fetchLibraries() {
    try {
      const res = await fetch('/api/abs/libraries', { credentials: 'include' });
      if (res.status === 503) { configured.value = false; return; }
      if (!res.ok) throw new Error();
      libraries.value = await res.json();
      configured.value = true;
      if (libraries.value.length && !activeLibId.value) {
        activeLibId.value = libraries.value[0].id;
      }
    } catch {
      error.value = 'ABS nicht erreichbar';
    }
  }

  async function loadItems(libId?: string) {
    const id = libId ?? activeLibId.value;
    if (!id) return;
    if (libId && libId !== activeLibId.value) {
      activeLibId.value = libId;
      items.value = [];
      currentPage.value = 0;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(
        `/api/abs/libraries/${id}/items?limit=${PAGE_SIZE}&page=0`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      items.value = data.items;
      totalItems.value = data.total;
      currentPage.value = 0;
    } catch {
      error.value = 'Bücher konnten nicht geladen werden';
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    if (!activeLibId.value || !hasMore.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
    try {
      const nextPage = currentPage.value + 1;
      const res = await fetch(
        `/api/abs/libraries/${activeLibId.value}/items?limit=${PAGE_SIZE}&page=${nextPage}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      items.value.push(...data.items);
      currentPage.value = nextPage;
    } finally {
      isLoadingMore.value = false;
    }
  }

  async function search(q: string) {
    if (!activeLibId.value || !q.trim()) {
      searchResults.value = [];
      return;
    }
    isSearching.value = true;
    try {
      const res = await fetch(
        `/api/abs/libraries/${activeLibId.value}/search?q=${encodeURIComponent(q)}`,
        { credentials: 'include' }
      );
      searchResults.value = res.ok ? await res.json() : [];
    } finally {
      isSearching.value = false;
    }
  }

  function coverUrl(itemId: string): string {
    return `/api/abs/items/${itemId}/cover`;
  }

  return {
    libraries, activeLibId, activeLibrary, items, totalItems, currentPage,
    isLoading, isLoadingMore, error, configured, searchQuery, searchResults,
    isSearching, hasMore, coverUrl,
    fetchLibraries, loadItems, loadMore, search,
  };
});
