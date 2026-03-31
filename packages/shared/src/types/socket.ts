// ─── Socket.io Event Types ────────────────────────────────────────────────────

// ── Arr Queue (Radarr / Sonarr / Lidarr) ─────────────────────────────────────

export interface ArrQueueItem {
  id: number;
  title: string;
  size: number;
  sizeleft: number;
  progress: number;              // 0–100
  status: string;
  trackedDownloadState: string;
  protocol: string;
  indexer?: string;
  timeleft?: string;
  errorMessage?: string;
  app: 'radarr' | 'sonarr' | 'lidarr';
}

// Backward-compat alias
export type QueueItem = ArrQueueItem;

// ── SABnzbd ───────────────────────────────────────────────────────────────────

export interface SabnzbdSlot {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: number;   // 0–100
  mbTotal: number;
  mbLeft: number;
  eta: string;
  timeleft: string;
  cat: string;
}

export interface SabnzbdState {
  paused: boolean;
  speedMbs: number;           // MB/s
  speedLimitPercent: number;
  mbTotal: number;
  mbLeft: number;
  slotCount: number;
  slots: SabnzbdSlot[];
}

// ── Aggregated Queue State ────────────────────────────────────────────────────

export interface QueueState {
  arrItems: ArrQueueItem[];
  sabnzbd: SabnzbdState | null;
  totalCount: number;
  updatedAt: number;
}

// ── Other Event Payloads ──────────────────────────────────────────────────────

export interface ActivityItem {
  id: number;
  type: 'download' | 'import' | 'search' | 'grab';
  app: string;
  title: string;
  detail?: string;
  createdAt: number;
}

export interface ActivityState {
  items: ActivityItem[];
}

export interface DownloadEvent {
  app: 'radarr' | 'sonarr' | 'lidarr';
  title: string;
  quality: string;
}

export interface Notification {
  id: number;
  channel: string;
  event: string;
  title: string;
  body?: string;
  status: 'sent' | 'failed';
  createdAt: number;
}

export interface SystemStatus {
  uptime: number;
  cacheKeys: number;
  dbSize: number;
  nodeVersion: string;
}

// ── Socket Event Maps ─────────────────────────────────────────────────────────

// Server → Client
export interface ServerToClientEvents {
  'queue:update':      (data: QueueState)    => void;
  'activity:update':   (data: ActivityState) => void;
  'download:complete': (data: DownloadEvent) => void;
  'notification:new':  (data: Notification)  => void;
  'cache:invalidated': (key: string)         => void;
  'system:status':     (data: SystemStatus)  => void;
}

// Client → Server
export interface ClientToServerEvents {
  'queue:subscribe':   () => void;
  'queue:unsubscribe': () => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId?: number;
}
