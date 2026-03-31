import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as radarrService from '../services/radarr.service.js';

const router = Router();

router.get('/movies', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const movies = await radarrService.getMovies();
    res.json(movies);
  } catch (err) {
    next(err);
  }
});

router.get('/movies/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const movie = await radarrService.getMovie(Number(req.params.id));
    res.json(movie);
  } catch (err) {
    next(err);
  }
});

router.get('/queue', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const queue = await radarrService.getQueue();
    res.json(queue);
  } catch (err) {
    next(err);
  }
});

router.get('/status', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await radarrService.getStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

export default router;
