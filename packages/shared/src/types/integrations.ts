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
  rootFolderPath?: string;
  path?: string;
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
    videoDynamicRangeType?: string;
    videoDynamicRange?: string;
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
  tmdbId?: number;
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
  rootFolderPath?: string;
  path?: string;
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

// ─── Bazarr ─────────────────────────────────────────────────────────────────

export interface BazarrSubtitle {
  code2: string;          // ISO 639-1 z.B. 'de', 'en'
  name: string;           // z.B. 'German'
  path?: string;          // Pfad zur SRT-Datei
  forced: boolean;
  hi: boolean;            // Hearing Impaired
  format?: string;        // 'srt', 'ass', etc.
  provider?: string;
  score?: number;
}

export interface BazarrWantedMovie {
  radarrId: number;
  title: string;
  missing_subtitles: BazarrSubtitle[];
}

// ─── TMDB ────────────────────────────────────────────────────────────────────

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBVideo {
  id: string;
  key: string;        // YouTube-Key
  name: string;
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | 'Behind the Scenes' | 'Bloopers' | string;
  site: 'YouTube' | 'Vimeo' | string;
  official: boolean;
}

export interface TMDBVideos {
  results: TMDBVideo[];
}

// ─── Gotify ─────────────────────────────────────────────────────────────────

export interface GotifyMessage {
  id: number;
  appid: number;
  message: string;
  title: string;
  priority: number;
  date: string;   // ISO-String
  extras?: Record<string, unknown>;
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

// ─── Audiobookshelf (ABS) ───────────────────────────────────────────────────

export interface ABSLibrary {
  id: string;
  name: string;
  mediaType: 'book' | 'podcast';
  icon: string;
}

export interface ABSBookMetadata {
  title: string;
  titleIgnorePrefix: string;
  subtitle?: string;
  authorName?: string;
  narratorName?: string;
  seriesName?: string;
  genres: string[];
  description?: string;
  language?: string;
  publishedYear?: string;
}

export interface ABSPodcastMetadata {
  title: string;
  author?: string;
  description?: string;
  genres: string[];
  language?: string;
}

export interface ABSLibraryItem {
  id: string;
  libraryId: string;
  mediaType: 'book' | 'podcast';
  media: {
    metadata: ABSBookMetadata | ABSPodcastMetadata;
    coverPath?: string;
    numTracks?: number;         // Books
    numEpisodes?: number;       // Podcasts
    duration?: number;          // Sekunden
  };
  addedAt: number;             // Unix-Timestamp ms
  updatedAt: number;
}

export interface ABSProgress {
  libraryItemId: string;
  isFinished: boolean;
  progress: number;            // 0.0 – 1.0
  currentTime: number;         // Sekunden
  duration: number;            // Sekunden
  lastUpdate: number;          // Unix-Timestamp ms
}

export interface ABSPodcastEpisode {
  id: string;
  title: string;
  description?: string;
  pubDate?: string;
  audioFile?: { duration: number };
  season?: string;
  episode?: string;
}
