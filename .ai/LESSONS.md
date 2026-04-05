# nexarr v2 – Lessons Learned
> Wird nach jeder Korrektur durch den User ergänzt.
> Ziel: Wiederholungsfehler über Sessions hinweg eliminieren.
> Format: Datum · Kontext · Was schiefging · Regel die es verhindert

---

## 2026-04-04 · App.vue · Vue Router recycelt Component bei Param-Wechsel
**Was passierte:** AI-Navigation von `/movies/123` (Inception) zu `/movies/456` (Dune) via `router.push()` änderte die URL, aber MovieDetailView wurde nicht neu gerendert. Vue Router erkennt denselben Component-Typ und recycelt die Instanz statt sie neu zu mounten. `onMounted()` wird nicht erneut aufgerufen → alte Daten bleiben.
**Regel:** `<component :is="Component" :key="route.fullPath" />` in App.vue erzwingt Re-Mount bei jedem Pfadwechsel. IMMER `:key="route.fullPath"` auf der `<component>` innerhalb von `<RouterView v-slot="{ Component, route }">` setzen. Ohne Key werden Detail-Views (MovieDetailView, SeriesDetailView, ArtistDetailView) bei ID-Wechsel nicht aktualisiert.

## 2026-04-04 · AI Tools · 93 Tools auf einmal an Ollama schicken überfordert das Modell
**Was passierte:** Alle 93+ Tool-Definitionen (~15.000 Token, 46 KB JSON-Schema) wurden bei JEDEM Chat-Request an qwen3:30b geschickt. Das Modell konnte aus 93 Optionen nicht zuverlässig die richtige wählen → rief oft KEINE Tools auf, antwortete nur mit Text.
**Regel:** NIEMALS alle Tools auf einmal schicken. Immer `tool-selector.ts` verwenden: Keyword-basierte Intent-Erkennung → max 2 Kategorien → 12-20 Tools pro Request. Base-Tools (navigate, stats) sind immer dabei.

## 2026-04-04 · AI Vision · Bild wird an Ollama gesendet aber LLM sieht es nicht
**Was passierte:** Frontend schickte Bild als Base64 im Socket.io Payload. Backend extrahierte das Bild, schickte aber nur Text-Messages an Ollama. Der LLM wusste nicht dass ein Bild vorhanden war → rief kein Vision-Tool auf. Das Bild wurde erst NACH dem Tool-Call injiziert (Henne-Ei-Problem).
**Regel:** Wenn ein Bild vorhanden ist, IMMER einen Hinweis an die User-Message anhängen: `[📷 Ein Bild wurde hochgeladen. Verwende vision_identify_media...]`. Der LLM sieht den Hint → ruft das Vision-Tool auf → bestehende Image-Injection übergibt das Base64-Bild.

## 2026-04-04 · AI Personality · /no_think deaktiviert Qwen3 Tool-Calling Reasoning
**Was passierte:** System-Prompt startete mit `/no_think` um `<think>`-Tags zu unterdrücken. Qwen3 nutzt aber genau diese Thinking-Phase um zu entscheiden WELCHES Tool aufgerufen werden soll. Ohne Thinking: deutlich schlechtere Tool-Auswahl.
**Regel:** `/no_think` NIEMALS im System-Prompt verwenden wenn Tools aktiv sind. Stattdessen `stripThinkingTags()` auf der Antwort anwenden bevor sie ans Frontend geht. Thinking ist gewollt für Tool-Entscheidungen.

## 2026-04-04 · AI Navigation · open_movie/open_series statt navigate_search
**Was passierte:** `navigate_search` war ein Base-Tool (immer verfügbar). Der LLM nahm es als bequeme Abkürzung statt die Zwei-Schritt-Kette movies_search → navigate_to zu verwenden. Ergebnis: User landete immer auf der Suchseite statt auf der Film-Detailseite.
**Regel:** Composite-Tools (`open_movie`, `open_series`) verwenden die Suche + Navigation in einem Schritt kombinieren. `navigate_search` aus den Base-Tools entfernen, nur in spezifischen Kategorien verfügbar machen.

## 2026-04-04 · AI Tool Results · Radarr-ID ≠ TMDB-ID
**Was passierte:** `open_movie` gab `id: match.id` (Radarr-ID, z.B. 1604) zurück. Der LLM baute daraus `tmdb.org/movie/1604` → komplett falscher Film. Radarr-IDs und TMDB-IDs sind völlig unterschiedliche Nummern.
**Regel:** Tool-Results IMMER mit `tmdbId` (und ggf. `tvdbId`) zurückgeben wenn externe Links möglich sind. Im System-Prompt explizit anweisen: "Für TMDB-Links IMMER tmdbId verwenden, NIEMALS id."

## 2026-04-03 · MediaIcon.vue · Import-Pfad `@/` statt relativ
**Was passierte:** `import ... from '@/utils/mediaIcons'` in MediaIcon.vue – vue-tsc konnte das Modul nicht finden weil kein `paths`-Alias in tsconfig.json konfiguriert ist.
**Regel:** nexarr v2 nutzt KEINE `@/`-Aliases. IMMER relative Pfade mit `.js`-Extension: `from '../utils/mediaIcons.js'`, `from '../../composables/useApi.js'` etc.

## 2026-04-03 · Brand SVGs · Wikimedia Downloads liefern HTML statt SVG
**Was passierte:** `curl -sL` und `Special:FilePath` URLs lieferten HTML-Fehlerseiten statt SVGs. Auch `upload.wikimedia.org` URLs geben bei zu schnellem Zugriff HTTP 429 (Rate Limiting). bash `curl` auf Unraid blockiert generell `upload.wikimedia.org`.
**Regel:** Wikimedia-Downloads immer mit **Node.js** (`https.get` mit User-Agent Header). **1.5s Delay** zwischen Downloads. URLs über die **Wikimedia API** (`/w/api.php?action=query&prop=imageinfo`) verifizieren – die Hash-Pfade (ändern sich!). Skip-already-valid Pattern: Datei nur downloaden wenn sie noch kein valides SVG ist.

## 2026-04-03 · Brand SVGs · H.264/HEVC/AV1 Logos haben Box-Hintergründe
**Was passierte:** H.264 SVG hat ein weißes Rechteck als Hintergrund + dunklen Text. `filter: brightness(0) invert(1)` invertiert beides → schwarzer Kasten mit weißem Text. Bei 10–13px Größe erscheint das als weißes Quadrat.
**Regel:** Brand-Icons nur für **saubere Wortmarken ohne Hintergrund** verwenden: Dolby-Familie, DTS-Familie, HDR10/HDR10+. Komplexe Logos mit Box/Rahmen (H.264, HEVC, AV1) als **Text-Badges** belassen – kein `brand`-Key im TechBadge-Objekt.

## 2026-04-03 · MediaIcon · CSS filter für weiße Icons
**Was passierte:** SVGs von Wikimedia haben verschiedene Farben (schwarz, bunt, etc.). Auf dunklem UI müssen sie weiß sein.
**Regel:** `filter: brightness(0) invert(1)` auf dem `<img>` Tag. Das macht JEDE Farbe zu Weiß. `colorful` prop für Originalfarben. Höhe fixieren (`height`), Breite `auto` für korrekte Proportionen. Kein `width`+`height` gleichzeitig – das verzerrt/schneidet ab.

## 2026-04-03 · CalendarView · Sonarr finaleType Enum-Werte falsch
**Was passierte:** `isFinale` prüfte auf `['seasonFinale','seriesFinale','midSeasonFinale']`. Sonarr liefert aber `'season'`, `'series'`, `'midSeason'` (ohne "Finale"-Suffix). Ergebnis: Finale-Symbol ★ wurde nie angezeigt.
**Regel:** Sonarr `finaleType` Werte sind: `'none'`, `'season'`, `'series'`, `'midSeason'`. NICHT `'seasonFinale'` etc. Immer `.toLowerCase()` beim Vergleichen – API-Werte können mixed-case sein.

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

## 2026-04-04 · AI Tools · 93 Tools auf einmal an Ollama überlasten das Modell
**Was passierte:** Alle 93 Tool-Definitionen (~15.000 Token) wurden bei jedem Chat-Request an qwen3:30b geschickt. Das Modell konnte aus 93 Optionen nicht zuverlässig wählen und rief einfach KEINE Tools auf – nur Text-Antworten.
**Regel:** NIEMALS alle Tools auf einmal schicken. Immer `selectTools()` aus `tool-selector.ts` verwenden. Keywords → max 2 Kategorien → ~15-20 Tools pro Request. Basis-Tools (Navigation, Stats) sind immer dabei.

## 2026-04-04 · AI Tools · /no_think sabotiert Tool Calling bei Qwen3
**Was passierte:** System-Prompt startete mit `/no_think` was Qwen3's Chain-of-Thought deaktiviert. Ohne Thinking wählt das Modell Tools signifikant schlechter.
**Regel:** KEIN `/no_think` im System-Prompt. Thinking ist gewollt für Tool-Auswahl. `stripThinkingTags()` entfernt `<think>` Blöcke bevor sie ans Frontend gehen.

## 2026-04-04 · AI Vision · Bild erreicht Ollama nie ohne Hint
**Was passierte:** Bild wurde aus Socket-Payload extrahiert und in Tool-Arguments injiziert, aber der LLM sah nur Text → rief nie Vision-Tools auf.
**Regel:** Bei Bild-Upload einen Text-Hinweis an die User-Message anhängen: `[📷 Ein Bild wurde hochgeladen. Verwende das Tool "vision_identify_media"...]`. So weiß der LLM dass ein Bild da ist.

<!-- Einträge werden hier chronologisch ergänzt, neueste zuerst -->

<!-- Beispiel-Format:
## 2026-04-01 · radarr.routes.ts · Fehlender Cache-Invalidate
**Was passierte:** Nach dem Hinzufügen eines Films wurde der Cache nicht invalidiert,
UI zeigte alten Stand.
**Regel:** Nach jedem schreibenden API-Call den zugehörigen Cache-Key invalidieren.
-->
