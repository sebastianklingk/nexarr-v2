import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as gotifyService from '../services/gotify.service.js';

const router = Router();

router.get('/messages', requireAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 40;
    res.json(await gotifyService.getMessages(limit));
  } catch (e) { next(e); }
});

router.delete('/messages/:id', requireAuth, async (req, res, next) => {
  try {
    await gotifyService.deleteMessage(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/messages', requireAuth, async (req, res, next) => {
  try {
    await gotifyService.deleteAllMessages();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/health', requireAuth, async (_req, res, next) => {
  try { res.json(await gotifyService.getHealth()); } catch (e) { next(e); }
});

export { router as gotifyRouter };
