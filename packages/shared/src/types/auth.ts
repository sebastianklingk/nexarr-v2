// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'viewer' | 'requester';
  createdAt: number;
}

export interface SessionUser {
  id: number;
  username: string;
  role: 'admin' | 'viewer' | 'requester';
}
