# nexarr v2 – Roadmap Phase 11: v1-Parität + Neue Features
> Erstellt: 01.04.2026 nach vollständiger Analyse von nexarr-v1 (Screenshots + Quellcode)
> Analysierte v1-Seiten: calendar.html, downloads.html, indexer.html, discover.html
> Priorität: CRITICAL > HIGH > MEDIUM > LOW

---

## 0. Fehlende Seiten (komplett neu bauen)

### 11.0.A – IndexerView.vue `[CRITICAL]`
**Status:** In v2-Sidebar NICHT vorhanden. Route `/indexer` fehlt vollständig.  
**v1 Quelle:** `indexer.html`

**Seiten-Aufbau:**
```
Header: "Indexer" · Subtitle "Prowlarr · X Indexer · Y aktiv"
        [↺ Aktualisieren] [↗ Prowlarr öffnen]

Indexer-Health-Widget (Radarr/Sonarr Health Check)
  → grünes "Alles OK" ODER Liste mit Fehler-/Warn-Meldungen
  → Buttons: [Radarr testen] [Sonarr testen]
  → POST /api/radarr/indexer/testall, POST /api/sonarr/indexer/testall

Stats-Row (5 Cards):
  [Indexer 2/2 aktiv] [Grabs 0] [Abfragen 0] [Fehler 0 / Erfolgsrate%] [Erfolgsrate 100%]
  → Daten aus GET /api/prowlarr/indexer + GET /api/prowlarr/stats

Prowlarr Release-Suche Box:
  [🔍 Suchfeld "Filmtitel, Serienname, Künstler..."] [Kategorie-Dropdown] [Suchen-Button]
  Filter-Chips: Protokoll: Alle | Usenet | Torrent
  Sprache: 🇩🇪 Deutsch (Toggle-Chip)
  Sortierung: Score ▼ | Größe | Alter | Seeds
  Results-Liste: Pro Release:
    Titel (fett, word-break) + Badge-Zeile:
      Proto-Badge (blau=Usenet, grün=Torrent)
      Tech-Badges aus Titel geparst: 4K/1080p/720p, DV/HDR10+/HDR, H.265/H.264/AV1,
        REMUX/Blu-ray/WEB-DL/WEBRip, Atmos/TrueHD/DTS-X/DTS-HD/DD+/AAC
      CF-Badges (Custom Formats, nexarr-rosa)
      Sprach-Badge (DE/EN etc. – aus Titel geparst)
      Score-Badge (grün wenn ≥0, rot wenn negativ)
      Indexer-Badge (dunkelgrau)
    Rechts: Größe | Alter | Seeds (farbig: ≥20=grün, ≥5=gelb, >0=orange, 0=rot) | [↓ Laden]-Button
    Laden: POST /api/prowlarr/grab mit {guid, indexerId}
    Laden-Button-States: Normal → "..." → "✓ Geladen" (grün) / "✗" (rot bei Fehler)
  "Weitere laden" Button (zeigt +50)
  Suchzeit + Rohtreffer-Count (z.B. "(1.2s · 142 Rohtreffer)")

Tabs: Indexer | Letzte Grabs | RSS / Neueste
  
Tab Indexer: Grid-Layout
  Getrennt nach Protokoll-Gruppe (USENET Gruppe + TORRENT Gruppe)
  Pro Indexer-Karte:
    Status-Dot (grün+glow wenn aktiv, grau wenn disabled)
    Name (fett)
    Badges: Usenet/Torrent + Public/Private/Semi-Priv
    Stats-Grid: Grabs (mit proportionaler Bar), Abfragen, Antwortzeit (grün/gelb/rot)
    Health-Bar: Erfolgsrate (grün≥95%, gelb≥70%, rot<70%)
    Fehler-Count Badge (nur wenn > 0)
    Disabled-Cards: opacity 0.35

Tab Letzte Grabs: Tabelle
  Spalten: Datum | Titel | Indexer | Protokoll | Größe | Release-Group
  Daten: GET /api/prowlarr/history?pageSize=100 (nur eventType=releaseGrabbed)

Tab RSS / Neueste:
  Neueste Releases via GET /api/prowlarr/search (ohne Query, Kategorie=TV/Movie)
  Sortiert nach Alter (neueste zuerst)
  Gleiche Release-Zeilen-Darstellung wie Suche
```

**Backend benötigt:**
- `GET /api/prowlarr/indexer` ✅ (bereits vorhanden?)
- `GET /api/prowlarr/stats` ✅
- `GET /api/prowlarr/search?q=...&categories=...` ✅
- `POST /api/prowlarr/grab` ✅
- `GET /api/prowlarr/history` ✅
- `POST /api/radarr/indexer/testall` → NEU
- `POST /api/sonarr/indexer/testall` → NEU
- `GET /api/radarr/health` → NEU
- `GET /api/sonarr/health` → NEU

---

### 11.0.B – DiscoverView.vue `[CRITICAL]`
**Status:** In v2 KOMPLETT FEHLEND. Route `/discover` fehlt.  
**v1 Quelle:** `discover.html`

**Seiten-Aufbau:**
```
Header: "Entdecken" · "Trending, Genres & Empfehlungen via TMDB"

Filter-Bar (eine horizontale Leiste):
  Typ: [🎬 Filme] [📺 Serien]
  Zeitraum: [Diese Woche] [Heute]
  Mind. Wertung: Slider (0–9, Step 0.5) + Wert-Anzeige (z.B. "6.0")

Hero-Section (erster Trending-Eintrag, groß):
  Backdrop als Hintergrundbild (rechts transparent ausblendend)
  Links: Poster-Bild (klein)
  Rechts: "🔥 Trending"-Badge, Titel, Jahr/Genres/Bewertung, Overview (3 Zeilen),
           [+ Hinzufügen] / [In Bibliothek öffnen] Buttons + [Details]

Trending Grid-Sektion:
  Titel: "🔥 Trending diese Woche" / "📺 Trending heute"
  Poster-Grid: 130px min-width, auto-fill
  Pro Poster-Karte:
    Poster-Bild (2:3)
    "✓"-Badge oben links (dunkelgrün) wenn in Bibliothek
    "Film" / "Serie"-Badge oben rechts (orange/blau)
    Hover: "+ Hinzufügen" / "Öffnen →" Overlay-Button
    Unten: Titel, Jahr, ★ Rating
  Daten: GET /api/tmdb/trending?type=movie|tv&window=week|day
  Bibliotheks-Status: Vergleich mit lokalem Radarr/Sonarr-Daten

Genre-Sektion:
  Überschrift: "🎭 Nach Genre entdecken"
  Genre-Pillen: Horizontal scrollbar mit Emoji + Name
  Filme-Genres: Action, Abenteuer, Animation, Komödie, Krimi, Doku, Drama, Familie,
                Fantasy, Geschichte, Horror, Musik, Mystery, Romantik, Sci-Fi, Thriller,
                Krieg, Western
  Serien-Genres: Action, Animation, Komödie, Krimi, Doku, Drama, Familie, Kinder,
                 Romantik, Sci-Fi, Horror, Mystery, Thriller, Sci-Fi & Fantasy
  Genre-Grid erscheint unter Pillen nach Klick
  Daten: GET /api/tmdb/discover?type=movie|tv&genre=ID&min_rating=X

Detail-Modal (erscheint bei Klick auf Karte oder "Details"):
  Backdrop-Bild oben (160px hoch, ausgeblendet nach unten)
  [✕]-Button
  Body:
    Poster (90×135px) + floating über Backdrop
    Titel + Jahr
    Original-Titel (kursiv, grau)
    Sub: "Film"/"Serie"-Badge (farbig) + "✓ In Bibliothek" wenn vorhanden
    Genre-Tags
    Ratings: ⭐ X.X (votes-count)
    Overview
    Fakten-Grid: Laufzeit, Staffeln, Episoden, Netzwerk/Studio, Status (farbig),
                 Regie/Erstellt von, Originalsprache, Budget, Einnahmen
    Besetzung: X, Y, Z (kommagetrennt)
    Aktions-Buttons:
      Wenn NICHT in Bibliothek: [+ Zu Radarr/Sonarr hinzufügen] → öffnet Add-Config-Panel
      Wenn in Bibliothek: [→ In nexarr öffnen] (navigiert zu Detail-Seite)
      [Ähnliche] (lädt Similar-Content)
      [🔗 TMDB] (externer Link)
    Add-Config-Panel (klappt unter Buttons auf):
      Root Folder Dropdown
      Qualitätsprofil Dropdown
      Checkboxen: "Überwachen" ✓, "Sofort suchen" ✓
      [Jetzt hinzufügen]-Button
      → POST /api/radarr/movie oder POST /api/sonarr/series
      → Erst Lookup: GET /api/radarr/lookup?term=tmdb:ID
```

**Backend benötigt:**
- `GET /api/tmdb/trending?type=...&window=...` → NEU
- `GET /api/tmdb/discover?type=...&genre=...&min_rating=...` → NEU
- `GET /api/tmdb/movie/:id` ✅ (bereits vorhanden)
- `GET /api/tmdb/tv/:id` → NEU
- `GET /api/tmdb/movie/:id/similar` → NEU
- `GET /api/tmdb/tv/:id/similar` → NEU
- `GET /api/radarr/rootfolder` → als `/api/radarr/rootfolders` ✅
- `GET /api/radarr/qualityprofile` → NEU
- `GET /api/sonarr/rootfolder` → als `/api/sonarr/rootfolders` ✅
- `GET /api/sonarr/qualityprofile` → NEU
- Hinzufügen zu Radarr/Sonarr ✅ (vorhanden)

---

## 1. CalendarView – Vollständiger Ausbau `[CRITICAL]`
**Status:** v2 hat Navigation + Hover-Tooltip. Es fehlen alle v1-Features.  
**Gap-Analyse:**

### 11.1.A – Wochen-Ansicht (7-Spalten-Grid) `[CRITICAL]` ✅
v1 Default-Ansicht ist die Wochen-Grid. v2 hat nur eine Listenansicht.
```
Layout: 7 Spalten-Grid (Mo–So oder So–Sa, je nach Option)
Pro Spalte:
  Header: Datum (Zahl, fett) + Wochentag-Kürzel
  Heute: nexarr-pink border + Hintergrundtönung
  Events:
    Film-Event (orange): Titel + Untertitel (Digital/Kino/Physisch)
    Serien-Event (blau): Serientitel + "S01E03"-Badge rechts
                         Untertitel: Episodentitel (wenn showEpInfo)
                         Zeit: "20:15 Uhr" (wenn showTime)
                         Finale-Icon ★ bei letzter Episode
                         Specials-Icon • bei Staffel 0
    Musik-Event (grün): Künstlername + Album-Untertitel
    "Keine Einträge" Platzhalter wenn leer
  Vollfarbig-Modus: ganzer Event-Hintergrund in App-Farbe (Checkbox in Optionen)
```

### 11.1.B – Monats-Ansicht `[HIGH]` ✅
```
Standard-Monats-Grid: 7 Spalten × 5-6 Zeilen
Tages-Zellen: Nummer + bis zu 4 Events + "+X weitere" Button
Andere-Monats-Tage: opacity 0.2
Heute: pink border + Hintergrund
Tages-Popup: erscheint bei "+X weitere" Klick (fixed-positioned, alle Events)
```

### 11.1.C – Kalenderoptionen-Panel `[HIGH]` ✅
Ausklappbares Panel von rechts (320px) mit Einstellungen:
```
Filme:
  - Kino-Starts anzeigen (Toggle)
  - Digital-Releases anzeigen (Toggle)
  - Physische Releases anzeigen (Toggle)

Serien:
  - Mehrere Episoden zusammenfassen (Toggle) — Season-Pack-Gruppierung
  - Episodeninformationen anzeigen (Toggle) — Titel + Nummer
  - Symbol für Staffel-/Serienfinale (Toggle) — zeigt ★
  - Symbol für Specials (Toggle) — zeigt • bei Staffel 0
  - Symbol: Cutoff nicht erreicht (Toggle) — zeigt ⚠

Musik:
  - Mehrere Alben zusammenfassen (Toggle)
  - Symbol für Schwelle nicht erreicht (Toggle)

Design:
  - Vollfarbige Ereignisse (Toggle) — ganzer Event-Hintergrund in App-Farbe
  - Uhrzeiten anzeigen (Toggle) — "20:15 Uhr" unter Episodentitel

Wochenansicht:
  - Erster Tag der Woche (Select: Montag / Sonntag)
  - Spaltenüberschrift (Select: Wochentag (Do) / Wochentag + Datum / Nur Zahl)

Persistenz: localStorage (Key: 'nx_cal_opts_v1')
```

### 11.1.D – Filter-Toggle-Buttons (kompakt) `[HIGH]` ✅
Drei Icon-Buttons rechts neben Navigation: Radarr-Icon | Sonarr-Icon | Lidarr-Icon
Aktiv = App-Farbe, Inaktiv = grau

### 11.1.E – Ausstrahlungszeit `[HIGH]` ✅
```
v1 berechnet airDateUtc → Lokalzeit via Intl.DateTimeFormat (Timezone: Europe/Berlin)
Zeigt z.B. "20:15 Uhr" unter dem Episodentitel
v2 muss das auch implementieren
```

### 11.1.F – Korrekte Kalender-Daten-Abfrage `[HIGH]`
v1 lädt 3 Monate zurück bis 9 Monate voraus (unmonitored=true)
v2 lädt nur einen 30-Tage-Fenster. Sollte wie v1 einen größeren Range laden.

---

## 2. DownloadsView – Vollständiger Ausbau `[CRITICAL]`

### 11.2.A – Stats-Bar `[HIGH]` ✅
```
4 Karten: Radarr (X Filme) | Sonarr (X Episoden) | Lidarr (X Alben) | SABnzbd (X MB/s · Y Jobs)
Farbige linke Border (App-Farbe)
Klickbar (scrollt zu Queue-Sektion)
```

### 11.2.B – Kombinierte Queue (SABnzbd + Arr zusammen) `[CRITICAL]` ✅
Aktuell zeigt v2 SABnzbd-Slots und Arr-Einträge getrennt. v1 verknüpft sie.
```
Pro kombiniertem Job-Card:
  Linker farbiger Streifen (App-Farbe)
  Poster (34×50px, aus Arr-Eintrag: Movie-Poster oder Serien-Poster oder Artist-Foto)
  Medientitel (klickbar → navigiert zu Detail-Seite)
  Episoden-Label (S01E03 Titel oder "Staffel 1" bei Season-Pack)
  Badges-Zeile: Status | SAB-Badge | Qualität | REPACK | Custom Formats | Sprachen
  Priorität-Dropdown (Force/High/Normal/Low) → POST /api/sabnzbd/job/:id/priority (NEU)
  Aktions-Buttons: Pause/Resume | An Anfang (Top) | Löschen
    An Anfang: POST /api/sabnzbd/job/:id/move → SABnzbd API queue?name=switch&val1=X&val2=0 (NEU)
  SABnzbd-Dateiname (NZB Release Name, mono-Font)
  Fortschrittsbalken (App-Farbe) + % + GB-Fortschritt + ETA + Speed
  Sonarr-Zeile: TV-Icon + Episodentitel
    Season-Pack: aufklappbare Liste aller Episoden
  Verschlüsselungs-Banner (wenn SABnzbd-Job encrypted):
    Roter Banner mit Hash/Passwort + Kopier-Button
  Arr-Einträge ohne SABnzbd-Match: eigene Sektion "In Verarbeitung / Import"
```

### 11.2.C – History-Tab `[HIGH]` ✅
```
Laden: GET /api/radarr/history?pageSize=100
        GET /api/sonarr/history?pageSize=100
        GET /api/lidarr/history?pageSize=50
Sortiert: neueste zuerst
Pro Eintrag:
  Event-Badge: GRAB (blau) | IMPORT (grün) | FEHLER (rot) | GELÖSCHT (orange)
  App-Badge (Radarr/Sonarr/Lidarr)
  Downloader-Badge (SABnzbd/qBit etc.)
  Medientitel + Jahr
  NZB Release Name (monospace)
  Meta-Badges: Quality, REPACK, Sprachen, Release-Group, Dateigröße
  Datum
Pagination: 10 pro Seite, Gesamt-Count
```

### 11.2.D – Fehlend-Tab `[HIGH]` ✅
```
Laden: GET /api/radarr/missing?pageSize=100 (NEU Backend)
        GET /api/sonarr/missing?pageSize=100 (NEU Backend)
        GET /api/lidarr/missing?pageSize=100 (NEU Backend)
Pro Bereich (Filme / Episoden / Alben) mit farbigem Header + Count:
  Grid-Karten: Poster | Titel | Untertitel | [🔍 Suchen]-Button
    Suchen: POST /api/radarr/command {name:'MoviesSearch', movieIds:[id]}
            POST /api/sonarr/command {name:'EpisodeSearch', episodeIds:[id]}
            POST /api/lidarr/command {name:'AlbumSearch', albumIds:[id]}
```

### 11.2.E – SABnzbd Job Priorität + Move-to-Top `[MEDIUM]` ✅
Neue Backend-Endpoints:
- `POST /api/sabnzbd/queue/:nzoId/priority` body: {priority: 'Force'|'High'|'Normal'|'Low'}
- `POST /api/sabnzbd/queue/:nzoId/move` body: {position: 0}

---

## 3. Downloads Backend – Neue Endpoints `[HIGH]`

### 11.3.A – Fehlend-Endpoints ✅
```
GET /api/radarr/missing?pageSize=X → radarrService.getMissing()
  → GET /wanted/missing?pageSize=X&monitored=true
GET /api/sonarr/missing?pageSize=X → sonarrService.getMissing()
  → GET /wanted/missing?pageSize=X&monitored=true
GET /api/lidarr/missing?pageSize=X → lidarrService.getMissingAlbums()
  → GET /wanted/missing?pageSize=X
```

### 11.3.B – History-Endpoints ✅
```
GET /api/radarr/history?pageSize=X → radarrService.getHistory(pageSize)
GET /api/sonarr/history?pageSize=X → sonarrService.getHistory(pageSize)
GET /api/lidarr/history?pageSize=X → lidarrService.getHistory(pageSize)
```

### 11.3.C – SABnzbd Priorität + Move-Top ✅
```
POST /api/sabnzbd/queue/:nzoId/priority → sabnzbdService.setPriority(id, priority)
  → SABnzbd API: queue?name=priority&value=priority&id=nzo_id
POST /api/sabnzbd/queue/:nzoId/move → sabnzbdService.moveToTop(id)
  → SABnzbd API: queue?name=switch&val1=nzo_id&val2=0 (nach oben)
```

---

## 4. TMDB Backend – Neue Endpoints `[HIGH]`

### 11.4.A – Trending
```
GET /api/tmdb/trending?type=movie|tv&window=week|day
→ tmdbService.getTrending(type, window)
→ TMDB API: /trending/{type}/{window}
→ Cache: TTL.STATS (30s - ändert sich täglich/wöchentlich)
→ Response: Array von Trending-Items mit id, title/name, poster_path, backdrop_path,
            overview, vote_average, vote_count, release_date/first_air_date, genre_ids
```

### 11.4.B – Discover
```
GET /api/tmdb/discover?type=movie|tv&genre=ID&min_rating=X&min_votes=X&sort_by=X
→ tmdbService.discover(params)
→ TMDB API: /discover/{type}?with_genres=ID&vote_average.gte=X&vote_count.gte=X&sort_by=X
→ Cache: TTL.STATIC (30min)
```

### 11.4.C – TV Detail
```
GET /api/tmdb/tv/:id
→ tmdbService.getTvDetails(id)
→ TMDB API: /tv/{id}?append_to_response=credits
→ Cache: TTL.DETAIL (60s)
→ Response: volle TV-Serie Details + Credits
```

### 11.4.D – Similar
```
GET /api/tmdb/movie/:id/similar → tmdbService.getSimilarMovies(id) → /movie/{id}/similar
GET /api/tmdb/tv/:id/similar    → tmdbService.getSimilarTv(id) → /tv/{id}/similar
→ Cache: TTL.STATIC (30min)
```

### 11.4.E – Quality Profiles
```
GET /api/radarr/qualityprofiles → radarrService.getQualityProfiles() → /qualityprofile
GET /api/sonarr/qualityprofiles → sonarrService.getQualityProfiles() → /qualityprofile
→ Cache: TTL.STATIC (30min)
```

### 11.4.F – Health + Indexer Test
```
GET /api/radarr/health → radarrService.getHealth() → /health
GET /api/sonarr/health → sonarrService.getHealth() → /health
POST /api/radarr/indexer/testall → radarrService.testAllIndexers() → POST /indexer/testall
POST /api/sonarr/indexer/testall → sonarrService.testAllIndexers() → POST /indexer/testall
→ Kein Cache (immer live)
```

---

## 5. Sidebar – Fehlende Navigation-Punkte `[MEDIUM]`

v1 Sidebar hat zusätzlich:
```
Indexer      → /indexer   (NEU)
Entdecken    → /discover  (NEU)
Streams      → /streams   (vorhanden als Teil v2? check)
Upgrades     → /upgrades  (v1 hat Cutoff-Upgrades-Seite)
```

Aktuell fehlen in v2-Sidebar:
- `/indexer` Route + NavItem
- `/discover` Route + NavItem

---

## 6. Downloads-Ansicht Optik-Polish `[MEDIUM]` ✅

### 11.6.A – Downloader-Badge
```
Pro Job: erkenne Downloader aus Arr-Metadaten (downloadClientName)
Zeige Badge: SAB (gelb) / qBit (grün) / TR (rot) / NZBGet (lila) etc.
```

### 11.6.B – Verschlüsselungs-Erkennung
```
Wenn SABnzbd-Slot status='Paused' und encrypted:
  Roter Banner unterhalb des Job-Titels
  "Download wurde wegen Verschlüsselung angehalten."
  Hash/Passwort anzeigen (aus SABnzbd password-Feld) + Kopier-Button
  Job-Card bekommt rote Border
```

---

## 7. Kalender Backend – Verbesserungen `[MEDIUM]`

### 11.7.A – Erweiterter Datumsbereich
v1 lädt: 3 Monate zurück bis 9 Monate voraus (unmonitored=true)
```
Aktuell: GET /api/calendar?start=...&end=...
→ Backend: Unterstütze größere Ranges (bis 12 Monate)
→ unmonitored=true Parameter weitergeben
```

### 11.7.B – Zeitzone-Support
```
Backend: Zeitzone aus Settings (TIMEZONE-Key) an Frontend übergeben
Frontend: airDateUtc → Lokalzeit via Intl.DateTimeFormat(timezone)
Ergebnis: Korrekte "20:15 Uhr" Anzeige in lokaler Zeitzone
```

---

## 8. Discover Backend – Sidebar-Integration `[MEDIUM]`

### 11.8.A – Sidebar Discover-Badge
Optional: Badge mit Anzahl "neu trending diese Woche" (optional)

---

## 9. Upgrades View (optional) `[LOW]`

v1 hat `/upgrades` - zeigt Inhalte die auf bessere Qualität geprüft werden können.
```
GET /api/radarr/cutoff?monitored=true → Filme die auf bessere Qualität upgraden könnten
GET /api/sonarr/cutoff?monitored=true → Episoden die upgraden könnten
→ Neue View: UpgradesView.vue
→ Pro Eintrag: Poster, Titel, aktuelle Qualität, gewünschte Qualität, [Suchen]-Button
```

---

## 10. Streams View `[LOW]` ✅

v1 hat `/streams` (dedizierte Seite für Live-Plex-Streams).
v2 zeigt Streams nur im Dashboard-Widget.
```
→ Neue View: StreamsView.vue
→ Vollständige Stream-Liste mit Player, User, Transcode-Info, Progress
→ Plex-Streams via GET /api/plex/sessions (bereits vorhanden)
→ Live-Updates via Socket.io
```

---

## Priorisierte Reihenfolge

```
Phase 11.A – Backend (alle neuen Endpoints):
  11.3 (Downloads BE) → 11.4 (TMDB BE) → 11.7 (Kalender BE)

Phase 11.B – Kritische fehlende Views:
  11.0.B DiscoverView → 11.0.A IndexerView

Phase 11.C – Kalender komplett:
  11.1.A Wochen-Grid → 11.1.C Optionen-Panel → 11.1.B Monats-Ansicht
  → 11.1.D Filter-Toggles → 11.1.E Ausstrahlungszeit

Phase 11.D – Downloads vollständig:
  11.2.B Kombinierte Queue → 11.2.C History → 11.2.D Fehlend
  → 11.2.A Stats-Bar → 11.6 Optik-Polish

Phase 11.E – Sidebar + Navigation:
  11.5 Indexer + Discover in Sidebar

Phase 11.F – Optional:
  11.9 Upgrades → 11.10 Streams
```

---

## Technische Entscheidungen

### Kalender Wochenansicht: Datenstrategie
v1 lädt ALLE Daten auf einmal (3 Monate zurück bis 9 Monate voraus) und cached sie in localStorage.
→ v2 soll gleiches Verhalten: großer Range-Load beim Mounting, WebStore für lokalen State,
   re-fetch nur bei Navigation über Monatsgrenzen hinaus.

### Discover: Library-Check
Für den "in Bibliothek"-Check im Discover müssen Radarr-Filme und Sonarr-Serien
im Store geladen sein. Use `moviesStore.movies` + `seriesStore.series` direkt.

### Downloads kombinierte Queue: Key-Matching
SABnzbd-Slots matchen auf `slot.nzo_id` mit Arr-Einträgen via `record.downloadId`.
Bei keinem Match: Arr-Eintrag in separate "In Verarbeitung"-Sektion.

### Kalender: Zeitzonenumrechnung
```typescript
function airDateUtcToLocal(utcStr: string, timezone = 'Europe/Berlin'): { date: string, time: string } {
  const d = new Date(utcStr);
  const date = new Intl.DateTimeFormat('de-DE', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
  const time = new Intl.DateTimeFormat('de-DE', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit'
  }).format(d);
  return { date: date.split('.').reverse().join('-'), time };
}
```

---

## Impact-Matrix

| Feature | User-Value | Dev-Aufwand | Abhängigkeiten |
|---|---|---|---|
| DiscoverView | ⭐⭐⭐⭐⭐ | Hoch (neu) | TMDB BE |
| IndexerView | ⭐⭐⭐⭐ | Mittel (neu) | Prowlarr BE |
| Kalender Woche | ⭐⭐⭐⭐ | Mittel | Zeitzone BE |
| Downloads Kombiniert | ⭐⭐⭐⭐ | Hoch | SABnzbd BE |
| Downloads History | ⭐⭐⭐ | Mittel | History BE |
| Downloads Fehlend | ⭐⭐⭐ | Mittel | Missing BE |
| Kalender Optionen | ⭐⭐⭐ | Mittel | - |
| Kalender Monat | ⭐⭐ | Mittel | - |
| Upgrades View | ⭐⭐ | Mittel | Cutoff BE |
| Streams View | ⭐⭐ | Niedrig | Plex ✅ |

---

_Ende Roadmap Phase 11_
