import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

interface SessionUser {
  id: number;
  username: string;
  role: 'admin' | 'viewer' | 'requester';
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null);
  const checked = ref(false);

  const isLoggedIn = computed(() => user.value !== null);

  async function checkSession(): Promise<void> {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        user.value = await res.json();
      } else {
        user.value = null;
      }
    } catch {
      user.value = null;
    } finally {
      checked.value = true;
    }
  }

  async function login(username: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Login fehlgeschlagen');
    }

    user.value = await res.json();
  }

  async function logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    user.value = null;
    const router = useRouter();
    router.push('/login');
  }

  return { user, checked, isLoggedIn, checkSession, login, logout };
});
