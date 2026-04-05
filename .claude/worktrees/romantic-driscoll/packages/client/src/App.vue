<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useAuthStore } from './stores/auth.store.js';
import { useGotifyStore } from './stores/gotify.store.js';
import { computed, watch } from 'vue';
import Sidebar from './components/layout/Sidebar.vue';
import ToastContainer from './components/layout/ToastContainer.vue';

const auth   = useAuthStore();
const gotify = useGotifyStore();
const isLoggedIn = computed(() => auth.isLoggedIn);

// Gotify-Polling starten sobald eingeloggt
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) gotify.startPolling();
  else          gotify.stopPolling();
}, { immediate: true });
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
      <ToastContainer />
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
