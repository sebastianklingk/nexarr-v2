import { ref } from 'vue';
import { useRouter } from 'vue-router';

const BASE = '';  // Vite proxy leitet /api/* weiter

export function useApi() {
  const router = useRouter();

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { credentials: 'include' });

    if (res.status === 401) {
      router.push('/login');
      throw new Error('Nicht angemeldet');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return res.json();
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      router.push('/login');
      throw new Error('Nicht angemeldet');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return res.json();
  }

  async function put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      router.push('/login');
      throw new Error('Nicht angemeldet');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return res.json();
  }

  async function del<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return res.json();
  }

  return { get, post, put, del };
}

// Reaktiver Fetch-Helfer für einfache Fälle
export function useFetch<T>(path: string) {
  const data = ref<T | null>(null);
  const error = ref<string | null>(null);
  const isLoading = ref(false);
  const { get } = useApi();

  async function refresh() {
    isLoading.value = true;
    error.value = null;
    try {
      data.value = await get<T>(path);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unbekannter Fehler';
    } finally {
      isLoading.value = false;
    }
  }

  refresh();

  return { data, error, isLoading, refresh };
}
