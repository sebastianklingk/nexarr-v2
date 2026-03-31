// ─── Radarr ───────────────────────────────────────────────────────────────────

export interface RadarrMovie {
  id: number;
  title: string;
  originalTitle: string;
  sortTitle: string;
  year: number;
  overview: string;
  runtime: number;
  imdbId?: string;
  tmdbId: number;
  genres: string[];
  ratings: {
    imdb?: { value: number; votes: number };
    tmdb?: { value: number; votes: number };
    rottenTomatoes?: { value: number };
  };
  images: Array<{ coverType: 'poster' | 'fanart' | 'banner'; remoteUrl: string }>;
  hasFile: boolean;
  isAvailable: boolean;
  monitored: boolean;
  status: string;
  qualityProfileId: number;
  sizeOnDisk?: number;
  movieFile?: RadarrMovieFile;
  added: string;
  digitalRelease?: string;
  physicalRelease?: string;
  inCinemas?: string;
}

export interface RadarrMovieFile {
  id: number;
  quality: { quality: { name: string; resolution: number } };
  size: number;
  mediaInfo?: {
    videoCodec: string;
    audioCodec: string;
    audioChannels: number;
    resolution: string;
  };
}

// ─── Sonarr ───────────────────────────────────────────────────────────────────

export interface SonarrSeries {
  id: number;
  title: string;
  sortTitle: string;
  year: number;
  overview: string;
  network: string;
  runtime: number;
  tvdbId: number;
  tvMazeId?: number;
  imdbId?: string;
  genres: string[];
  ratings: { value: number; votes: number };
  images: Array<{ coverType: 'poster' | 'fanart' | 'banner'; remoteUrl: string }>;
  seasons: SonarrSeason[];
  status: 'continuing' | 'ended' | 'upcoming';
  seriesType: string;
  monitored: boolean;
  qualityProfileId: number;
  sizeOnDisk: number;
  episodeCount?: number;
  episodeFileCount?: number;
  added: string;
}

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
  statistics?: {
    episodeCount: number;
    episodeFileCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
  };
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  overview?: string;
  airDate?: string;
  airDateUtc?: string;
  hasFile: boolean;
  monitored: boolean;
  episodeFileId?: number;
}

// ─── Lidarr ───────────────────────────────────────────────────────────────────

export interface LidarrArtist {
  id: number;
  artistName: string;
  sortName: string;
  overview?: string;
  genres: string[];
  ratings: { value: number; votes: number };
  images: Array<{ coverType: 'poster' | 'fanart' | 'banner'; remoteUrl: string }>;
  status: string;
  monitored: boolean;
  qualityProfileId: number;
  metadataProfileId: number;
  albumCount?: number;
  path: string;
  added: string;
  foreignArtistId: string;
}

export interface LidarrAlbum {
  id: number;
  title: string;
  artistId: number;
  artist?: LidarrArtist;
  albumType: string;
  releaseDate?: string;
  overview?: string;
  genres: string[];
  ratings: { value: number; votes: number };
  images: Array<{ coverType: 'cover' | 'disc'; remoteUrl: string }>;
  statistics?: { trackCount: number; trackFileCount: number; sizeOnDisk: number };
  monitored: boolean;
  foreignAlbumId: string;
}

// ─── Tautulli ────────────────────────────────────────────────────────────────

export interface TautulliStream {
  session_id: string;
  user: string;
  friendly_name: string;
  title: string;
  grandparent_title?: string;   // Serie
  parent_media_index?: string;  // Staffel
  media_index?: string;         // Episode
  year?: string;
  media_type: 'movie' | 'episode' | 'track';
  state: 'playing' | 'paused' | 'buffering';
  progress_percent: string;
  view_offset: number;
  duration: number;
  stream_video_resolution?: string;
  stream_video_codec?: string;
  stream_audio_codec?: string;
  stream_container?: string;
  transcode_decision?: 'direct play' | 'copy' | 'transcode';
  ip_address?: string;
  platform?: string;
  player?: string;
  thumb?: string;
  grandparent_thumb?: string;
  rating_key: string;
}

export interface TautulliActivity {
  stream_count: number;
  sessions: TautulliStream[];
  stream_count_direct_play: number;
  stream_count_direct_stream: number;
  stream_count_transcode: number;
  total_bandwidth: number;
  lan_bandwidth: number;
  wan_bandwidth: number;
}

// ─── Overseerr ────────────────────────────────────────────────────────────────

export interface OverseerrRequest {
  id: number;
  status: number;       // 1=pending, 2=approved, 3=declined, 4=available
  type: 'movie' | 'tv';
  requestedBy: { id: number; displayName: string; avatar?: string };
  createdAt: string;
  updatedAt: string;
  media: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    status: number;
    title?: string;
    posterPath?: string;
  };
}

// ─── Prowlarr ─────────────────────────────────────────────────────────────────

export interface ProwlarrResult {
  guid: string;
  indexerId: number;
  indexer: string;
  title: string;
  size: number;
  seeders?: number;
  leechers?: number;
  protocol: 'usenet' | 'torrent';
  categories: Array<{ id: number; name: string }>;
  publishDate?: string;
  downloadUrl?: string;
  infoUrl?: string;
}

// ─── SABnzbd ──────────────────────────────────────────────────────────────────

export interface SabnzbdQueueItem {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: string;
  mb: string;
  mbleft: string;
  eta: string;
  timeleft: string;
  cat: string;
}

export interface SabnzbdQueue {
  status: string;
  speed: string;
  speedlimit: string;
  mb: string;
  mbleft: string;
  noofslots: number;
  jobs: SabnzbdQueueItem[];
}
