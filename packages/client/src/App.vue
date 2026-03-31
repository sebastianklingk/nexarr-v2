<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useAuthStore } from './stores/auth.store.js';
import { computed } from 'vue';
import Sidebar from './components/layout/Sidebar.vue';

const auth = useAuthStore();
const isLoggedIn = computed(() => auth.isLoggedIn);
</script>

<template>
  <div id="app-shell">
    <template v-if="isLoggedIn">
      <Sidebar />
      <main class="main-content">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </template>
    <template v-else>
      <RouterView />
    </template>
  </div>
</template>

<style>
#app-shell {
  display: flex;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-base);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

/* Page Transitions */
.page-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-active {
  transition: opacity 0.12s ease;
}
.page-leave-to {
  opacity: 0;
}
</style>
