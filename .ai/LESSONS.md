# nexarr v2 – Lessons Learned
> Wird nach jeder Korrektur durch den User ergänzt.
> Ziel: Wiederholungsfehler über Sessions hinweg eliminieren.
> Format: Datum · Kontext · Was schiefging · Regel die es verhindert

---

## 2026-04-03 · Dev Server · Vite stirbt bei SSH-Disconnect
**Was passierte:** Vite lief im Vordergrund. Bei SSH-Disconnect/Terminal-Close bekommt der Vordergrund-Prozess SIGHUP → Vite stirbt → Seite nicht erreichbar. Server mit `setsid` überlebte, Vite nicht.
**Regel:** Server UND Vite BEIDE als `setsid`-Daemons starten (`dev.sh`). `npm run dev` startet beide im Hintergrund, gibt sofort den Prompt zurück. Überleben Terminal-Close, SSH-Disconnect, Ctrl+C. Logs via `npm run logs` / `npm run logs:client`.

## 2026-04-03 · Dev Server · concurrently + Ctrl+C killt alles
**Was passierte:** `concurrently` bindet Server + Vite in einem Prozess. Ctrl+C (für Commits/Befehle) killt BEIDE. Danach ist die Seite komplett unerreichbar. Auch `-k` Flag und `predev` fuser verursachten Crashes.
**Regel:** Server IMMER als Hintergrund-Daemon starten (`dev.sh`). `nohup` + PID-File. Überlebt Ctrl+C und Terminal-Close. Vite läuft im Vordergrund (Ctrl+C stoppt nur Vite). `npm run restart` für Server-Neustart, `npm run logs` für Logs.

## 2026-04-03 · Alle Views · TMDB-Poster in Originalgröße geladen
**Was passierte:** `posterUrl()` gab `remoteUrl` direkt zurück – TMDB-URLs mit `/original/` (2000×3000px, ~500KB/Poster). Bei 100+ Filmen in der Grid-Ansicht ~50MB Bilder.
**Regel:** Poster-URLs IMMER über `posterUrl()` / `fanartUrl()` aus `@/utils/images.ts` laden. Grid = `w342`, Detail = `w500`, Fanart = `w1280`. NIEMALS `remoteUrl` direkt verwenden.

## 2026-04-03 · Auth · Session-Verlust bei Server-Restart
**Was passierte:** Express-Session mit MemoryStore verliert alle Sessions bei tsx-watch-Restart. User wird ständig ausgeloggt.
**Regel:** Für Dev: `AUTH_DISABLED=true` in `.env`. Für Prod später: SQLite-Session-Store nutzen (Tabelle `sessions` existiert bereits).

## 2026-04-03 · DownloadsView · NormalizedSlot computed-Reaktivität
**Was passierte:** `batchMoveToTopCount` und `batchPriorityCount` riefen eine normale Funktion (`eligibleSlots()`) auf statt direkt auf `selectedSlots.value` zuzugreifen. Das erzeugt keine reaktive Abhängigkeit – die computed-Werte wurden nicht neu berechnet wenn sich die Auswahl änderte.
**Regel:** Computed-Properties MÜSSEN direkt auf reaktive Quellen (`.value`) zugreifen. Hilfsfunktionen die reaktive Arrays filtern sind in computeds nur sicher wenn sie intern `.value` verwenden – besser direkt inlinen.

## 2026-04-03 · DownloadsView · Shift-Select Index-Tracking
**Was passierte:** Bei Shift-Klick muss der Index des zuletzt geklickten Items getrackt werden. `lastSelectedIndex` darf nur beim normalen Toggle gesetzt werden, NICHT beim Shift-Range-Select – sonst verschiebt sich der Anker bei jedem Shift-Klick.
**Regel:** Range-Select-Logik: Anker-Index nur beim normalen Klick setzen. Shift-Klick liest den Anker, setzt ihn aber nicht neu.

## 2026-04-02 · CalendarView · Datum-Timezone-Bug
**Was passierte:** `toISOString()` gibt UTC zurück. In UTC+1/+2 wird Sonntag 00:00 Uhr lokal zu Samstag 22:00/23:00 UTC → dateKey falsch, Sonntag-Spalte leer.
**Regel:** NIEMALS `toISOString().slice(0,10)` für Kalender-Datums-Keys. Immer `fmtDate(d: Date)` mit `getFullYear()` / `getMonth()` / `getDate()` (lokale Methoden).

## 2026-04-02 · CalendarView · CSS Grid 1fr Bug
**Was passierte:** `repeat(7, 1fr)` = `repeat(7, minmax(auto, 1fr))`. Spalten mit langem Inhalt (`white-space:nowrap`) dehnen sich über 1fr hinaus, Sonntag bekommt nur 16px.
**Regel:** Immer `repeat(7, minmax(0, 1fr))` + `min-width: 0; overflow: hidden` auf Grid-Items.

## 2026-04-02 · CalendarView · Sonarr/Radarr Calendar end-Datum exklusiv
**Was passierte:** Sonarr und Radarr behandeln den `end`-Parameter als exklusiv → letzter Tag (z.B. Sonntag) kommt nie zurück.
**Regel:** `loadEnd` immer +1 Tag: `const d = new Date(base); d.setDate(d.getDate() + 1); return d;`

## 2026-04-02 · CalendarView · Sonarr Store-Timeout
**Was passierte:** `seriesStore.fetchSeries()` schlägt mit Timeout fehl (10s zu kurz für Sonarr `/series` mit vielen Serien). Tooltip-Poster fehlen weil Store leer.
**Regel:** Sonarr-Axios-Client timeout auf 30s setzen. Kalender-Daten NIEMALS aus Stores holen – direkt aus der Calendar-API-Response extrahieren (self-contained mapping).

## 2026-04-02 · CalendarView · Sonarr includeEpisodeFile
**Was passierte:** Episoden-Tooltip hatte keine Datei-Infos (Qualität, Größe, Sprachen, Tech-Badges).
**Regel:** Sonarr Calendar-API immer mit `{ includeSeries: true, includeEpisodeFile: true }` aufrufen. Episode-Daten beim Mapping in `CalendarEntry` reinschreiben, nicht nachladen.

## 2026-04-02 · Allgemein · overflow-y:auto auf Grid-Body
**Was passierte:** `overflow-y: auto` auf `week-body` erzeugt Scrollbalken → Header-Row hat keinen Scrollbalken → Spaltenbreiten stimmen nicht überein.
**Regel:** Kein `overflow-y: auto` auf Grid-Containern die einen separaten Header-Row haben. Die Seite selbst scrollt.

## 2026-04-02 · Allgemein · Commit und TypeCheck
**Regel:** Nach jeder Implementierung:
1. User führt `npm run typecheck` aus
2. Im Browser via Chrome-MCP verifizieren (Screenshot + JS-Checks)
3. CONTEXT.md aktualisieren (✅ markieren)
4. Commit-Befehl ausgeben: `git add -A && git commit -m "..." && git push gitea main && git push github main`
**Claude führt diese Befehle NICHT selbst aus – nur ausgeben, User führt aus.**

## 2026-04-02 · MoviesView / SeriesView · Fragment-Root durch Modal außerhalb Root-Div
**Was passierte:** `<AddToLibraryModal>` stand außerhalb des Root-`<div>` im Template. Das erzeugt ein Vue Fragment (mehrere Root-Nodes). `<Transition mode="out-in">` im Router erwartet genau EINEN Root-Node – bei Fragment bricht die Animation und die Zielseite bleibt leer (schwarze Seite). Erst Seiten-Refresh zeigte den Inhalt.
**Regel:** JEDE Vue View darf NUR EIN Root-Element haben. Modals, Teleports, ConfirmDialogs etc. IMMER innerhalb des Root-`<div>` platzieren – nie als Geschwister daneben.

## 2026-04-02 · MovieDetailView / SeriesDetailView · v-else nach v-if mit mehreren SVG-Elementen
**Was passierte:** In einem SVG-Block mit `<path v-if>` + `<circle v-if>` + `<path v-else>` wirft Vue den Fehler "v-else-if has no adjacent v-if". Das `<circle v-if>` unterbricht die v-if/v-else-Kette.
**Regel:** In SVGs (und generell) NIEMALS `v-else` verwenden wenn mehrere Geschwister-Elemente mit `v-if` vorhanden sind. Immer `v-if="!condition"` statt `v-else` – dann gibt es keine adjazente Abhängigkeit.

<!-- Einträge werden hier chronologisch ergänzt, neueste zuerst -->

<!-- Beispiel-Format:
## 2026-04-01 · radarr.routes.ts · Fehlender Cache-Invalidate
**Was passierte:** Nach dem Hinzufügen eines Films wurde der Cache nicht invalidiert,
UI zeigte alten Stand.
**Regel:** Nach jedem schreibenden API-Call den zugehörigen Cache-Key invalidieren.
-->
