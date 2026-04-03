import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Auth deaktiviert → immer durchlassen (Fake-Admin-Session setzen)
  if (env.AUTH_DISABLED) {
    req.session.userId = 1;
    req.session.username = 'admin';
    req.session.userRole = 'admin';
    next();
    return;
  }

  if (req.session?.userId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function requireRole(role: 'admin' | 'viewer' | 'requester') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (env.AUTH_DISABLED) {
      next();
      return;
    }

    const userRole = req.session?.userRole;
    if (userRole === 'admin' || userRole === role) {
      next();
      return;
    }
    res.status(403).json({ error: 'Forbidden' });
  };
}
