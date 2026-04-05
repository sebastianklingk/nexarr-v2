import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as radarrService from '../services/radarr.service.js';
import * as sonarrService from '../services/sonarr.service.js';
import * as lidarrService from '../services/lidarr.service.js';

const router = Router();

// GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
// Aggregiert Radarr + Sonarr + Lidarr in einer Response
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now   = new Date();
    const start = (req.query.start as string) ?? now.toISOString().slice(0, 10);
    const end   = (req.query.end   as string) ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [radarr, sonarr, lidarr] = await Promise.allSettled([
      radarrService.getCalendar(start, end),
      sonarrService.getCalendar(start, end),
      lidarrService.getCalendar(start, end),
    ]);

    res.json({
      radarr: radarr.status === 'fulfilled' ? radarr.value : [],
      sonarr: sonarr.status === 'fulfilled' ? sonarr.value : [],
      lidarr: lidarr.status === 'fulfilled' ? lidarr.value : [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
