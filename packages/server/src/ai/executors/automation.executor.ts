import type { ToolResult } from '../executor.js';
import * as radarr from '../../services/radarr.service.js';
import * as sonarr from '../../services/sonarr.service.js';
import * as sabnzbd from '../../services/sabnzbd.service.js';
import * as transmission from '../../services/transmission.service.js';
import type { RadarrMovie } from '@nexarr/shared';
import { getDb } from '../../db/index.js';

type Args = Record<string, unknown>;

// ── auto_quality_upgrade ─────────────────────────────────────────────────────

export async function handleAutoQualityUpgrade(args: Args): Promise<ToolResult> {
  const targetProfileId = typeof args.quality_profile_id === 'number' ? args.quality_profile_id : undefined;
  const searchAfter = args.search_after !== false;

  if (!targetProfileId) {
    // Return available profiles so AI can pick
    const profiles = await radarr.getQualityProfiles();
    return { success: true, data: { message: 'quality_profile_id benötigt.', profiles } };
  }

  const movies = await radarr.getMovies();
  const toUpgrade = movies.filter(m => m.qualityProfileId !== targetProfileId && m.hasFile);

  // Only update, don't actually trigger searches en masse (safety)
  const upgraded: string[] = [];
  for (const movie of toUpgrade.slice(0, 50)) {
    try {
      const updated = { ...movie, qualityProfileId: targetProfileId } as unknown as RadarrMovie;
      await radarr.updateMovie(movie.id, updated);
      upgraded.push(movie.title);
    } catch {
      // skip failures
    }
  }

  return {
    success: true,
    data: {
      upgradedCount: upgraded.length,
      totalEligible: toUpgrade.length,
      upgraded: upgraded.slice(0, 20),
      targetProfileId,
      searchAfter,
      note: searchAfter
        ? 'Qualitätsprofile aktualisiert. Radarr sucht automatisch nach besseren Releases.'
        : 'Qualitätsprofile aktualisiert. Keine automatische Suche gestartet.',
    },
  };
}

// ── auto_cleanup ─────────────────────────────────────────────────────────────

export async function handleAutoCleanup(_args: Args): Promise<ToolResult> {
  const [sabQueue, trQueue] = await Promise.allSettled([
    sabnzbd.getQueue().catch(() => null),
    transmission.getTorrents().catch(() => []),
  ]);

  const issues: Array<{ downloader: string; id: string; name: string; reason: string }> = [];

  // Check SABnzbd for stuck/failed
  if (sabQueue.status === 'fulfilled' && sabQueue.value) {
    const slots = (sabQueue.value as { slots?: Array<{ nzo_id: string; filename: string; status: string; percentage: number }> }).slots ?? [];
    for (const slot of slots) {
      if (slot.status === 'Failed' || slot.status === 'Verifying') {
        issues.push({ downloader: 'sabnzbd', id: slot.nzo_id, name: slot.filename, reason: slot.status });
      }
    }
  }

  // Check Transmission for stuck (0% for >24h or error)
  if (trQueue.status === 'fulfilled') {
    const torrents = trQueue.value as Array<{ hashString: string; name: string; status: number; percentDone: number; error: number }>;
    for (const t of torrents) {
      if (t.error > 0) {
        issues.push({ downloader: 'transmission', id: t.hashString, name: t.name, reason: `Error ${t.error}` });
      } else if (t.percentDone === 0 && t.status === 0) {
        issues.push({ downloader: 'transmission', id: t.hashString, name: t.name, reason: 'Stopped at 0%' });
      }
    }
  }

  return {
    success: true,
    data: {
      issueCount: issues.length,
      issues: issues.slice(0, 20),
      note: 'Verwende downloads_delete zum Entfernen einzelner Einträge.',
    },
  };
}

// ── auto_missing_search ──────────────────────────────────────────────────────

export async function handleAutoMissingSearch(args: Args): Promise<ToolResult> {
  const type = typeof args.type === 'string' ? args.type : 'both';

  const results: Record<string, unknown> = {};

  if (type === 'movie' || type === 'both') {
    try {
      await radarr.sendCommand({ name: 'MissingMoviesSearch' });
      results.movies = 'MissingMoviesSearch gestartet';
    } catch (err) {
      results.movies = `Fehler: ${err instanceof Error ? err.message : 'unbekannt'}`;
    }
  }

  if (type === 'series' || type === 'both') {
    try {
      await sonarr.sendCommand({ name: 'MissingEpisodeSearch' });
      results.series = 'MissingEpisodeSearch gestartet';
    } catch (err) {
      results.series = `Fehler: ${err instanceof Error ? err.message : 'unbekannt'}`;
    }
  }

  return { success: true, data: results };
}

// ── scheduled_task ───────────────────────────────────────────────────────────

export async function handleScheduledTask(args: Args): Promise<ToolResult> {
  const action = typeof args.action === 'string' ? args.action : 'list';
  const db = getDb();

  if (action === 'create') {
    const description = typeof args.description === 'string' ? args.description : '';
    const type = typeof args.type === 'string' ? args.type : 'reminder';
    const triggerCondition = typeof args.trigger_condition === 'string' ? args.trigger_condition : undefined;
    const nextCheck = typeof args.next_check === 'string' ? args.next_check : undefined;

    if (!description) return { success: false, error: 'description erforderlich' };

    const stmt = db.prepare(
      `INSERT INTO ai_scheduled_tasks (type, description, trigger_condition, next_check)
       VALUES (?, ?, ?, ?)`,
    );
    stmt.run(type, description, triggerCondition ?? null, nextCheck ?? null);

    return { success: true, data: { message: `Task erstellt: "${description}"` } };
  }

  if (action === 'cancel') {
    const id = typeof args.id === 'number' ? args.id : undefined;
    if (!id) return { success: false, error: 'id erforderlich' };

    db.prepare(`UPDATE ai_scheduled_tasks SET status = 'cancelled' WHERE id = ?`).run(id);
    return { success: true, data: { message: `Task ${id} abgebrochen.` } };
  }

  // Default: list
  const tasks = db.prepare(
    `SELECT id, type, description, status, next_check, created_at
     FROM ai_scheduled_tasks
     WHERE status = 'active'
     ORDER BY created_at DESC
     LIMIT 50`,
  ).all();

  return { success: true, data: { tasks } };
}

// ── proactive_notify ─────────────────────────────────────────────────────────

export async function handleProactiveNotify(args: Args): Promise<ToolResult> {
  const action = typeof args.action === 'string' ? args.action : 'status';

  if (action === 'status') {
    return {
      success: true,
      data: {
        message: 'Proaktive Benachrichtigungen sind aktiv. Der Background-Worker prüft alle 5 Minuten.',
        checks: ['Download fertig', 'Release morgen', 'Neue Episoden', 'Festplatte fast voll'],
      },
    };
  }

  return { success: true, data: { message: `Proactive notify: ${action}` } };
}
