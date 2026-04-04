import type { ToolResult } from '../executor.js';
import * as sabnzbd from '../../services/sabnzbd.service.js';
import * as transmission from '../../services/transmission.service.js';
import * as queue from '../../services/queue.service.js';

type Args = Record<string, unknown>;

export async function handleDownloadsStatus(): Promise<ToolResult> {
  const state = await queue.getAggregatedQueue();
  return {
    success: true,
    data: {
      totalDownloads: state.slots.length,
      downloaders: state.downloaders.map(d => ({
        name: d.name,
        type: d.type,
        available: d.isAvailable,
        paused: d.paused,
        speedMbs: d.speedMbs ? +d.speedMbs.toFixed(1) : 0,
        slotCount: d.slotCount,
      })),
      activeSlots: state.slots.slice(0, 10).map(s => ({
        id: s.id,
        nativeId: s.nativeId,
        filename: s.filename,
        downloader: s.downloader,
        status: s.status,
        percentage: s.percentage,
        mbLeft: Math.round(s.mbLeft),
        speedMbs: s.speedMbs ? +s.speedMbs.toFixed(1) : undefined,
        timeleft: s.timeleft,
      })),
      arrItems: state.arrItems.slice(0, 5).map(a => ({
        title: a.mediaTitle || a.title,
        app: a.app,
        progress: Math.round(a.progress),
        status: a.status,
        quality: a.quality,
      })),
    },
  };
}

export async function handleDownloadsPause(args: Args): Promise<ToolResult> {
  const dl = String(args.downloader);
  if (dl === 'sabnzbd') {
    await sabnzbd.pause();
  } else if (dl === 'transmission') {
    await transmission.pauseAll();
  } else {
    return { success: false, error: `Unbekannter Downloader: ${dl}` };
  }
  return { success: true, data: { downloader: dl, action: 'paused' } };
}

export async function handleDownloadsResume(args: Args): Promise<ToolResult> {
  const dl = String(args.downloader);
  if (dl === 'sabnzbd') {
    await sabnzbd.resume();
  } else if (dl === 'transmission') {
    await transmission.resumeAll();
  } else {
    return { success: false, error: `Unbekannter Downloader: ${dl}` };
  }
  return { success: true, data: { downloader: dl, action: 'resumed' } };
}

export async function handleDownloadsPauseSingle(args: Args): Promise<ToolResult> {
  const dl = String(args.downloader);
  const id = String(args.id || '');
  if (!id) return { success: false, error: 'id ist erforderlich' };

  if (dl === 'sabnzbd') {
    const action = args.resume === true ? 'resumed' : 'paused';
    if (args.resume === true) {
      await sabnzbd.resumeItem(id);
    } else {
      await sabnzbd.pauseItem(id);
    }
    return { success: true, data: { downloader: dl, id, action } };
  } else if (dl === 'transmission') {
    const action = args.resume === true ? 'resumed' : 'paused';
    if (args.resume === true) {
      await transmission.resumeTorrent(id);
    } else {
      await transmission.pauseTorrent(id);
    }
    return { success: true, data: { downloader: dl, id, action } };
  }
  return { success: false, error: `Unbekannter Downloader: ${dl}` };
}

export async function handleDownloadsDelete(args: Args): Promise<ToolResult> {
  const dl = String(args.downloader);
  const id = String(args.id || '');
  if (!id) return { success: false, error: 'id ist erforderlich' };

  if (dl === 'sabnzbd') {
    await sabnzbd.deleteItem(id);
  } else if (dl === 'transmission') {
    await transmission.deleteTorrent(id, args.deleteFiles === true);
  } else {
    return { success: false, error: `Unbekannter Downloader: ${dl}` };
  }
  return { success: true, data: { downloader: dl, id, action: 'deleted' } };
}

export async function handleDownloadsPriority(args: Args): Promise<ToolResult> {
  const nzoId = String(args.nzoId || '');
  if (!nzoId) return { success: false, error: 'nzoId ist erforderlich (nur SABnzbd)' };

  if (args.moveToTop === true) {
    await sabnzbd.moveToTop(nzoId);
    return { success: true, data: { nzoId, action: 'moved_to_top' } };
  }

  const priority = String(args.priority || 'Normal') as 'Force' | 'High' | 'Normal' | 'Low';
  await sabnzbd.setPriority(nzoId, priority);
  return { success: true, data: { nzoId, priority } };
}

export async function handleDownloadsSpeedLimit(args: Args): Promise<ToolResult> {
  const percent = Number(args.percent);
  if (isNaN(percent) || percent < 0) return { success: false, error: 'percent muss eine positive Zahl sein (0 = kein Limit)' };
  await sabnzbd.setSpeedLimit(percent);
  return { success: true, data: { percent, action: percent === 0 ? 'limit_removed' : 'limit_set' } };
}
