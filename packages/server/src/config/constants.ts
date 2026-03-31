export const TTL = {
  COLLECTION: 5 * 60 * 1000,   // 5 min – Filmlisten, Serielisten
  DETAIL:     10 * 60 * 1000,  // 10 min – Einzelne Film/Serien-Details
  QUEUE:      15 * 1000,       // 15 sec – Download Queue (sehr flüchtig)
  STATS:      2 * 60 * 1000,   // 2 min – Tautulli Stats
  HISTORY:    3 * 60 * 1000,   // 3 min – History-Einträge
  SEARCH:     60 * 1000,       // 1 min – Suchergebnisse
  CALENDAR:   5 * 60 * 1000,   // 5 min – Kalender
  LONG:       30 * 60 * 1000,  // 30 min – Selten ändernde Daten
} as const;

export const APP_COLORS = {
  radarr:    '#F4A54A',
  sonarr:    '#35C5F4',
  lidarr:    '#22C65B',
  prowlarr:  '#FF7F50',
  sabnzbd:   '#F5C518',
  tautulli:  '#E5C06D',
  overseerr: '#7C4DFF',
  bazarr:    '#A78BFA',
  gotify:    '#0060A8',
  plex:      '#E5A00D',
  tmdb:      '#01B4E4',
  abs:       '#F0A500',
  nexarr:    '#9b0045',
} as const;
