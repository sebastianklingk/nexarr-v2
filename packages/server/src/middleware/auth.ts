import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function requireRole(role: 'admin' | 'viewer' | 'requester') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.session?.userRole;
    if (userRole === 'admin' || userRole === role) {
      next();
      return;
    }
    res.status(403).json({ error: 'Forbidden' });
  };
}
