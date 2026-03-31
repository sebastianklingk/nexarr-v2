// ─── Socket.io Event Types ────────────────────────────────────────────────────

export interface QueueItem {
  id: number;
  title: string;
  size: number;
  sizeleft: number;
  status: string;
  trackedDownloadStatus: string;
  protocol: string;
  app: 'radarr' | 'sonarr' | 'lidarr';
}

export interface QueueState {
  items: QueueItem[];
  totalCount: number;
  updatedAt: number;
}

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

// Server → Client
export interface ServerToClientEvents {
  'queue:update': (data: QueueState) => void;
  'activity:update': (data: ActivityState) => void;
  'download:complete': (data: DownloadEvent) => void;
  'notification:new': (data: Notification) => void;
  'cache:invalidated': (key: string) => void;
  'system:status': (data: SystemStatus) => void;
}

// Client → Server
export interface ClientToServerEvents {
  'queue:subscribe': () => void;
  'queue:unsubscribe': () => void;
}

export interface InterServerEvents {}
export interface SocketData {
  userId?: number;
}
