import { Request, Response, NextFunction, Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet } from '../db/index.js';
import { env } from '../config/env.js';

const router = Router();

interface UserRow {
  id: number;
  username: string;
  password: string;
  role: string;
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Auth deaktiviert → sofort als Admin einloggen
    if (env.AUTH_DISABLED) {
      req.session.userId = 1;
      req.session.username = 'admin';
      req.session.userRole = 'admin';
      res.json({ id: 1, username: 'admin', role: 'admin' });
      return;
    }

    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'Username und Passwort erforderlich' });
      return;
    }

    const user = dbGet<UserRow>('SELECT * FROM users WHERE username = ?', username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Ungültige Anmeldedaten' });
      return;
    }

    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role as 'admin' | 'viewer' | 'requester';

    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  // Auth deaktiviert → Logout ist ein No-Op
  if (env.AUTH_DISABLED) {
    res.json({ ok: true });
    return;
  }

  req.session.destroy((err) => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  // Auth deaktiviert → immer als Admin angemeldet
  if (env.AUTH_DISABLED) {
    res.json({ id: 1, username: 'admin', role: 'admin' });
    return;
  }

  if (!req.session.userId) {
    res.status(401).json({ error: 'Nicht angemeldet' });
    return;
  }
  res.json({
    id:       req.session.userId,
    username: req.session.username,
    role:     req.session.userRole,
  });
});

export default router;
