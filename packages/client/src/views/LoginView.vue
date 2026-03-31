<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.store.js';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref('');
const password = ref('');
const error = ref('');
const isLoading = ref(false);

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = 'Benutzername und Passwort erforderlich';
    return;
  }

  isLoading.value = true;
  error.value = '';

  try {
    await auth.login(username.value, password.value);
    const redirect = route.query.redirect as string | undefined;
    router.push(redirect ?? '/dashboard');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login fehlgeschlagen';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-logo">
        <div class="logo-mark">n</div>
        <span class="logo-text">nexarr</span>
      </div>

      <p class="login-subtitle">Media Dashboard</p>

      <!-- Form -->
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label for="username" class="field-label">Benutzername</label>
          <input
            id="username"
            v-model="username"
            type="text"
            class="field-input"
            placeholder="admin"
            autocomplete="username"
            :disabled="isLoading"
          />
        </div>

        <div class="field">
          <label for="password" class="field-label">Passwort</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="field-input"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="isLoading"
          />
        </div>

        <div v-if="error" class="login-error">
          {{ error }}
        </div>

        <button type="submit" class="login-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner" />
          <span v-else>Anmelden</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  padding: var(--space-4);
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.login-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logo-mark {
  width: 40px;
  height: 40px;
  background: var(--accent);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 22px;
  color: #fff;
}

.logo-text {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.login-subtitle {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-top: -var(--space-2);
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-2);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.field-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-base);
  transition: border-color 0.15s ease;
  outline: none;
}

.field-input:focus {
  border-color: var(--accent);
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-error {
  padding: var(--space-3) var(--space-4);
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--radius-md);
  color: var(--status-error);
  font-size: var(--text-sm);
  text-align: center;
}

.login-btn {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

.login-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Spinner */
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
