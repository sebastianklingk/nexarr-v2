# nexarr v2 – Dashboard Rewrite Masterplan
> Erstellt: 05.04.2026
> Ziel: Modulares, customizable, world-class Media Dashboard
> Umsetzung: Claude Code mit MCP-Tools

---

## Übersicht

Das Dashboard wird von einer monolithischen `DashboardView.vue` (~550 Zeilen) zu einer **modularen Widget-Architektur** umgebaut. Jedes Widget ist eine eigenständige Vue-Komponente, die über ein Grid-Layout frei positioniert, ein-/ausgeblendet und in der Größe verändert werden kann.

**Kernprinzipien:**
1. **Modular** – Jedes Widget ist self-contained (eigener Datenladen, eigenes Template)
2. **Customizable** – Layout per Drag & Drop, Widgets per Menü ein-/ausblenden
3. **Persistent** – Layout wird in SQLite gespeichert (pro User)
4. **Responsive** – Breakpoints für Desktop (12 Spalten), Tablet (6), Mobile (2)
5. **Performant** – Widgets laden lazy, nur sichtbare Widgets fetchen Daten

---

## Architektur

### Grid-System: `grid-layout-plus`

**Warum `grid-layout-plus`:**
- Nativer Vue 3 Port von `vue-grid-layout` (bewährteste Lösung)
- `<script setup>` + TypeScript
- Draggable + Resizable + Responsive
- Layout serialisierbar (JSON → SQLite)
- ~15KB gzipped, keine Abhängigkeiten
- Aktiv gepflegt (npm: `grid-layout-plus`)

```bash
npm install grid-layout-plus
```

### Layout-Datenmodell

```typescript
// packages/shared/src/types/dashboard.ts

interface DashboardWidget {
  i: string;          // Widget-ID (z.B. "library-stats", "active-streams")
  x: number;          // Grid-Position X (0-11)
  y: number;          // Grid-Position Y
  w: number;          // Breite in Grid-Einheiten
  h: number;          // Höhe in Grid-Einheiten
  minW?: number;      // Minimum-Breite
  minH?: number;      // Minimum-Höhe
  maxW?: number;
  maxH?: number;
}

interface DashboardConfig {
  id: number;
  userId: number;
  name: string;            // "Default", "Minimal", "Full"
  layout: DashboardWidget[];
  hiddenWidgets: string[];  // IDs ausgeblendeter Widgets
  createdAt: string;
  updatedAt: string;
}

interface WidgetDefinition {
  id: string;
  name: string;           // Anzeigename im Menü
  description: string;    // Kurzbeschreibung
  icon: string;           // Emoji oder SVG-Key
  category: WidgetCategory;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  requiresIntegration?: string[];  // z.B. ['radarr'] – nur zeigen wenn konfiguriert
}

type WidgetCategory =
  | 'library'      // Bibliotheks-Statistiken & Medien
  | 'activity'     // Downloads, Streams, History
  | 'calendar'     // Kalender & Releases
  | 'system'       // Health, Storage, Integrations
  | 'requests'     // Overseerr, Gotify
  | 'discover'     // Trending, Empfehlungen
  | 'external'     // Wetter, Uhr, Notizen
  | 'ai';          // AI-Features
```

### SQLite-Migration

```sql
-- migrations/004_dashboard.sql
CREATE TABLE IF NOT EXISTS dashboard_configs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL DEFAULT 'Default',
  layout      TEXT NOT NULL,      -- JSON: DashboardWidget[]
  hidden      TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);
```

### Backend-Endpunkte

```
GET    /api/dashboard                → aktives Layout des Users
PUT    /api/dashboard                → Layout speichern (layout + hidden)
POST   /api/dashboard/reset          → auf Default zurücksetzen
GET    /api/dashboard/presets         → vordefinierte Layouts (Minimal, Full, Media-Fokus)
```

### Frontend-Architektur

```
packages/client/src/
├── components/dashboard/
│   ├── DashboardGrid.vue           → GridLayout Wrapper + Edit-Mode
│   ├── DashboardToolbar.vue        → Edit/Lock, Widget-Menü, Layout-Presets
│   ├── WidgetWrapper.vue           → Universeller Widget-Container (Header, Resize-Handle)
│   ├── WidgetCatalog.vue           → Drawer/Modal: alle Widgets zum Ein-/Ausblenden
│   └── widgets/
│       ├── index.ts                → Widget-Registry (ID → Component Mapping)
│       │
│       │── ── LIBRARY ──────────────────────────────────
│       ├── LibraryStatsWidget.vue       → Filme/Serien/Musik Zahlen + Sparklines
│       ├── RecentlyAddedWidget.vue      → Horizontaler Poster-Scroll
│       ├── LibraryBreakdownWidget.vue   → Qualitäts-/Genre-/Dekaden-Verteilung
│       ├── MissingMediaWidget.vue       → Fehlende Filme + Episoden (Monitored)
│       │
│       │── ── ACTIVITY ─────────────────────────────────
│       ├── DownloadsWidget.vue          → Queue + Speed + Progress
│       ├── ActiveStreamsWidget.vue       → Tautulli Live-Sessions
│       ├── PlayHistoryWidget.vue        → Letzte Wiedergaben
│       ├── MostWatchedWidget.vue        → Top Filme/Serien (Tautulli Home Stats)
│       │
│       │── ── CALENDAR ─────────────────────────────────
│       ├── UpcomingReleasesWidget.vue   → Nächste 7-14 Tage
│       ├── CalendarMiniWidget.vue       → Kompakter Monatskalender
│       │
│       │── ── SYSTEM ───────────────────────────────────
│       ├── IntegrationHealthWidget.vue  → Status-Dots aller Services
│       ├── StorageWidget.vue            → Disk-Space (Radarr/Sonarr/Lidarr Root Folders)
│       ├── SystemStatusWidget.vue       → Uptime, Memory, Load, Node-Version
│       ├── ServiceHealthWidget.vue      → Radarr/Sonarr/Lidarr Health-Warnungen
│       ├── IndexerStatusWidget.vue      → Prowlarr Indexer Übersicht
│       │
│       │── ── REQUESTS ─────────────────────────────────
│       ├── OverseerrWidget.vue          → Offene Anfragen
│       ├── GotifyWidget.vue             → Letzte Benachrichtigungen
│       ├── BazarrWidget.vue             → Untertitel-Status (fehlend/gewünscht)
│       │
│       │── ── DISCOVER ─────────────────────────────────
│       ├── TrendingWidget.vue           → TMDB Trending Filme/Serien
│       ├── RecommendationsWidget.vue    → AI-Empfehlungen (basierend auf Library)
│       │
│       │── ── EXTERNAL ─────────────────────────────────
│       ├── ClockWidget.vue              → Datum + Uhrzeit
│       ├── WeatherWidget.vue            → Wetter (OpenWeatherMap / wttr.in)
│       ├── QuickLinksWidget.vue         → Shortcuts zu externen Services
│       ├── NotesWidget.vue              → Persönliche Notizen (Markdown)
│       ├── RSSFeedWidget.vue            → RSS-Feed Reader
│       │
│       │── ── AI ───────────────────────────────────────
│       └── AiQuickWidget.vue            → AI-Prompt Schnellzugriff + letzte Antwort
│
├── stores/dashboard.store.ts       → Pinia: Layout CRUD, Widget-Visibility
└── views/DashboardView.vue         → Schlank: nur DashboardGrid + Toolbar
```

---

## Widget-Katalog (28 Widgets)

### Kategorie: Library (4 Widgets)

#### 1. `library-stats` – Bibliotheks-Übersicht
**Datenquelle:** movies.store, series.store, music.store
**Default-Größe:** 12×2 (volle Breite, kompakt)
**Min:** 6×2
**Inhalt:**
- Filme: Total / Verfügbar / Fehlend mit Mini-Progressbar
- Serien: Total / Fortlaufend / Beendet / Episoden-Completion
- Musik: Künstler / Alben / Tracks
- Jede Zelle klickbar → navigiert zur jeweiligen View
- **Neu:** Sparkline der letzten 30 Tage (Zugänge pro Tag) – berechnet aus `added`-Datum
- **Neu:** Gesamtgröße aller Libraries (aus Root-Folders `freeSpace` berechenbar)

#### 2. `recently-added` – Zuletzt hinzugefügt
**Datenquelle:** movies.store, series.store, music.store (sortiert nach `added`)
**Default-Größe:** 12×3
**Min:** 6×3
**Inhalt:**
- Horizontaler Poster-Scroll (wie aktuell, aber verbessert)
- **Neu:** Hover-Tooltip mit Titel, Jahr, Qualität, Größe, Codec-Icons (MediaIcon)
- **Neu:** "Neu seit letztem Besuch" Badge (Session-Tracking)
- Filter-Tabs: Alle / Filme / Serien / Musik (wie bisher)
- Poster-Größe passt sich Widget-Höhe an

#### 3. `library-breakdown` – Bibliotheks-Analyse
**Datenquelle:** movies.store + series.store (computed: Genres, Dekaden, Qualität)
**Default-Größe:** 4×4
**Min:** 3×3
**Inhalt:**
- **Tab 1: Qualität** – Donut-Chart: 4K / 1080p / 720p / SD / Fehlend
- **Tab 2: Genres** – Top-10 Genres als horizontale Bars
- **Tab 3: Dekaden** – Bar-Chart: Filme pro Dekade (2020s, 2010s, 2000s...)
- **Tab 4: Codecs** – Verteilung H.264 / HEVC / AV1 / andere
- Alles aus vorhandenen Store-Daten berechenbar, kein neuer Backend-Call nötig
- Charts via lightweight SVG (kein Chart-Library nötig)

#### 4. `missing-media` – Fehlende Medien
**Datenquelle:** `/api/radarr/missing`, `/api/sonarr/missing`, `/api/lidarr/missing`
**Default-Größe:** 4×4
**Min:** 3×3
**Inhalt:**
- Fehlende Filme (monitored, kein File)
- Fehlende Episoden (Top-Serien mit den meisten fehlenden)
- Pro Item: Poster-Mini, Titel, Qualitätsprofil, Suche-Button
- "Alle suchen" Button pro Kategorie
- Count-Badge im Widget-Header

---

### Kategorie: Activity (4 Widgets)

#### 5. `downloads` – Download-Queue
**Datenquelle:** queue.store (Socket.io live)
**Default-Größe:** 4×5
**Min:** 3×3
**Inhalt:**
- **Neu:** Kombinierte Ansicht: NormalizedSlots + ArrQueueItems gematchtem
- Pro Downloader: Speed, Status (Running/Paused), Jobs
- Pro Job: Filename (gekürzt), Fortschrittsbalken, ETA, Downloader-Badge
- Release-Badges (DV, Atmos, HDR10 etc.) via `releaseBadges()`
- **Neu:** Mini Speed-Graph (letzte 5 Minuten, SVG Sparkline aus Socket.io-History)
- Klick → `/downloads`

#### 6. `active-streams` – Aktive Streams
**Datenquelle:** `/api/tautulli/activity` (Auto-Refresh 5s)
**Default-Größe:** 4×4
**Min:** 3×3
**Inhalt:**
- **Neu:** Poster-Thumbnail pro Stream (Tautulli pms_image_proxy)
- User, Titel, Player + Platform-Icon (platformIcons.ts)
- Fortschrittsbalken mit Prozent
- Decision-Badge: Direct Play (grün) / Transcode (orange)
- Quality + Codec als MediaIcon
- Bandwidth-Summary Footer (WAN/LAN)
- Klick → `/streams`

#### 7. `play-history` – Wiedergabe-History
**Datenquelle:** `/api/tautulli/history`
**Default-Größe:** 4×4
**Min:** 3×3
**Inhalt:**
- Letzte 10-15 Wiedergaben
- Icon (Film/Serie/Musik), Titel, User, Datum
- Quality-Badge
- **Neu:** Gruppierung nach "Heute", "Gestern", "Diese Woche"

#### 8. `most-watched` – Meistgesehen
**Datenquelle:** `/api/tautulli/stats` (home_stats)
**Default-Größe:** 4×4
**Min:** 3×3
**Inhalt:**
- Tabs: Filme / Serien / Nutzer
- Top 5-10 mit Poster-Mini, Titel, Play-Count
- Zeitraum-Auswahl: 7 Tage / 30 Tage / Gesamt
- **Neu:** "Most Popular This Week" Highlight-Card mit größerem Poster

---

### Kategorie: Calendar (2 Widgets)

#### 9. `upcoming-releases` – Nächste Releases
**Datenquelle:** `/api/calendar`
**Default-Größe:** 4×4
**Min:** 3×3
**Inhalt:**
- Nächste 7-14 Tage (konfigurierbar)
- Farbcodiert: Radarr-Gold / Sonarr-Blau / Lidarr-Grün
- Pro Eintrag: Datum, Titel, Typ-Badge, Poster-Mini
- **Neu:** Premiere-▶ und Finale-★ Icons (aus CalendarView)
- **Neu:** hasFile grüner Rand (Episode bereits vorhanden)
- Klick → `/calendar`

#### 10. `calendar-mini` – Mini-Kalender
**Datenquelle:** `/api/calendar`
**Default-Größe:** 3×4
**Min:** 3×3
**Inhalt:**
- Kompakte Monatsansicht (7×5 Grid)
- Dots pro Tag: Gold/Blau/Grün je nach Typ
- Hover auf Tag → Tooltip mit allen Releases
- Heute hervorgehoben
- Klick auf Tag → `/calendar` mit Datum-Parameter

---

### Kategorie: System (5 Widgets)

#### 11. `integration-health` – Service-Status
**Datenquelle:** `/api/system/integrations`
**Default-Größe:** 12×1 (volle Breite, 1 Zeile)
**Min:** 6×1
**Inhalt:**
- Chip pro Integration: Farbiger Dot (grün/rot/grau) + Name + Version
- Wie bisher, aber als eigenständiges Widget verschiebbar
- **Neu:** Klick auf Chip → Link zum externen Service (URL aus Config)

#### 12. `storage` – Speicherplatz
**Datenquelle:** `/api/radarr/rootfolders`, `/api/sonarr/rootfolders`, `/api/lidarr/rootfolders`
**Default-Größe:** 4×3
**Min:** 3×2
**Backend (NEU):** Sonarr + Lidarr Root-Folders Endpunkte hinzufügen
**Inhalt:**
- Pro Root-Folder: Pfad, Gesamtgröße, Frei, Belegt
- Visuell: Horizontale Balken (belegt = farbig, frei = dunkel)
- Farbcodiert pro App (Radarr-Gold, Sonarr-Blau etc.)
- **Neu:** Warnung bei < 10% frei (roter Rand)
- Gesamtsumme ganz oben

#### 13. `system-status` – Server-Info
**Datenquelle:** `/api/system/status`
**Default-Größe:** 3×2
**Min:** 2×2
**Inhalt:**
- Uptime (Tage:Stunden:Minuten)
- Memory (Heap Used / Total) mit Mini-Bar
- CPU Load (1/5/15 min)
- Node.js Version
- nexarr Version (aus package.json)
- **Neu:** Ollama-Status (online/offline, geladene Modelle, VRAM)

#### 14. `service-health` – Health-Warnungen
**Datenquelle:** `/api/radarr/health`, `/api/sonarr/health`, Prowlarr health
**Default-Größe:** 4×3
**Min:** 3×2
**Inhalt:**
- Aggregiert Health-Checks aller *arr-Services
- Pro Warnung: Severity-Icon, Service-Name, Message
- Grün "Alles OK" wenn keine Warnungen
- **Typische Meldungen:** Indexer down, Disk space low, Update available, Import errors

#### 15. `indexer-status` – Indexer-Übersicht
**Datenquelle:** `/api/prowlarr/indexers`
**Default-Größe:** 3×3
**Min:** 3×2
**Inhalt:**
- Indexer-Count: Aktiv / Deaktiviert / Fehlerhaft
- Pro Indexer: Name, Protocol (Usenet/Torrent), Status-Dot
- "Alle testen" Button
- Klick → `/indexer`

---

### Kategorie: Requests (3 Widgets)

#### 16. `overseerr` – Medien-Anfragen
**Datenquelle:** `/api/overseerr/requests`
**Default-Größe:** 4×3
**Min:** 3×3
**Inhalt:**
- Offene Anfragen mit Typ-Badge (Film/Serie)
- Requester, Titel, Status
- **Neu:** Approve/Decline Buttons direkt im Widget
- Klick → `/overseerr`

#### 17. `gotify` – Benachrichtigungen
**Datenquelle:** gotify.store (WebSocket live)
**Default-Größe:** 4×4
**Min:** 3×3
**Inhalt:**
- Letzte 5-8 Nachrichten
- Priority-basierte Farbcodierung (Rot/Gelb/Blau)
- Unread-Count im Header
- **Neu:** Dismiss-Button pro Nachricht
- **Neu:** Gruppierung nach App-Name

#### 18. `bazarr` – Untertitel-Status
**Datenquelle:** `/api/bazarr/wanted/movies`, `/api/bazarr/wanted/series` (NEU)
**Default-Größe:** 3×3
**Min:** 3×2
**Backend (NEU):** Bazarr Wanted-Endpunkte hinzufügen
**Inhalt:**
- Fehlende Untertitel: X Filme / Y Episoden
- Top 5 fehlende Titel mit Poster-Mini
- Sprach-Tags (DE, EN, etc.)
- "Suche starten" Button
- Klick → externe Bazarr-URL

---

### Kategorie: Discover (2 Widgets)

#### 19. `trending` – TMDB Trending
**Datenquelle:** `/api/tmdb/trending`
**Default-Größe:** 6×4
**Min:** 4×3
**Inhalt:**
- Toggle: Filme / Serien / Heute / Diese Woche
- Horizontaler Poster-Scroll mit TMDB-Rating-Badge
- **Neu:** "In Library" Badge wenn Titel bereits in Radarr/Sonarr
- **Neu:** Quick-Add Button (direkt zum Hinzufügen-Modal)
- Klick → `/discover`

#### 20. `recommendations` – AI-Empfehlungen
**Datenquelle:** `/api/ai/library/stats` + AI-generiert
**Default-Größe:** 4×4
**Min:** 3×3
**requiresIntegration:** ['ollama']
**Inhalt:**
- "Basierend auf deiner Library" – 3-5 Empfehlungen
- Poster, Titel, Kurzbeschreibung
- Match-Score (warum empfohlen)
- Cached – wird 1x täglich neu generiert
- Klick → Discover-Detail-Modal

---

### Kategorie: External (5 Widgets)

#### 21. `clock` – Datum & Uhrzeit
**Datenquelle:** Browser-Zeit
**Default-Größe:** 3×2
**Min:** 2×1
**Inhalt:**
- Große Uhrzeit (HH:MM)
- Wochentag, Datum
- **Neu:** Optionale Sekunden-Anzeige
- **Neu:** Optionale zweite Zeitzone

#### 22. `weather` – Wetter
**Datenquelle:** wttr.in API (kein API-Key nötig) oder OpenWeatherMap
**Default-Größe:** 3×2
**Min:** 2×2
**Backend (NEU):** `/api/system/weather?city=X` – Proxy um CORS zu vermeiden
**Inhalt:**
- Aktuelle Temperatur, Beschreibung, Icon (SVG)
- Hoch/Tief des Tages
- 3-Tage Mini-Forecast
- Konfigurierbar: Stadt in Widget-Settings
- **Warum:** Auf einen Blick wissen ob man draußen oder drinnen Filme schaut 😄

#### 23. `quick-links` – Schnellzugriffe
**Datenquelle:** User-konfigurierte Links (SQLite)
**Default-Größe:** 3×2
**Min:** 2×2
**Inhalt:**
- Grid aus klickbaren Tiles
- Pro Tile: Icon (aus App-Farben oder custom), Name, URL
- Vorkonfiguriert: Alle Integration-URLs (Radarr, Sonarr, Plex, etc.)
- **Neu:** Custom Links hinzufügbar (z.B. Unraid WebUI, Pi-hole, etc.)
- Klick → öffnet in neuem Tab

#### 24. `notes` – Notizen
**Datenquelle:** SQLite (`dashboard_notes` Tabelle)
**Default-Größe:** 3×3
**Min:** 2×2
**Backend (NEU):** CRUD für Notizen
**Inhalt:**
- Markdown-fähiger Textbereich
- Auto-Save bei Blur/Pause
- **Use Case:** "Film-Tipps merken", "Watchlist-Notizen", "Server-TODOs"

#### 25. `rss-feed` – RSS Reader
**Datenquelle:** Backend-Proxy für RSS-Feeds
**Default-Größe:** 4×4
**Min:** 3×3
**Backend (NEU):** `/api/system/rss?url=X` – RSS-Feed parsen + cachen
**Inhalt:**
- Konfigurierbare Feed-URLs (z.B. TorrentFreak, r/selfhosted, Tech-News)
- Pro Eintrag: Titel, Quelle, Datum
- Klick → öffnet Artikel im neuen Tab
- Auto-Refresh alle 15 Minuten

---

### Kategorie: AI (1 Widget)

#### 26. `ai-quick` – AI Schnellzugriff
**Datenquelle:** ai.store
**Default-Größe:** 4×3
**Min:** 3×2
**requiresIntegration:** ['ollama']
**Inhalt:**
- Kompaktes Input-Feld für Quick-Prompts
- Letzte 3 AI-Antworten als Preview
- Quick-Action Buttons: "Was läuft gerade?", "Empfehle mir was", "Suche nach..."
- Status: Ollama Online/Offline, aktuelles Modell
- Klick auf Input → öffnet volles AiChatWidget

---

### Bonus-Widgets (Stretch Goals)

#### 27. `plex-libraries` – Plex Bibliotheken
**Datenquelle:** `/api/plex/libraries` (NEU)
**Inhalt:** Library-Typ + Item-Count pro Plex-Library

#### 28. `abs-listening` – Audiobookshelf Hörstatus  
**Datenquelle:** `/api/abs/me/listening-sessions` (NEU)
**Inhalt:** Aktuelles Hörbuch, Fortschritt, Verbleibende Zeit

---

## UI-Konzept

### Edit-Modus

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard                          [🧩 Widgets] [✏️ ✓]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──── Widget ────┐ ┌──── Widget ────┐ ┌── Widget ──┐  │
│  │  ≡ Title    ✕  │ │  ≡ Title    ✕  │ │  ≡ Title ✕ │  │
│  │                │ │                │ │            │  │
│  │   [Content]    │ │   [Content]    │ │  [Content] │  │
│  │              ◢ │ │              ◢ │ │          ◢ │  │
│  └────────────────┘ └────────────────┘ └────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘

≡ = Drag-Handle (nur im Edit-Modus sichtbar)
✕ = Entfernen (nur im Edit-Modus)
◢ = Resize-Handle (nur im Edit-Modus)
```

**Toolbar (DashboardToolbar.vue):**
- **Links:** "Dashboard" Titel + Datum
- **Rechts:** 
  - 🧩 Widget-Katalog öffnen (Drawer von rechts, wie Kalender-Optionen)
  - ✏️ Edit-Modus Toggle
  - Im Edit-Modus: ✓ "Fertig" Button (speichert Layout)

**Widget-Katalog (WidgetCatalog.vue):**
- Drawer/Side-Panel von rechts (Slide-In wie CalendarView Optionen-Drawer)
- Gruppiert nach Kategorien
- Toggle-Switches pro Widget (ein/aus) – wie Kalender-Optionen
- Drag-and-Drop aus dem Katalog ins Grid möglich
- Suchfeld oben zum Filtern
- Widget-Preview im Katalog (Mini-Screenshot oder Icon + Beschreibung)

**Edit-Modus:**
- Alle Widgets bekommen gestrichelte Border + leichten Shake-Effekt
- Drag-Handle (≡) oben links
- Remove-Button (✕) oben rechts  
- Resize-Handle (◢) unten rechts
- Grid-Lines werden sichtbar (subtle, 12-Spalten Raster)
- Widgets die gerade gezogen werden: erhöhter z-index + Schatten
- Klick auf "Fertig" → speichert nach SQLite, Exit Edit-Modus

### Widget-Wrapper (WidgetWrapper.vue)

Jedes Widget bekommt einen universellen Container:

```vue
<template>
  <div class="widget-wrapper" :class="{ editing: isEditing }">
    <div class="widget-header" v-if="showHeader">
      <span class="drag-handle" v-if="isEditing">≡</span>
      <span class="widget-icon">{{ definition.icon }}</span>
      <span class="widget-title">{{ definition.name }}</span>
      <div class="widget-actions">
        <slot name="header-actions" />
        <button v-if="hasLink" class="widget-link" @click="navigate">›</button>
        <button v-if="isEditing" class="widget-remove" @click="$emit('remove')">✕</button>
      </div>
    </div>
    <div class="widget-body">
      <slot />
    </div>
  </div>
</template>
```

### Presets / Vordefinierte Layouts

**1. "Alles" (Default)**
Alle Widgets aktiv, 3-Spalten Layout, volle Breite genutzt.

**2. "Minimal"**
Nur: Library-Stats, Downloads, Active-Streams, Clock.

**3. "Media-Fokus"**
Trending, Recently-Added, Upcoming-Releases, Most-Watched, Calendar-Mini.

**4. "Server-Admin"**
Integration-Health, Storage, System-Status, Service-Health, Downloads, Indexer-Status.

---

## Implementierungsplan (für Claude Code)

### Phase D-1: Fundament (2-3 Sessions)
1. `npm install grid-layout-plus`
2. Shared Types: `DashboardWidget`, `DashboardConfig`, `WidgetDefinition`
3. SQLite Migration `004_dashboard.sql`
4. Backend: `dashboard.service.ts` + `dashboard.routes.ts` (CRUD)
5. Frontend: `dashboard.store.ts` (Layout laden/speichern/reset)
6. `DashboardGrid.vue` mit `grid-layout-plus` Integration
7. `DashboardToolbar.vue` mit Edit-Toggle
8. `WidgetWrapper.vue` Basiskomponente
9. `WidgetCatalog.vue` Side-Panel
10. Widget-Registry `widgets/index.ts`

### Phase D-2: Core-Widgets migrieren (2-3 Sessions)
Bestehende Dashboard-Inhalte in eigenständige Widgets extrahieren:
1. `ClockWidget.vue` ← aus dash-header
2. `IntegrationHealthWidget.vue` ← aus health-bar
3. `LibraryStatsWidget.vue` ← aus stats-grid
4. `RecentlyAddedWidget.vue` ← aus poster-row section
5. `DownloadsWidget.vue` ← aus Downloads-Widget
6. `UpcomingReleasesWidget.vue` ← aus Nächste-7-Tage
7. `ActiveStreamsWidget.vue` ← aus Aktive-Streams
8. `GotifyWidget.vue` ← aus Gotify-Widget
9. `OverseerrWidget.vue` ← aus Overseerr-Widget
10. `PlayHistoryWidget.vue` ← aus History-Widget
11. `DashboardView.vue` umschreiben → nur noch DashboardGrid + Toolbar

### Phase D-3: Neue Widgets (3-4 Sessions)
1. `StorageWidget.vue` (+ Backend: Sonarr/Lidarr Root-Folders)
2. `SystemStatusWidget.vue` (+ Backend: Ollama-Status)
3. `ServiceHealthWidget.vue` (Aggregierte Health-Checks)
4. `LibraryBreakdownWidget.vue` (Charts aus Store-Daten)
5. `MissingMediaWidget.vue` (mit Search-Actions)
6. `MostWatchedWidget.vue` (Tautulli Home Stats)
7. `TrendingWidget.vue` (TMDB + Library-Check)
8. `IndexerStatusWidget.vue`
9. `BazarrWidget.vue` (+ Backend: Wanted-Endpoints)
10. `CalendarMiniWidget.vue`

### Phase D-4: External + Polish (2 Sessions)
1. `WeatherWidget.vue` (+ Backend: Wetter-Proxy)
2. `QuickLinksWidget.vue` (+ Backend: Links CRUD)
3. `NotesWidget.vue` (+ Backend: Notes CRUD)
4. `RSSFeedWidget.vue` (+ Backend: RSS-Proxy)
5. `AiQuickWidget.vue`
6. `RecommendationsWidget.vue`
7. Layout-Presets implementieren
8. Responsive Breakpoints testen
9. Animation/Transitions beim Drag & Drop

### Phase D-5: Feinschliff (1-2 Sessions)
1. Widget-Resize Verhalten optimieren (min/max Constraints)
2. Touch-Support für Mobile
3. Performance: Intersection Observer für Lazy-Loading
4. Empty-States für alle Widgets
5. Loading-Skeletons pro Widget
6. Error-Boundaries pro Widget (ein kaputtes Widget crasht nicht das ganze Dashboard)
7. Keyboard-Navigation im Edit-Modus

---

## Neue Backend-Endpunkte (Zusammenfassung)

| Endpunkt | Service | Zweck |
|---|---|---|
| `GET/PUT /api/dashboard` | dashboard.service | Layout CRUD |
| `POST /api/dashboard/reset` | dashboard.service | Layout zurücksetzen |
| `GET /api/sonarr/rootfolders` | sonarr.service | Disk-Space |
| `GET /api/lidarr/rootfolders` | lidarr.service | Disk-Space |
| `GET /api/bazarr/wanted/movies` | bazarr.service | Fehlende Untertitel |
| `GET /api/bazarr/wanted/series` | bazarr.service | Fehlende Untertitel |
| `GET /api/system/weather` | system.service | Wetter-Proxy |
| `GET /api/system/rss` | system.service | RSS-Feed Proxy |
| `GET/POST/PUT/DELETE /api/dashboard/notes` | dashboard.service | Notizen |
| `GET/POST/DELETE /api/dashboard/links` | dashboard.service | Quick-Links |
| `GET /api/ai/status` | ai.service | Ollama-Status (existiert) |
| `GET /api/plex/libraries` | plex.service | Plex Library Stats |

---

## Technische Details

### Widget-Registrierung

```typescript
// widgets/index.ts
import { defineAsyncComponent } from 'vue';
import type { WidgetDefinition } from '@nexarr/shared';

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: 'library-stats',
    name: 'Bibliothek',
    description: 'Filme, Serien & Musik Übersicht',
    icon: '📊',
    category: 'library',
    defaultSize: { w: 12, h: 2 },
    minSize: { w: 6, h: 2 },
  },
  // ... alle 28 Widgets
];

// Lazy-loaded Component Map
export const WIDGET_COMPONENTS: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  'library-stats': defineAsyncComponent(() => import('./LibraryStatsWidget.vue')),
  'recently-added': defineAsyncComponent(() => import('./RecentlyAddedWidget.vue')),
  // ... etc.
};
```

### Default-Layout

```typescript
export const DEFAULT_LAYOUT: DashboardWidget[] = [
  // Zeile 1: Full-Width Stats
  { i: 'integration-health', x: 0, y: 0, w: 12, h: 1, minW: 6, minH: 1 },
  { i: 'library-stats',      x: 0, y: 1, w: 12, h: 2, minW: 6, minH: 2 },
  
  // Zeile 2: Recently Added
  { i: 'recently-added',     x: 0, y: 3, w: 12, h: 3, minW: 6, minH: 3 },
  
  // Zeile 3: Drei-Spalten
  { i: 'downloads',          x: 0, y: 6, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'upcoming-releases',  x: 4, y: 6, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'active-streams',     x: 8, y: 6, w: 4, h: 5, minW: 3, minH: 3 },
  
  // Zeile 4: Drei-Spalten
  { i: 'gotify',             x: 0, y: 11, w: 4, h: 4, minW: 3, minH: 3 },
  { i: 'overseerr',          x: 4, y: 11, w: 4, h: 4, minW: 3, minH: 3 },
  { i: 'storage',            x: 8, y: 11, w: 4, h: 4, minW: 3, minH: 3 },
  
  // Zeile 5: Full-Width
  { i: 'play-history',       x: 0, y: 15, w: 12, h: 4, minW: 6, minH: 3 },
];
```

### Lazy-Loading & Performance

```typescript
// In DashboardGrid.vue:
// Widgets die nicht im Viewport sind, rendern nur einen Placeholder
// Sobald sie sichtbar werden (IntersectionObserver), laden sie ihre Daten

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      visibleWidgets.value.add(entry.target.dataset.widgetId);
    }
  });
}, { rootMargin: '200px' }); // 200px Vorlauf
```

### Error Boundaries

```vue
<!-- WidgetWrapper.vue -->
<template>
  <div class="widget-wrapper">
    <Suspense>
      <template #default>
        <component :is="widgetComponent" />
      </template>
      <template #fallback>
        <WidgetSkeleton :size="size" />
      </template>
    </Suspense>
    <!-- ErrorBoundary: Wenn Widget crasht, zeigt Fallback statt Crash -->
  </div>
</template>
```

---

## Design-Regeln (Dashboard-spezifisch)

1. **Widget-Background:** `var(--bg-surface)` mit `border: 1px solid var(--bg-border)`
2. **Widget-Header:** `var(--text-secondary)`, 13px, semibold, `border-bottom: 1px solid var(--bg-border)`
3. **Edit-Modus:** Gestrichelte Border (`border-style: dashed`), leichter Schatten, Grid-Lines via CSS background-image
4. **Drag-Placeholder:** Semi-transparenter Block mit `var(--nexarr)` Border
5. **Resize-Handle:** Kleines Dreieck (◢) unten rechts, `var(--text-muted)`, nur im Edit-Modus
6. **Transitions:** `transition: all 200ms ease` auf Widget-Position (grid-layout-plus built-in)
7. **App-Farben:** Nur als Akzente in Widget-Headern und Badges, nie als Text
8. **Klickbare Widgets:** Gesamtes Widget ist clickable area zu Detail-View
9. **Empty States:** Konsistenter Stil: Muted-Text + Icon, kein "Keine Daten" Horror-Message

---

## Mobile & Responsive Konzept

### Aktueller Stand: KEIN Mobile-Support

Die gesamte App hat aktuell null Responsive-Handling:
- Sidebar ist immer sichtbar (220px / 56px collapsed) — auf Smartphones nimmt sie 40-60% des Screens ein
- Kein Hamburger-Menü, keine Bottom-Navigation
- Poster-Grids brechen nicht korrekt um
- Touch-Events nicht optimiert (kein Swipe, kein Long-Press)
- Detail-Views haben Desktop-Proportionen (Hero-Banner, Spalten-Layouts)
- Kalender-Wochenansicht (7 Spalten) ist auf <400px unbenutzbar
- Dashboard `tri-grid` bricht ab 700px auf 1 Spalte, aber Widgets skalieren nicht

### Breakpoint-System

Drei Breakpoints als CSS Custom Properties + JS-Detection:

```css
/* main.css – Global Breakpoints */
:root {
  /* Breakpoint-Referenz (für Dokumentation, nicht direkt in CSS nutzbar) */
  --bp-mobile:  480px;   /* Smartphone Portrait */
  --bp-tablet:  768px;   /* Tablet / Smartphone Landscape */
  --bp-desktop: 1024px;  /* Desktop */
  --bp-wide:    1440px;  /* Ultrawide */
}

/* Sidebar mobile behavior */
@media (max-width: 768px) {
  :root {
    --sidebar-width: 0px;
    --sidebar-width-collapsed: 0px;
  }
}
```

### Navigation: Sidebar → Bottom Nav auf Mobile

**Unter 768px:** Sidebar komplett ausblenden, dafür eine fixierte Bottom Navigation Bar:

```
┌─────────────────────────────────────────┐
│                                         │
│          [Main Content Area]            │
│          (volle Breite, kein             │
│           Sidebar-Offset)               │
│                                         │
├─────────────────────────────────────────┤
│  🏠   🎬   📺   ⬇️   ☰               │
│ Home  Filme Serien DL   Mehr            │
└─────────────────────────────────────────┘
```

**Komponente: `BottomNav.vue`**
- 5 fixierte Tabs: Dashboard, Filme, Serien, Downloads, Mehr (⋯)
- "Mehr" öffnet ein Sheet/Overlay mit allen weiteren Navigation-Items
- Aktiver Tab: farbiger Indicator (App-Farbe) + Label
- Inaktiv: nur Icon, kein Label (spart Platz)
- Badge-Support: Download-Count + Gotify-Unread auf Icons
- `position: fixed; bottom: 0` mit `safe-area-inset-bottom` für iPhone Notch
- Höhe: 56px + safe-area
- `z-index: 200` (über Content, unter Modals)

**"Mehr" Sheet (MoreSheet.vue):**
- Slide-up von unten (wie iOS Action Sheet)
- Alle weiteren Nav-Items in einem 3×N Grid
- Pro Item: Icon + Label
- Backdrop-Click oder Swipe-Down zum Schließen
- Suche und Einstellungen prominent ganz oben

**Sidebar.vue Anpassung:**
```css
@media (max-width: 768px) {
  .sidebar {
    display: none !important;
  }
}
```

**App.vue Anpassung:**
```vue
<template>
  <div id="app-shell" :class="{ 'has-bottom-nav': isMobile }">
    <Sidebar v-if="!isMobile && isLoggedIn" />
    <main class="main-content">
      <RouterView ... />
    </main>
    <BottomNav v-if="isMobile && isLoggedIn" />
  </div>
</template>

<style>
.has-bottom-nav .main-content {
  padding-bottom: calc(56px + env(safe-area-inset-bottom));
}
</style>
```

### Dashboard-Grid: Responsive Spalten

`grid-layout-plus` unterstützt responsive Breakpoints nativ:

```typescript
// DashboardGrid.vue
const responsiveLayouts = computed(() => ({
  // 12 Spalten Desktop (>1024px)
  lg: layout.value,
  
  // 6 Spalten Tablet (768-1024px) – Widgets auto-umgebrochen
  md: layout.value.map(w => ({
    ...w,
    x: (w.x >= 6) ? w.x - 6 : w.x,
    w: Math.min(w.w, 6),
  })),
  
  // 2 Spalten Mobile (<768px) – Alles gestackt
  sm: layout.value.map((w, i) => ({
    ...w,
    x: 0,
    y: i * w.h,
    w: 2,
  })),
}));
```

```vue
<GridLayout
  v-model:layout="currentLayout"
  :col-num="colNum"
  :row-height="30"
  :is-draggable="isEditing && !isMobile"
  :is-resizable="isEditing && !isMobile"
  :responsive="true"
  :breakpoints="{ lg: 1024, md: 768, sm: 0 }"
  :cols="{ lg: 12, md: 6, sm: 2 }"
  :margin="[gapSize, gapSize]"
  vertical-compact
  use-css-transforms
/>
```

**Wichtig:**
- **Drag & Drop ist auf Mobile DEAKTIVIERT** — zu fehleranfällig mit Touch-Scrolling
- **Resize ist auf Mobile DEAKTIVIERT**
- Auf Mobile: Widget-Reihenfolge per Sortierung statt per Drag (einfache Up/Down Buttons im Edit-Modus)
- Auf Tablet: Drag & Drop aktiv, aber 6 statt 12 Spalten

### Mobile Edit-Modus

Da Drag & Drop auf Mobile nicht funktioniert, brauchen wir eine alternative UI:

```
┌─────────────────────────────────────────┐
│  Dashboard                   [✏️ Fertig]│
├─────────────────────────────────────────┤
│                                         │
│  ┌──── Widget: Bibliothek ────────────┐ │
│  │  [▲] [▼]  [👁️ Ausblenden]         │ │
│  │                                    │ │
│  │       [Widget Content]             │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌──── Widget: Downloads ─────────────┐ │
│  │  [▲] [▼]  [👁️ Ausblenden]         │ │
│  │                                    │ │
│  │       [Widget Content]             │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  [+ Widget hinzufügen]                  │
│                                         │
└─────────────────────────────────────────┘
```

**Statt Drag & Drop:**
- ▲ / ▼ Buttons zum Verschieben (Reihenfolge ändern)
- 👁️ Button zum Ein-/Ausblenden
- "Widget hinzufügen" Button öffnet den Widget-Katalog als Full-Screen Modal
- Jedes Widget hat eine gestrichelte Border im Edit-Modus
- Kein Resize auf Mobile — alle Widgets nutzen volle Breite (2 von 2 Spalten)

### Widget-Katalog auf Mobile

**Desktop:** Side-Panel (Drawer von rechts, ~350px breit)
**Mobile:** Full-Screen Modal (Slide-up from bottom)

```
┌─────────────────────────────────────────┐
│  Widget-Katalog               [✕]       │
│  ┌─────────────────────────────────────┐│
│  │ 🔍 Widget suchen...                ││
│  └─────────────────────────────────────┘│
│                                         │
│  ── Library ──────────────────────────  │
│  ┌────────────────┐ ┌────────────────┐  │
│  │ 📊 Bibliothek  │ │ 🆕 Zuletzt     │  │
│  │    [✓ aktiv]   │ │    [✓ aktiv]   │  │
│  └────────────────┘ └────────────────┘  │
│  ┌────────────────┐ ┌────────────────┐  │
│  │ 📈 Analyse     │ │ ❌ Fehlend     │  │
│  │    [  aus  ]   │ │    [  aus  ]   │  │
│  └────────────────┘ └────────────────┘  │
│                                         │
│  ── Activity ─────────────────────────  │
│  ...                                    │
└─────────────────────────────────────────┘
```

- 2-Spalten Grid für Widget-Cards
- Jede Card: Icon + Name + Toggle (aktiv/aus)
- Kurze Beschreibung unter dem Namen
- Tap auf Card = Toggle
- Kategorien als Sticky-Sections

### Touch-Optimierungen (App-weit)

| Element | Desktop | Mobile |
|---|---|---|
| Click-Targets | min 32px | min 44px (Apple HIG) |
| Padding in Listen | 8px | 12px |
| Font-Size in Badges | 10-11px | 12px |
| Poster-Größe in Scroll | 90px breit | 110px breit |
| Swipe-Gesten | – | Swipe-Left auf Widget-Cards für Actions |
| Long-Press | – | Context-Menü (Film: Details/Suche/Monitored) |
| Pull-to-Refresh | – | Dashboard + alle Listen-Views |
| Scroll-Momentum | – | `-webkit-overflow-scrolling: touch` |
| Safe Area | – | `env(safe-area-inset-*)` auf alle Ränder |

### Responsive Widget-Inhalte

Widgets müssen intern responsive sein — nicht nur das Grid:

**LibraryStatsWidget:**
- Desktop: 4 Cards nebeneinander (Filme | Serien | Musik | Downloads)
- Tablet: 2×2 Grid
- Mobile: Vertikaler Stack, kompaktere Cards

**RecentlyAddedWidget:**
- Desktop: Poster-Scroll, 90px breit
- Mobile: Poster-Scroll, 100px breit, größere Touch-Targets, Snap-Scrolling (`scroll-snap-type: x mandatory`)

**DownloadsWidget:**
- Desktop: Filename + ETA + Fortschrittsbalken + Badges
- Mobile: Filename (2 Zeilen statt truncate) + Fortschrittsbalken, ETA in zweiter Zeile

**ActiveStreamsWidget:**
- Desktop: Poster + User + Title + Tech-Badges + Progress
- Mobile: Kein Poster, User + Title + Decision-Badge + Progress

**CalendarMiniWidget:**
- Desktop: 7×5 Monats-Grid
- Mobile: Horizontaler Tages-Scroll (heute zentriert, ±3 Tage sichtbar)

**TrendingWidget:**
- Desktop: 6 Poster nebeneinander
- Mobile: 3 Poster, größer, Snap-Scroll

**LibraryBreakdownWidget:**
- Desktop: Tabs nebeneinander + Chart
- Mobile: Tabs scrollbar, Chart auf volle Breite

### Composable: `useResponsive()`

```typescript
// packages/client/src/composables/useResponsive.ts
import { ref, onMounted, onUnmounted, computed } from 'vue';

export function useResponsive() {
  const width = ref(window.innerWidth);
  
  function onResize() { width.value = window.innerWidth; }
  onMounted(() => window.addEventListener('resize', onResize));
  onUnmounted(() => window.removeEventListener('resize', onResize));

  const isMobile  = computed(() => width.value < 768);
  const isTablet  = computed(() => width.value >= 768 && width.value < 1024);
  const isDesktop = computed(() => width.value >= 1024);
  const isWide    = computed(() => width.value >= 1440);
  
  // Grid columns für Dashboard
  const gridCols  = computed(() => isMobile.value ? 2 : isTablet.value ? 6 : 12);
  
  // Gap zwischen Widgets
  const gridGap   = computed(() => isMobile.value ? 8 : 12);
  
  return { width, isMobile, isTablet, isDesktop, isWide, gridCols, gridGap };
}
```

### PWA-Fähig machen (Stretch Goal)

Da nexarr auf Mobile genutzt werden soll, ist PWA sinnvoll:

1. **manifest.json:** App-Name, Icons, Theme-Color (#0a0a0a), Display: standalone
2. **Service Worker:** Offline-Caching für App-Shell (HTML/CSS/JS)
3. **"Add to Home Screen"** Prompt auf Mobile
4. **Standalone-Modus:** Status-Bar ausblenden, eigenes App-Icon
5. **Push-Notifications:** Via Gotify-Integration (wenn Browser-Notifications erlaubt)

```json
// public/manifest.json
{
  "name": "nexarr",
  "short_name": "nexarr",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#9b0045",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Sidebar auf Tablet (768-1024px)

- Sidebar startet **collapsed** (56px, nur Icons)
- Swipe-Right vom linken Rand öffnet Sidebar temporär als Overlay
- Tap auf Overlay-Backdrop schließt sie wieder
- Kein dauerhaft geöffneter Sidebar-Zustand auf Tablet

### Mobile-spezifische Views (Anpassungen)

**Nicht nur Dashboard, sondern alle Views brauchen Mobile-Treatment:**

| View | Desktop | Mobile-Anpassung |
|---|---|---|
| MoviesView | 6-8 Poster pro Zeile | 3 Poster pro Zeile, größere Touch-Targets |
| SeriesView | 6-8 Poster pro Zeile | 3 Poster pro Zeile |
| MovieDetailView | Hero-Banner + 2-Spalten | Kein Hero-Parallax, Stack, Tabs statt Spalten |
| SeriesDetailView | Staffel-Accordion + Episoden-Grid | Volle Breite, kompaktere Episode-Cards |
| DownloadsView | 3-Spalten Stats + Queue | Stack, Stats horizontal scrollbar |
| CalendarView | 7-Spalten Wochen-Grid | Default auf Listen-Ansicht statt Woche |
| StreamsView | Stream-Cards mit Details | Kompaktere Cards, Details hinter Tap |
| SearchView | Split-Results | Full-Width Results, Tabs für Kategorien |
| DiscoverView | Hero + Grid | Kleinerer Hero, 2-Spalten Grid |

### Implementierungsplan (Mobile-Phasen)

Die Mobile-Arbeit läuft **parallel** zu den Dashboard-Phasen:

#### Phase M-1: Fundament (in D-1)
1. `useResponsive()` Composable erstellen
2. CSS Breakpoints in `main.css` definieren
3. `BottomNav.vue` erstellen
4. `MoreSheet.vue` erstellen
5. `App.vue` umbauen (Sidebar/BottomNav Conditional)
6. `Sidebar.vue` Media Query: `display: none` unter 768px
7. Safe-Area-Insets überall hinzufügen
8. `main-content` Padding-Bottom für BottomNav

#### Phase M-2: Dashboard-Widgets (in D-2 + D-3)
9. `grid-layout-plus` responsive Config (Breakpoints + Cols)
10. Mobile Edit-Modus (Up/Down statt Drag & Drop)
11. Widget-Katalog als Full-Screen Modal auf Mobile
12. Alle Widgets intern responsive machen
13. Touch-optimierte Click-Targets (44px Minimum)

#### Phase M-3: App-weite Views (nach D-5)
14. MoviesView + SeriesView Poster-Grid Responsive
15. Detail-Views Stack-Layout auf Mobile
16. CalendarView Default auf Liste statt Woche
17. DownloadsView Responsive Stats
18. Pull-to-Refresh auf allen Listen
19. Swipe-Gesten wo sinnvoll

#### Phase M-4: PWA + Polish (Stretch)
20. manifest.json + Service Worker
21. App-Icons generieren
22. Offline-Shell Caching
23. Browser-Testing (iOS Safari, Android Chrome)
24. Performance-Audit (Lighthouse)

### Testen

**Chrome DevTools:** Device-Toolbar mit iPhone 14 Pro, iPad, Samsung Galaxy S24
**Real Devices:** iOS Safari (besonders wichtig für Safe-Area + PWA)
**Kritische Test-Szenarien:**
- Dashboard mit 10+ Widgets auf iPhone SE (kleinstes Display)
- Edit-Modus auf Touch-Device
- Poster-Scroll mit 100+ Items (Performance)
- Widget-Katalog Öffnen/Schließen
- BottomNav Badges + Navigation
- Keyboard-Öffnung auf Input-Fields (Layout-Shift)
- Landscape-Modus auf Tablet

---

## Zusammenfassung

| Metrik | Vorher | Nachher |
|---|---|---|
| Widgets | 11 (hardcoded) | 28 (modular) |
| Customizable | Nein | Ja (Drag & Drop + Toggles) |
| Layout-Speicherung | Nein | Ja (SQLite pro User) |
| Responsive | Teilweise (tri-grid) | Voll (12/6/2 Spalten) |
| Mobile-Navigation | Keine | BottomNav + MoreSheet |
| Touch-Support | Keiner | 44px Targets, Swipe, Pull-to-Refresh |
| PWA | Nein | Ja (manifest, offline shell) |
| Datenquellen | 8 | 14+ |
| Neue Backend-Endpunkte | – | 12 |
| Lazy-Loading | Nein | Ja (IntersectionObserver) |
| Error Isolation | Nein | Ja (Error Boundaries) |
| Presets | Nein | 4 vordefinierte Layouts |
| DashboardView.vue Größe | ~550 Zeilen | ~50 Zeilen |
| Neue Komponenten | – | BottomNav, MoreSheet, WidgetCatalog, 28 Widget-Components |
| Implementierungs-Phasen | – | D-1 bis D-5 (Dashboard) + M-1 bis M-4 (Mobile) |
