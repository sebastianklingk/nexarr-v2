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

  // Extended fields for combined queue view
  downloadId?: string;           // Downloader-native ID (SABnzbd nzo_id, Transmission hash, etc.)
  quality?: string;              // e.g. "Bluray-1080p"
  languages?: string[];          // e.g. ["German", "English"]
  customFormats?: string[];      // Custom Format names
  downloadClientName?: string;   // e.g. "SABnzbd", "Transmission"
  mediaTitle?: string;           // Film/Serien/Künstler-Name (aus arr API, nicht Release-Titel)
  episodeLabel?: string;         // z.B. "S02E08 · The Curse of Cumberbatch"
  movieId?: number;              // Radarr movie ID (for poster lookup)
  seriesId?: number;             // Sonarr series ID (for poster lookup)
  artistId?: number;             // Lidarr artist ID (for poster lookup)
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
  priority?: string;    // Force / High / Normal / Low
  password?: string;    // Wenn verschlüsselt: Hash/Passwort
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

// ── Multi-Downloader Abstraction ──────────────────────────────────────────────

/**
 * Unterstützte Downloader-Typen.
 * Neue Downloader einfach hier eintragen – der Rest der Architektur passt sich an.
 */
export type DownloaderType = 'sabnzbd' | 'transmission' | 'qbittorrent' | 'nzbget';

/**
 * Normalisiertes Slot-Format – abstrahiert native API-Unterschiede.
 * Gilt für SABnzbd-Jobs UND Transmission-Torrents UND zukünftige Downloader.
 */
export interface NormalizedSlot {
  /** Eindeutige ID: "${downloaderType}:${nativeId}" */
  id: string;
  /** Nativer ID des Downloaders (nzo_id, hash, etc.) */
  nativeId: string;
  downloader: DownloaderType;
  filename: string;
  status: 'downloading' | 'paused' | 'completed' | 'queued' | 'seeding' | 'checking' | 'error';
  percentage: number;         // 0–100
  mbTotal: number;
  mbLeft: number;
  /** Per-Slot Speed (Transmission) oder vererbt von globalem State (SABnzbd) */
  speedMbs?: number;
  timeleft?: string;
  category?: string;
  priority?: string;          // SABnzbd: Force/High/Normal/Low; Transmission: n/a
  /** Verschlüsselung (SABnzbd) */
  encrypted?: boolean;
  password?: string;
  /** Torrent-spezifisch */
  seeds?: number;
  peers?: number;
  seedRatio?: number;
  uploadedMb?: number;
  /** Fähigkeiten des Downloaders – steuert welche Action-Buttons sichtbar sind */
  canPause: boolean;
  canMoveToTop: boolean;
  canSetPriority: boolean;
}

/**
 * Zusammenfassung eines Downloaders für die Stats-Bar und Header-Controls.
 */
export interface DownloaderSummary {
  type: DownloaderType;
  name: string;
  /** CSS-Variablen-Name: '--sabnzbd', '--transmission', etc. */
  cssVar: string;
  isAvailable: boolean;
  paused?: boolean;
  speedMbs?: number;
  totalMb?: number;
  leftMb?: number;
  slotCount: number;
}

// ── Aggregated Queue State ────────────────────────────────────────────────────

export interface QueueState {
  arrItems: ArrQueueItem[];
  /** @deprecated Nutze `slots` + `downloaders` – bleibt für Dashboard-Widgets vorhanden */
  sabnzbd: SabnzbdState | null;
  /** Normalisierte Slots aller konfigurierten Downloader */
  slots: NormalizedSlot[];
  /** Zusammenfassung pro Downloader für Header-Controls + Stats-Bar */
  downloaders: DownloaderSummary[];
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

// ── AI Chat Events ───────────────────────────────────────────────────────────

export interface AiTokenPayload {
  sessionId: string;
  token: string;
  done: boolean;
  /** Nur bei done=true: Gesamte Antwort */
  fullResponse?: string;
  model?: string;
  evalCount?: number;
  totalDuration?: number;
}

export interface AiErrorPayload {
  sessionId: string;
  error: string;
}

export interface AiMessagePayload {
  message: string;
  sessionId?: string;
}

export interface AiToolCallPayload {
  sessionId: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: { success: boolean; error?: string };
}

// ── AI Navigation & Card Events ─────────────────────────────────────────────

export interface AiNavigatePayload {
  sessionId: string;
  path: string;
}

export interface AiOpenUrlPayload {
  sessionId: string;
  url: string;
}

export type AiCardType =
  | 'poster_card'
  | 'media_carousel'
  | 'download_card'
  | 'stream_card'
  | 'calendar_preview'
  | 'action_buttons';

export interface AiCardPayload {
  sessionId: string;
  cardType: AiCardType;
  data: Record<string, unknown>;
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
  'ai:token':          (data: AiTokenPayload) => void;
  'ai:error':          (data: AiErrorPayload) => void;
  'ai:tool_call':      (data: AiToolCallPayload) => void;
  'ai:navigate':       (data: AiNavigatePayload) => void;
  'ai:open_url':       (data: AiOpenUrlPayload) => void;
  'ai:card':           (data: AiCardPayload) => void;
}

// Client → Server
export interface ClientToServerEvents {
  'queue:subscribe':   () => void;
  'queue:unsubscribe': () => void;
  'ai:message':        (data: AiMessagePayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId?: number;
}
