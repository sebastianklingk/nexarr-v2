# nexarr v2 – Roadmap: Modulares Dashboard
> Erstellt: 05.04.2026
> Ziel: Dashboard mit Drag & Drop Widgets, Widget-Katalog, Mobile-Support

---

## Phase D-1: Widget Infrastructure
- `dashboard.store.ts` – Layout-Persistenz (localStorage), Widget-Positionen, Sichtbarkeit
- Widget-Registry: ID, Label, Icon, Default-Größe, Komponente
- CSS Grid-basiertes Layout mit `grid-template-areas`-ähnlichem System
- Jedes Widget hat: `widgetId`, `col`, `row`, `colSpan`, `rowSpan`, `visible`

## Phase D-2: Widget Extraction
Monolithische DashboardView in einzelne Widget-Komponenten aufteilen:
1. `HealthBarWidget.vue` – Integration-Status Chips
2. `StatsWidget.vue` – 8 Stat-Cards (Filme, Serien, Musik, Downloads, Streams, Anfragen, Prowlarr, Gotify)
3. `RecentlyAddedWidget.vue` – Poster-Scroll mit Filter-Tabs
4. `DownloadsWidget.vue` – SABnzbd Queue Mini
5. `CalendarWidget.vue` – Nächste 7 Tage
6. `StreamsWidget.vue` – Aktive Plex-Streams
7. `GotifyWidget.vue` – Benachrichtigungen
8. `OverseerrWidget.vue` – Offene Anfragen
9. `PlexAbsWidget.vue` – Plex Sessions + ABS Libraries
10. `HistoryWidget.vue` – Letzte Aktivität (Tautulli)

## Phase D-3: Drag & Drop
- HTML5 Drag & Drop API (kein externes Paket)
- Drag-Handle oben auf jedem Widget
- Ghost-Preview + Drop-Zone-Highlighting
- Position-Swap bei Drop
- Sortierung per Array-Reihenfolge (einfacher als 2D-Grid-Koordinaten)

## Phase D-4: Widget-Katalog
- Slide-out Panel (von rechts, 360px)
- Alle verfügbaren Widgets mit Icon + Beschreibung
- Toggle visible/hidden
- "Zurücksetzen" Button für Default-Layout

## Phase D-5: Mobile Support
- Responsive Grid: 3 Spalten → 2 → 1
- Touch: `touchstart`/`touchmove`/`touchend` für DnD auf Mobile
- Collapsed-State für Widgets (nur Header sichtbar)
- Swipe-to-dismiss optional

---

## Widget-Größen

| Widget | Default colSpan | Min colSpan |
|---|---|---|
| HealthBar | full (3) | 2 |
| Stats | full (3) | 2 |
| RecentlyAdded | full (3) | 2 |
| Downloads | 1 | 1 |
| Calendar | 1 | 1 |
| Streams | 1 | 1 |
| Gotify | 1 | 1 |
| Overseerr | 1 | 1 |
| PlexAbs | 1 | 1 |
| History | full (3) | 2 |

---

_Ende Roadmap Dashboard_
