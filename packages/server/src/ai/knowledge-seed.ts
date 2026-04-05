import { dbGet } from '../db/index.js';
import { ingestMarkdown, deleteBySource } from './knowledge.js';

// ── Static Knowledge Seeds ───────────────────────────────────────────────────
// Werden beim Serverstart einmalig geladen (wenn noch nicht vorhanden).

const NEXARR_HELP = `## Was ist nexarr?
nexarr ist ein self-hosted Media-Management-Dashboard das verschiedene *arr-Services, Download-Clients und Streaming-Dienste in einer einheitlichen Oberfläche vereint.

## Unterstützte Integrationen
### Bibliotheks-Manager
- **Radarr** – Verwaltet Filme. Kann Filme suchen, hinzufügen, überwachen und automatisch herunterladen.
- **Sonarr** – Verwaltet TV-Serien. Überwacht neue Episoden und lädt sie automatisch herunter.
- **Lidarr** – Verwaltet Musik. Überwacht Künstler und lädt neue Alben herunter.

### Download-Clients
- **SABnzbd** – Usenet-Downloader. Lädt NZB-Dateien herunter und entpackt sie automatisch.
- **Transmission** – BitTorrent-Client. Lädt Torrents herunter.

### Medien-Server & Monitoring
- **Plex** – Medien-Server für Streaming auf allen Geräten.
- **Tautulli** – Überwacht Plex-Aktivität: Wer schaut was, Wiedergabe-Statistiken, Stream-Qualität.

### Anfragen & Suche
- **Overseerr** – Anfrage-System für Filme und Serien. User können Medien anfragen, Admins genehmigen/ablehnen.
- **Prowlarr** – Meta-Indexer. Sucht über alle konfigurierten Indexer gleichzeitig nach Releases.

### Sonstiges
- **Bazarr** – Untertitel-Manager. Sucht und lädt fehlende Untertitel automatisch.
- **Gotify** – Push-Benachrichtigungen.
- **TMDB** – The Movie Database. Metadaten, Poster, Trending, Discover.
- **Audiobookshelf** – Hörbuch- und Podcast-Server.

## Views & Navigation
- **Dashboard** – Übersicht: Downloads, Streams, letzte Aktivität
- **Filme (Movies)** – Radarr Film-Bibliothek als Poster-Grid
- **Serien (Series)** – Sonarr Serien-Bibliothek mit Staffel-Details
- **Musik (Music)** – Lidarr Künstler und Alben
- **Downloads** – Aktive Downloads aller Clients, History, Fehlende Medien
- **Kalender** – Kommende Film-Releases und Serien-Episoden (Woche/Monat/Liste)
- **Discover** – TMDB Trending, Genre-basierte Entdeckung, Ähnliche Inhalte
- **Streams** – Live Plex-Streams mit Qualitäts-Details und Transcode-Info
- **Indexer** – Prowlarr Release-Suche, Indexer-Stats, History
- **Einstellungen** – Integration-URLs und API-Keys konfigurieren`;

const QUALITY_GUIDE = `## Video-Qualitäts-Hierarchie (von niedrig nach hoch)
- **HDTV** – TV-Aufnahme, oft 720p, niedrige Bitrate
- **WEBDL-720p** – Web-Download, 720p, gute Qualität für Serien
- **Bluray-720p** – Blu-ray Source, 720p
- **WEBDL-1080p** – Web-Download, 1080p, Standard für Streaming
- **Bluray-1080p** – Blu-ray Source, 1080p, sehr gute Qualität
- **Remux-1080p** – Verlustfreier Blu-ray-Rip, 1080p, ~20-40 GB pro Film
- **WEBDL-2160p** – 4K Web-Download, oft mit HDR
- **Bluray-2160p** – 4K Blu-ray Source
- **Remux-2160p** – Verlustfreier 4K Blu-ray-Rip, ~50-80 GB pro Film, beste Qualität

## HDR-Formate
- **SDR** – Standard Dynamic Range (kein HDR)
- **HDR10** – Basis-HDR, statische Metadaten, breit unterstützt
- **HDR10+** – Dynamische Metadaten (Samsung), besser als HDR10
- **Dolby Vision** – Premium HDR, dynamische Metadaten (pro Szene), beste Qualität

## Audio-Codecs (von niedrig nach hoch)
- **AAC** – Komprimiert, für Streaming, 2.0 oder 5.1
- **AC3 / Dolby Digital** – Standard Blu-ray Audio, 5.1
- **EAC3 / DD+** – Enhanced Dolby Digital, für Streaming mit Atmos
- **DTS** – Alternative zu AC3, 5.1
- **DTS-HD MA** – Verlustfreies DTS, Blu-ray
- **TrueHD** – Dolby verlustfrei, Blu-ray
- **Dolby Atmos** – Objektbasiertes Audio (in TrueHD oder DD+ Container)

## Video-Codecs
- **H.264 / AVC** – Standard, breit kompatibel, größere Dateien
- **H.265 / HEVC** – Effizienter als H.264, ~50% kleinere Dateien bei gleicher Qualität
- **AV1** – Neuster Codec, noch effizienter, aber weniger Hardware-Decoder`;

const TROUBLESHOOTING = `## Häufige Probleme und Lösungen

### Downloads starten nicht
1. Prüfe ob SABnzbd/Transmission läuft und erreichbar ist
2. Prüfe die Download-Client-Einstellungen in Radarr/Sonarr
3. Prüfe ob Indexer korrekt konfiguriert sind (Prowlarr Indexer-Test)

### Film/Serie wird nicht gefunden
1. Prüfe die TMDB/TVDB-ID – manchmal stimmt die Zuordnung nicht
2. Nutze die manuelle Suche (Interactive Search) für mehr Ergebnisse
3. Prüfe ob die richtigen Kategorien in Prowlarr konfiguriert sind

### Streams buffern oder haben schlechte Qualität
1. Prüfe in Tautulli ob Direct Play oder Transcode läuft
2. Direct Play = beste Qualität, kein Serverlast
3. Transcode = Server muss Video umwandeln, höhere CPU/GPU-Last
4. Lösung: Client-App auf Originalqualität stellen, oder Datei in kompatiblem Format herunterladen

### Untertitel fehlen
1. Bazarr prüft automatisch nach fehlenden Untertiteln
2. Manuelle Suche über Bazarr für spezifische Sprachen möglich
3. Sprach-Prioritäten in Bazarr-Einstellungen konfigurieren`;

/**
 * Lädt statische Knowledge-Dokumente in die DB.
 * Wird nur ausgeführt wenn die DB leer ist (einmalig).
 */
export async function seedKnowledge(): Promise<void> {
  // Prüfe ob bereits Einträge vorhanden sind
  const existing = dbGet<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM ai_knowledge WHERE source = 'nexarr_help'"
  );

  if (existing && existing.cnt > 0) {
    console.log('[Knowledge] Seeds bereits vorhanden, überspringe.');
    return;
  }

  console.log('[Knowledge] Starte Seed-Prozess...');

  try {
    await ingestMarkdown('nexarr_help', 'nexarr Hilfe & Features', NEXARR_HELP);
    await ingestMarkdown('media_guide', 'Qualitäts- & Codec-Guide', QUALITY_GUIDE);
    await ingestMarkdown('troubleshooting', 'Fehlerbehebung & FAQ', TROUBLESHOOTING);
    console.log('[Knowledge] Seed abgeschlossen.');
  } catch (err) {
    console.error('[Knowledge] Seed-Fehler:', err instanceof Error ? err.message : err);
  }
}

/**
 * Erneuert alle statischen Knowledge-Seeds (löscht + neu laden).
 */
export async function reseedKnowledge(): Promise<void> {
  deleteBySource('nexarr_help');
  deleteBySource('media_guide');
  deleteBySource('troubleshooting');
  await seedKnowledge();
}
