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
    imdb?:           { value: number; votes: number };
    tmdb?:           { value: number; votes: number };
    trakt?:          { value: number; votes: number };
    rottenTomatoes?: { value: number };
    metacritic?:     { value: number };
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
  ratings: {
    // Sonarr v4 multi-source
    imdb?:          { value: number; votes: number };
    tmdb?:          { value: number; votes: number };
    trakt?:         { value: number; votes: number };
    rottenTomatoes?:{ value: number };
    metacritic?:    { value: number };
    // Sonarr v3 single-value fallback
    value?:  number;
    votes?:  number;
  };
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
  session_key?: string;
  session_id: string;
  // ── User ──
  user_id?: number;
  user: string;
  friendly_name: string;
  user_thumb?: string;
  email?: string;
  // ── Media ──
  title: string;
  grandparent_title?: string;   // Serie / Künstler
  parent_title?: string;        // Staffel / Album
  original_title?: string;
  year?: string;
  media_type: 'movie' | 'episode' | 'track' | 'clip';
  media_index?: string;         // Episode-Nr
  parent_media_index?: string;  // Staffel-Nr
  rating_key: string;
  parent_rating_key?: string;
  grandparent_rating_key?: string;
  full_title?: string;
  // ── Poster / Art ──
  thumb?: string;
  parent_thumb?: string;
  grandparent_thumb?: string;
  art?: string;
  // ── Playback ──
  state: 'playing' | 'paused' | 'buffering';
  progress_percent: string;
  view_offset: number;
  duration: number;
  // ── Quality ──
  quality_profile?: string;
  stream_container?: string;
  stream_container_decision?: string;
  // ── Video ──
  video_codec?: string;
  video_resolution?: string;
  video_full_resolution?: string;
  video_bitrate?: number;
  video_bit_depth?: number;
  video_framerate?: string;
  video_dynamic_range?: string;
  video_decision?: string;
  stream_video_codec?: string;
  stream_video_resolution?: string;
  stream_video_full_resolution?: string;
  stream_video_bitrate?: number;
  stream_video_bit_depth?: number;
  stream_video_framerate?: string;
  stream_video_dynamic_range?: string;
  // ── Audio ──
  audio_codec?: string;
  audio_channels?: number;
  audio_channel_layout?: string;
  audio_bitrate?: number;
  audio_language?: string;
  audio_language_code?: string;
  audio_decision?: string;
  stream_audio_codec?: string;
  stream_audio_channels?: number;
  stream_audio_channel_layout?: string;
  stream_audio_bitrate?: number;
  // ── Subtitle ──
  subtitle_codec?: string;
  subtitle_language?: string;
  subtitle_decision?: string;
  stream_subtitle_codec?: string;
  stream_subtitle_language?: string;
  stream_subtitle_decision?: string;
  subtitle_forced?: number;
  // ── Transcode ──
  transcode_decision?: string;
  transcode_container?: string;
  transcode_video_codec?: string;
  transcode_audio_codec?: string;
  transcode_throttled?: number;
  transcode_progress?: number;
  transcode_speed?: string;
  transcode_hw_requested?: number;
  transcode_hw_decoding?: number;
  transcode_hw_encoding?: number;
  // ── Network / Location ──
  ip_address?: string;
  ip_address_public?: string;
  location?: string;
  // ── Player ──
  platform?: string;
  platform_name?: string;
  platform_version?: string;
  product?: string;
  product_version?: string;
  player?: string;
  machine_id?: string;
  // ── Bandwidth ──
  bandwidth?: number;
  stream_bitrate?: number;
  // ── Sonstiges ──
  optimized_version?: number;
  relay?: number;
  secure?: number;
  live?: number;
  channel_call_sign?: string;
  library_name?: string;
  section_id?: string;
  // Index signature für unbekannte Felder
  [key: string]: unknown;
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
