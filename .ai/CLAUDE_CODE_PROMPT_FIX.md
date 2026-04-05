# nexarr AI – Claude Code Fix-Prompt: Tool-Architektur Umbau

> Dieses Dokument wird von Claude Code gelesen.
> Erstellt: 04.04.2026
> Problem: 93 Tools werden bei JEDEM Request an Ollama geschickt → Modell überfordert, findet nichts, ruft keine Tools auf
> Zusätzlich: Bilder erreichen Ollama nie, /no_think sabotiert Tool Calling

---

## Projektpfad & Pflichtlektüre

```
Pfad: /mnt/user/appdata/openclaw/config/workspace/nexarr-v2/
```

**Zuerst lesen:**
1. `.ai/CONTEXT.md` – aktueller Stand
2. `.ai/LESSONS.md` – bekannte Regeln
3. `.ai/CONVENTIONS.md` – Code-Standards

---

## 3 kritische Bugs die du fixen musst

### Bug 1: 93 Tools überlasten das Modell (KRITISCH)

**Problem:** `tools.ts` ist 46 KB – das sind ~15.000 Token Tool-Definitionen die bei JEDEM
Chat-Request an Ollama mitgeschickt werden. `qwen3:30b` kann aus 93 Optionen nicht zuverlässig
die richtige wählen. Selbst GPT-4 degradiert bei >30 Tools massiv. Ergebnis: Modell ruft
einfach KEINE Tools auf und antwortet nur mit Text.

**Lösung: Zweistufige Architektur – Smart Tool Selector**

Statt alle 93 Tools bei jedem Request mitzuschicken, klassifiziere zuerst den Intent
und lade dann NUR die relevanten Tools (max 12-15).

#### Neue Datei: `packages/server/src/ai/tool-selector.ts`

```typescript
// Konzept: Intent aus User-Message ableiten → passende Tool-Subset auswählen

interface ToolCategory {
  name: string;
  keywords: string[];            // Schnelle Keyword-Erkennung
  tools: OllamaTool[];           // Die Tools dieser Kategorie
}

// 10 Kategorien definieren:
const categories: ToolCategory[] = [
  {
    name: 'movies',
    keywords: ['film', 'movie', 'kino', 'radarr', 'tmdb', 'schauen',
               'hinzufügen', 'download', 'suche', 'empfehl', 'poster'],
    tools: [moviesSearch, moviesLookup, moviesAdd, moviesDetails, moviesDelete,
            moviesTriggerSearch, moviesInteractiveSearch, moviesGrabRelease,
            moviesMissing, moviesHistory, moviesUpdate, moviesTmdbRich,
            moviesRecommendations, moviesQualityProfiles]
  },
  {
    name: 'series',
    keywords: ['serie', 'series', 'staffel', 'episode', 'sonarr', 'folge',
               'season', 'tv show', 'fernseh'],
    tools: [seriesSearch, seriesLookup, seriesAdd, seriesDetails, seriesDelete,
            seriesEpisodes, seriesTriggerSearch, seriesGrabRelease, seriesMissing,
            seriesHistory, seriesSeasonMonitor, seriesUpdate, seriesTmdbRich,
            seriesNextEpisode]
  },
  {
    name: 'music',
    keywords: ['musik', 'music', 'artist', 'album', 'song', 'lidarr', 'künstler'],
    tools: [musicSearch, musicLookup, musicAdd, musicDetails, musicTriggerSearch]
  },
  {
    name: 'downloads',
    keywords: ['download', 'queue', 'sabnzbd', 'sab', 'transmission', 'torrent',
               'nzb', 'speed', 'pause', 'geschwindigkeit', 'fortschritt'],
    tools: [downloadsStatus, downloadsPause, downloadsResume,
            downloadsPauseSingle, downloadsDelete, downloadsPriority, downloadsSpeedLimit]
  },
  {
    name: 'streams',
    keywords: ['stream', 'plex', 'schaut', 'guckt', 'wiedergabe', 'abspielen',
               'tautulli', 'play', 'läuft'],
    tools: [streamsActive, streamsHistory, plexLibraries, plexDeeplink, plexPlay]
  },
  {
    name: 'analytics',
    keywords: ['statistik', 'stats', 'analytics', 'meistgeschaut', 'beliebt',
               'watch time', 'trend', 'transcode', 'history', 'verlauf'],
    tools: [analyticsMostWatched, analyticsUserStats, analyticsLibraryStats,
            analyticsRecentlyAdded, analyticsWatchTimeTrend, analyticsTranscodeStats,
            analyticsConcurrentStreams, analyticsUserHistory]
  },
  {
    name: 'discover',
    keywords: ['trending', 'discover', 'empfehlung', 'ähnlich', 'genre',
               'kalender', 'kommend', 'release', 'neu', 'morgen', 'woche'],
    tools: [calendarUpcoming, calendarToday, discoverTrending,
            discoverByGenre, discoverSimilar]
  },
  {
    name: 'system',
    keywords: ['system', 'health', 'status', 'overseerr', 'anfrage', 'request',
               'bazarr', 'untertitel', 'subtitle', 'gotify', 'benachrichtigung',
               'notification', 'audiobook', 'hörbuch', 'prowlarr', 'indexer'],
    tools: [statsOverview, systemHealth,
            overseerrRequests, overseerrApprove, overseerrDecline,
            subtitlesMovieStatus, subtitlesSeriesStatus, subtitlesSearch,
            audiobooksSearch, audiobooksDetails, audiobooksLibraries,
            notificationsList, notificationsClear,
            prowlarrSearch, prowlarrGrab]
  },
  {
    name: 'smart',
    keywords: ['empfiehl', 'recommend', 'filmabend', 'watchlist', 'stimmung',
               'mood', 'vorschlag', 'langweilig', 'was soll ich', 'quiz',
               'report', 'bibliothek', 'library'],
    tools: [recommend, buildWatchlist, libraryReport, whatToWatch, mediaQuiz]
  },
  {
    name: 'vision',
    keywords: [],  // Vision wird über image-Flag getriggert, nicht Keywords
    tools: [visionIdentifyMedia, visionAnalyzePoster, visionUiHelp]
  },
];

// Tools die IMMER dabei sind (max 5)
const BASE_TOOLS: OllamaTool[] = [
  navigateTo,
  navigateToExternal,
  statsOverview,
  showPosterCard,         // Damit die AI immer Poster-Cards zeigen kann
  showActionButtons,
];

/**
 * Wählt die relevanten Tools basierend auf der User-Message aus.
 * Maximal ~20 Tools pro Request.
 */
export function selectTools(message: string, hasImage: boolean): OllamaTool[] {
  const msgLower = message.toLowerCase();
  const selected = new Set<OllamaTool>(BASE_TOOLS);

  // Bei Bild: immer Vision-Tools laden
  if (hasImage) {
    for (const tool of categories.find(c => c.name === 'vision')!.tools) {
      selected.add(tool);
    }
  }

  // Keyword-Matching: finde passende Kategorien
  const matchedCategories: ToolCategory[] = [];
  for (const cat of categories) {
    if (cat.name === 'vision') continue; // separat gehandhabt
    const matches = cat.keywords.filter(kw => msgLower.includes(kw));
    if (matches.length > 0) {
      matchedCategories.push(cat);
    }
  }

  // Wenn keine Kategorie matched → generische Tools (smart + system)
  if (matchedCategories.length === 0) {
    const smart = categories.find(c => c.name === 'smart')!;
    const system = categories.find(c => c.name === 'system')!;
    for (const tool of [...smart.tools, ...system.tools.slice(0, 5)]) {
      selected.add(tool);
    }
  } else {
    // Max 2 Kategorien laden (die mit den meisten Keyword-Matches)
    matchedCategories
      .sort((a, b) => {
        const aHits = a.keywords.filter(kw => msgLower.includes(kw)).length;
        const bHits = b.keywords.filter(kw => msgLower.includes(kw)).length;
        return bHits - aHits;
      })
      .slice(0, 2)
      .forEach(cat => {
        for (const tool of cat.tools) selected.add(tool);
      });
  }

  const result = Array.from(selected);
  console.log(`[AI ToolSelector] ${result.length} Tools für: "${message.slice(0, 60)}..."`);
  return result;
}
```

#### Änderungen in `stream.ts`

Ersetze die Zeile:
```typescript
const response = await chat(messages, { temperature: 0.3, tools: allTools });
```

Mit:
```typescript
import { selectTools } from './tool-selector.js';
// ...
const selectedTools = selectTools(message, !!image);
const response = await chat(messages, { temperature: 0.3, tools: selectedTools });
```

Und auch in `streamFinalResponse` KEINE Tools mitschicken (die finale Streaming-Antwort
braucht keine Tools – der LLM hat seine Tool-Calls schon gemacht):
```typescript
// In streamFinalResponse: chatStream OHNE tools aufrufen
for await (const chunk of chatStream(messages)) { ... }
// (chatStream hat schon keine tools – das passt)
```

Und ebenso in `agent.ts` (REST-Endpoint falls verwendet):
```typescript
const selectedTools = selectTools(userMessage, false);
const response = await chat(messages, { temperature: 0.3, tools: selectedTools });
```

---

### Bug 2: Hochgeladenes Bild erreicht Ollama nie (KRITISCH)

**Problem:** In `stream.ts` wird das Bild aus dem Payload extrahiert, aber NIE in die
Messages an Ollama eingefügt. Der `OllamaMessage` Type hat nur `content: string`,
kein `images` Feld. Der LLM sieht nur Text, weiß nicht dass ein Bild da ist,
und kann deshalb nie ein Vision-Tool aufrufen.

Das Bild wird zwar später in die Tool-Arguments injiziert:
```typescript
if (image && call.function.name.startsWith('vision_')) {
  call.function.arguments.image = image;
}
```
Aber der LLM kommt nie zu diesem Punkt, weil er ohne Bildkenntnis kein Vision-Tool aufruft.

**Lösung:** Wenn ein Bild vorhanden ist, den User-Message Text erweitern:

```typescript
// In stream.ts, VOR dem messages-Array-Bau:

let userContent = message;
if (image) {
  userContent += '\n\n[📷 Ein Bild wurde hochgeladen. Verwende das Tool "vision_identify_media" um das Bild zu analysieren und den Film/die Serie zu erkennen. Das Bild wird automatisch an das Vision-Tool übergeben.]';
}

const messages: OllamaMessage[] = [
  { role: 'system', content: systemPrompt },
  ...history,
  { role: 'user', content: userContent },
];
```

Das teilt dem LLM mit dass ein Bild da ist. Er wird dann `vision_identify_media` aufrufen,
und der bestehende Code `call.function.arguments.image = image` injiziert das Bild in die
Tool-Arguments. Der Vision-Executor `chatWithImage()` bekommt es dann als Base64.

---

### Bug 3: `/no_think` sabotiert Tool Calling (WICHTIG)

**Problem:** In `personality.ts` startet der System-Prompt mit `/no_think`.
Das deaktiviert Qwen3's Chain-of-Thought Thinking. Aber Qwen3 nutzt genau diese
Thinking-Phase um zu entscheiden WELCHES Tool aufgerufen werden soll und mit welchen
Parametern. Ohne Thinking wird die Tool-Auswahl signifikant schlechter.

**Lösung:** `/no_think` aus dem System-Prompt ENTFERNEN.
Die `<think>...</think>` Tags werden bereits von `stripThinkingTags()` in `ai.service.ts`
aus der Antwort entfernt bevor sie ans Frontend geht. Der User sieht sie nie.

```typescript
// personality.ts – VORHER:
const NEXARR_PERSONALITY = `/no_think
Du bist nexarr AI – ...`;

// personality.ts – NACHHER:
const NEXARR_PERSONALITY = `Du bist nexarr AI – ...`;
```

Thinking ist GEWOLLT für Tool Calling. Es macht die Tool-Auswahl zuverlässiger.
Die Performance-Kosten sind minimal (ein paar hundert extra Tokens die nie zum User gehen).

---

## Zusammenfassung der Änderungen

| Datei | Was ändern |
|-------|-----------|
| **NEU: `ai/tool-selector.ts`** | Smart Tool Selector: Keywords → max 12-15 relevante Tools |
| `ai/stream.ts` | `allTools` → `selectTools(message, !!image)` + Image-Hint in User-Message |
| `ai/agent.ts` | `allTools` → `selectTools(userMessage, false)` |
| `ai/personality.ts` | `/no_think` Prefix entfernen |
| `ai/tools.ts` | Alle Tools bleiben, aber NICHT mehr direkt `allTools` exportieren – stattdessen einzeln exportieren damit tool-selector.ts sie gruppieren kann |

**WICHTIG:** `tools.ts` NICHT verkleinern oder Tools löschen! Alle 93 Tools bleiben definiert.
Sie werden nur SMART GEFILTERT statt alle auf einmal geschickt.

---

## Implementierungs-Reihenfolge

1. Lies die 3 Pflicht-Dateien (CONTEXT, LESSONS, CONVENTIONS)
2. Lies `packages/server/src/ai/tools.ts` – verstehe die Tool-Struktur
3. Lies `packages/server/src/ai/stream.ts` – verstehe den Chat-Flow
4. Erstelle `ai/tool-selector.ts` mit dem Smart Tool Selector
5. Ändere `tools.ts`: zusätzlich zu `allTools` alle Tools auch einzeln (named) exportieren
6. Ändere `stream.ts`: `selectTools()` statt `allTools`, Image-Hint, `image`-Injection
7. Ändere `agent.ts`: `selectTools()` statt `allTools`
8. Ändere `personality.ts`: `/no_think` entfernen
9. `npm run typecheck`
10. `npm run restart`
11. Teste mit Playwright:
    - "Suche den Film Dune in meiner Bibliothek" → muss movies_search aufrufen
    - "Füge Inception hinzu" → muss movies_lookup + movies_add aufrufen
    - "Wer schaut gerade?" → muss streams_active aufrufen
    - "Öffne die Film-Seite" → muss navigate_to aufrufen
    - Bild hochladen + "Was ist das?" → muss vision_identify_media aufrufen
12. Commit: `feat(ai): smart tool selector – fix tool overload, image routing, thinking`
13. CONTEXT.md aktualisieren
14. LESSONS.md aktualisieren mit: "93 Tools auf einmal an Ollama schicken funktioniert nicht. Immer tool-selector.ts verwenden, max 15 Tools pro Request."

---

## Dev-Workflow

```bash
cd /mnt/user/appdata/openclaw/config/workspace/nexarr-v2
npm run typecheck
npm run restart
npm run logs    # Prüfe ob [AI ToolSelector] Logs erscheinen
```
