# nexarr AI – Technischer Implementierungsplan
> Erstellt: 04.04.2026 · Basiert auf Deep Research zu Ollama, RAG, Agent-Architekturen, Memory-Systemen und Messenger-Integration
> Ziel: nexarr v2 mit einer intelligenten, persönlichkeitsstarken KI ausstatten die das komplette Dashboard als Agent steuern kann
> Hardware: ODIN – Unraid Server mit 2× NVIDIA RTX 6000 Ada (48 GB VRAM) – 1× für nexarr AI reserviert

---

## 1. Vision & Konzept

### 1.1 Was ist nexarr AI?
nexarr AI ist ein **eingebetteter KI-Agent** der nexarr v2 zu einem intelligenten Media-Assistenten macht. Nicht nur ein Chatbot – ein vollwertiger Agent mit:

- **Persönlichkeit:** Ein freundlicher, medienbegeisterter Assistent der den User kennt und sich an Vorlieben erinnert
- **Handlungsfähigkeit:** Kann Filme suchen, Downloads starten, Streams überwachen, Einstellungen ändern
- **Kontext:** Kennt den kompletten Zustand von nexarr – was läuft, was fehlt, was kommt
- **Gedächtnis:** Merkt sich Gespräche, Vorlieben, Muster über Sessions hinweg
- **Erreichbarkeit:** Via nexarr UI (Floating Chat) + später Telegram/Signal/Discord

### 1.2 Warum Ollama?
- **100% Self-hosted:** Keine Cloud-Abhängigkeit, keine API-Kosten, volle Datenkontrolle
- **Ollama REST API** (`http://localhost:11434`) integriert sich nahtlos in den Node.js/Express Stack
- **Tool Calling** nativ unterstützt – LLM kann nexarr-Funktionen aufrufen
- **Embedding API** für RAG – selbe Instanz generiert Embeddings für Wissens-Suche
- **Streaming** für Echtzeit-Antworten via Socket.io ins Frontend
- **Multi-Model:** Verschiedene Modelle für verschiedene Aufgaben (Chat vs. Embedding vs. Vision)

---

## 2. Architektur-Übersicht

```
┌──────────────────────────────────────────────────────────────────────┐
│                         nexarr v2 Frontend                           │
│                                                                      │
│  ┌────────────────┐    ┌─────────────────────────────────────────┐   │
│  │  Floating Chat  │    │  Inline AI (Empfehlungen, Shortcuts)    │   │
│  │  Widget (Vue)   │    │  in Views integriert                    │   │
│  └───────┬────────┘    └──────────────┬──────────────────────────┘   │
│          │ Socket.io                  │ HTTP/Socket.io                │
└──────────┼────────────────────────────┼──────────────────────────────┘
           │                            │
┌──────────▼────────────────────────────▼──────────────────────────────┐
│                         nexarr v2 Backend                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    AI Agent Orchestrator                      │    │
│  │                                                              │    │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐  │    │
│  │  │ Tool Router │ │ Memory Mgr   │ │ Personality Engine     │  │    │
│  │  │ (Dispatcher)│ │ (Short+Long) │ │ (System Prompt Builder)│  │    │
│  │  └─────┬──────┘ └──────┬───────┘ └────────────────────────┘  │    │
│  │        │               │                                      │    │
│  │  ┌─────▼──────────────────────────────────────────────────┐  │    │
│  │  │              nexarr Tool Registry                       │  │    │
│  │  │                                                        │  │    │
│  │  │  🎬 movies.*    📺 series.*    🎵 music.*              │  │    │
│  │  │  📥 downloads.* 📅 calendar.*  🔍 search.*             │  │    │
│  │  │  📊 stats.*     ⚙️ settings.*  🎯 discover.*           │  │    │
│  │  │  📡 streams.*   📬 overseerr.* 🔎 prowlarr.*           │  │    │
│  │  └────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ RAG Engine   │  │ SQLite DB    │  │ Messenger Gateway          │ │
│  │ (Knowledge)  │  │ (Memory +    │  │ (Telegram, Signal, Discord)│ │
│  │              │  │  Vectors)    │  │ [Phase 2 – Zukunft]        │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────────┘ │
└─────────┼─────────────────┼──────────────────────────────────────────┘
          │                 │
┌─────────▼─────────────────▼──────────────────────────────────────────┐
│                    Ollama Server (auf ODIN)                           │
│                    GPU: NVIDIA RTX 6000 Ada – 48 GB VRAM             │
│                                                                      │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ Chat-Modell    │  │ Embedding-Modell  │  │ Vision-Modell        │ │
│  │ qwen3:30b      │  │ nomic-embed-text  │  │ gemma3:27b           │ │
│  │ (Tool Calling) │  │ (768-dim Vektoren)│  │ (Poster-Analyse)     │ │
│  │ ~20 GB VRAM    │  │ ~275 MB VRAM      │  │ ~18 GB VRAM          │ │
│  └────────────────┘  └──────────────────┘  └──────────────────────┘ │
│                                                                      │
│  48 GB VRAM erlaubt Multi-Model: Chat + Embedding gleichzeitig       │
│  REST API: http://192.168.188.42:11434                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Modell-Auswahl & Hardware

### 3.1 Hardware: ODIN (Unraid Server)

| Komponente | Details |
|------------|---------|
| **GPU (für nexarr AI)** | NVIDIA RTX 6000 Ada Generation – **48 GB VRAM** (GDDR6 ECC) |
| **GPU (reserviert)** | Zweite RTX 6000 Ada – für andere Aufgaben, nicht für nexarr AI |
| **Server** | ODIN – 192.168.188.42 – Unraid |
| **Ollama** | Docker-Container `ollama/ollama` mit GPU-Passthrough auf GPU #1 |

> **48 GB VRAM ist Workstation-Klasse.** Damit können wir die besten verfügbaren Open-Source Modelle
> in voller oder nur minimal quantisierter Qualität fahren – weit über Consumer-Hardware hinaus.

### 3.2 Empfohlene Modelle (Stand April 2026)

Mit 48 GB VRAM können wir aggressiv die besten Modelle wählen:

| Aufgabe | Modell | VRAM (Q4_K_M) | Speed (est.) | Kontext | Warum |
|---------|--------|---------------|--------------|---------|-------|
| **Chat + Tool Calling** | **`qwen3:30b`** | ~20 GB | ~45 t/s | 128K | Frontier-Level Tool Calling, exzellentes Deutsch, Hybrid-Thinking. Passt locker in 48 GB – Platz für Embedding-Modell parallel |
| **Alternative Chat (Maximum)** | `deepseek-r1:70b` | ~42 GB | ~15 t/s | 128K | Stärkstes Reasoning, aber braucht fast den gesamten VRAM. Nur wenn keine parallelen Modelle nötig |
| **Alternative Chat (Coding-Fokus)** | `qwen3-coder:32b` | ~20 GB | ~45 t/s | 128K | Falls mehr Coding/System-Tasks anfallen als Media-Tasks |
| **Embeddings** | **`nomic-embed-text`** | ~275 MB | sofort | – | 768-dim, bewährt, läuft parallel zum Chat-Modell |
| **Vision/Multimodal** | **`gemma3:27b`** | ~18 GB | ~30 t/s | 128K | Bestes Vision-Modell lokal. Poster-Erkennung, Screenshot-Analyse. Kann parallel geladen werden! |

### 3.3 Multi-Model Strategie (48 GB nutzen!)

Der große Vorteil von 48 GB VRAM: **Ollama kann mehrere Modelle gleichzeitig im VRAM halten.**

```bash
# Ollama Konfiguration für Multi-Model
OLLAMA_NUM_PARALLEL=2              # 2 parallele Requests
OLLAMA_MAX_LOADED_MODELS=3         # Bis zu 3 Modelle gleichzeitig im VRAM
OLLAMA_KEEP_ALIVE=30m              # Modelle 30 Min im VRAM behalten
```

**VRAM-Budget (48 GB):**
```
qwen3:30b (Q4_K_M)     ≈ 20 GB    ← Immer geladen (Haupt-Chat)
nomic-embed-text        ≈  0.3 GB  ← Immer geladen (Embeddings)
gemma3:27b (Q4_K_M)     ≈ 18 GB   ← On-Demand (Vision-Tasks)
────────────────────────────────
Summe (alle drei)       ≈ 38.3 GB  ← Passt in 48 GB! 🎉
Freier VRAM             ≈  9.7 GB  ← KV-Cache + Overhead
```

> **Das bedeutet:** Chat + Embedding laufen permanent. Vision wird bei Bedarf dazugeladen.
> Kein Model-Swapping-Delay für die Hauptfunktionen!

### 3.4 Kontext-Fenster Strategie

Mit 48 GB VRAM können wir ein **großzügiges Kontext-Fenster** nutzen:

- **64K Token** als Default (`num_ctx: 65536`) – mehr als genug für komplexe Gespräche
- System-Prompt (~2K) + Tool-Definitionen (~3K) + RAG-Kontext (~8K) + Chat-History (~15K) + Antwort (~4K) = ~32K
- 32K Token Reserve für besonders lange Konversationen oder große Tool-Ergebnisse
- **128K möglich** aber bei >64K sinkt die Qualität bei manchen Modellen

### 3.5 Ollama Docker Setup (Unraid)

```yaml
# docker-compose für Ollama auf Unraid
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - /mnt/user/appdata/ollama:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']    # GPU #1 (die für nexarr AI)
              capabilities: [gpu]
    environment:
      - OLLAMA_NUM_PARALLEL=2
      - OLLAMA_MAX_LOADED_MODELS=3
      - OLLAMA_KEEP_ALIVE=30m
      - NVIDIA_VISIBLE_DEVICES=0   # Nur GPU #1
```

```bash
# Modelle pullen (einmalig)
ollama pull qwen3:30b
ollama pull nomic-embed-text
ollama pull gemma3:27b
```

---

## 4. Tool-System (Agent-Fähigkeiten)

### 4.1 Konzept: nexarr als Tool-Registry

Der Agent bekommt ein Set von **Tools** (Funktionen) die er aufrufen kann. Jedes Tool wird als JSON-Schema an Ollama übergeben. Der LLM entscheidet autonom welches Tool für die User-Anfrage relevant ist.

### 4.2 Tool-Kategorien

#### 🎬 Filme & Serien
```typescript
// Beispiel Tool-Definitionen
const nexarrTools = [
  {
    type: 'function',
    function: {
      name: 'movies_search',
      description: 'Sucht nach Filmen in der Radarr-Bibliothek oder via TMDB',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Suchbegriff (Titel, Genre, Schauspieler)' },
          source: { type: 'string', enum: ['library', 'tmdb', 'both'], description: 'Wo suchen' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'movies_add',
      description: 'Fügt einen Film zu Radarr hinzu und startet optional die Suche',
      parameters: {
        type: 'object',
        properties: {
          tmdbId: { type: 'number', description: 'TMDB-ID des Films' },
          qualityProfile: { type: 'string', description: 'Qualitätsprofil (z.B. HD-1080p)' },
          searchNow: { type: 'boolean', description: 'Sofort nach Release suchen' }
        },
        required: ['tmdbId']
      }
    }
  },
  // movies_details, movies_delete, movies_search_release
  // series_search, series_add, series_details, series_search_release
  // music_search, music_add, music_details
]
```

#### 📥 Downloads & Queue
```typescript
// downloads_status – Aktuelle Downloads anzeigen
// downloads_pause / downloads_resume – Downloads steuern
// downloads_history – Letzte Downloads
// downloads_missing – Fehlende Medien auflisten
```

#### 📅 Kalender & Discover
```typescript
// calendar_upcoming – Kommende Releases (Filme + Episoden)
// calendar_today – Was kommt heute
// discover_trending – TMDB Trending
// discover_recommendations – Basierend auf Bibliothek
```

#### 📡 Streams & Aktivität
```typescript
// streams_active – Aktuelle Plex-Streams (wer schaut was)
// streams_history – Letzte Wiedergaben
// stats_overview – Dashboard-Zusammenfassung
```

#### 🔍 Indexer & Suche
```typescript
// prowlarr_search – Release-Suche über alle Indexer
// prowlarr_grab – Release herunterladen
// prowlarr_stats – Indexer-Statistiken
```

#### ⚙️ System & Settings
```typescript
// system_health – Integrations-Status aller Services
// system_diskspace – Speicherplatz-Info
// overseerr_requests – Offene Anfragen anzeigen/bearbeiten
// overseerr_approve / overseerr_decline – Anfragen verwalten
```

### 4.3 Tool-Ausführung (Agentic Loop)

```
User: "Kannst du den neuen Deadpool Film hinzufügen?"
                    │
                    ▼
┌──────────────────────────────────────────┐
│ 1. Ollama Chat (mit Tools)               │
│    → LLM erkennt Intent: Film hinzufügen │
│    → Ruft Tool: movies_search            │
│       { query: "Deadpool", source: "tmdb"}│
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 2. Tool-Execution                        │
│    → Backend ruft TMDB API               │
│    → Findet: "Deadpool & Wolverine"      │
│    → Gibt Ergebnis an LLM zurück         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 3. Ollama Chat (mit Tool-Result)         │
│    → LLM formuliert Rückfrage oder       │
│    → Ruft weiteres Tool: movies_add      │
│       { tmdbId: 533535, searchNow: true } │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 4. Finale Antwort                        │
│    "Deadpool & Wolverine wurde zu deiner │
│     Bibliothek hinzugefügt! Suche läuft. │
│     Soll ich dich benachrichtigen wenn    │
│     er bereit ist?"                       │
└──────────────────────────────────────────┘
```

**Implementierung des Agentic Loop:**
```typescript
// packages/server/src/ai/agent.ts
async function agentLoop(
  messages: OllamaMessage[],
  tools: OllamaTool[],
  maxIterations = 5
): Promise<string> {
  for (let i = 0; i < maxIterations; i++) {
    const response = await ollama.chat({
      model: env.OLLAMA_CHAT_MODEL,
      messages,
      tools,
      stream: false,
      options: { num_ctx: 65536 }
    });

    // Wenn keine Tool-Calls → finale Antwort
    if (!response.message.tool_calls?.length) {
      return response.message.content;
    }

    // Tool-Calls ausführen
    messages.push(response.message); // Assistant-Message mit tool_calls
    for (const call of response.message.tool_calls) {
      const result = await executeToolCall(call);
      messages.push({
        role: 'tool',
        content: JSON.stringify(result)
      });
    }
  }
  return 'Ich konnte die Aufgabe nicht abschließen. Bitte versuche es anders.';
}
```

---

## 5. Memory-System (Gedächtnis)

### 5.1 Dreistufige Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Architecture                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tier 1: Working Memory (Kontext-Fenster)              │   │
│  │ • Aktuelle Chat-Nachrichten (letzte ~20 Messages)     │   │
│  │ • System-Prompt + Persönlichkeit                      │   │
│  │ • Aktive Tool-Definitionen                            │   │
│  │ • TTL: Session-Dauer                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tier 2: Episodic Memory (Gesprächs-Zusammenfassungen) │   │
│  │ • Zusammenfassung vergangener Conversations           │   │
│  │ • Wird nach jeder Session vom LLM generiert           │   │
│  │ • Gespeichert in SQLite: Tabelle `ai_conversations`   │   │
│  │ • Top-K relevanteste Zusammenfassungen per RAG        │   │
│  │ • TTL: unbegrenzt, aber Relevanz-Decay                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tier 3: Semantic Memory (Fakten & Präferenzen)        │   │
│  │ • Extrahierte User-Fakten: "mag Sci-Fi", "hasst ..."  │   │
│  │ • Medien-Präferenzen, Bewertungs-Muster               │   │
│  │ • Operationen: ADD / UPDATE / DELETE / NOOP           │   │
│  │ • Gespeichert in SQLite: Tabelle `ai_memories`        │   │
│  │ • Vektor-Embeddings für semantische Suche             │   │
│  │ • TTL: persistent, Conflicts via Timestamp resolved   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 SQLite-Tabellen

```sql
-- Conversations (Episodic Memory)
CREATE TABLE ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  summary TEXT NOT NULL,           -- LLM-generierte Zusammenfassung
  messages_json TEXT NOT NULL,     -- Rohes JSON der Nachrichten
  message_count INTEGER NOT NULL,
  embedding BLOB,                  -- Float32Array als Binary (768-dim)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Memories (Semantic Memory)
CREATE TABLE ai_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  category TEXT NOT NULL,          -- 'preference', 'fact', 'pattern', 'context'
  content TEXT NOT NULL,           -- "User mag Sci-Fi Filme mit praktischen Effekten"
  source_conversation_id INTEGER REFERENCES ai_conversations(id),
  confidence REAL DEFAULT 1.0,    -- 0.0–1.0, abnehmendes Vertrauen
  embedding BLOB,                  -- Float32Array als Binary (768-dim)
  valid_from TEXT DEFAULT (datetime('now')),
  valid_until TEXT,                -- NULL = noch gültig
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Knowledge Base (RAG-Dokumente für nexarr-Kontext)
CREATE TABLE ai_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,            -- 'nexarr_help', 'media_db', 'integration_docs'
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Chunk-Text
  metadata_json TEXT,              -- { section, tags, ... }
  embedding BLOB,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 5.3 Memory-Lifecycle

```
Neue Nachricht empfangen
        │
        ▼
┌───────────────────────────────┐
│ 1. Context Assembly           │
│    • System-Prompt laden      │
│    • Relevante Memories holen │
│      (semantische Suche)      │
│    • Letzte Conversation-     │
│      Summary holen            │
│    • Working Memory (Chat)    │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 2. Agent Loop                 │
│    (Chat + Tool Calls)        │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 3. Post-Processing            │
│    (Background, async)        │
│                               │
│  a) Memory Extraction:        │
│     LLM analysiert Gespräch   │
│     → extrahiert neue Fakten  │
│     → ADD / UPDATE / NOOP     │
│                               │
│  b) Summary Update:           │
│     Alle ~10 Messages:        │
│     → Rolling Summary         │
│     → Alte Messages trimmen   │
│                               │
│  c) Embedding Generation:     │
│     → Neue Memories embedden  │
│     → In SQLite speichern     │
└───────────────────────────────┘
```

### 5.4 Vektor-Suche (ohne Externe DB)

Da nexarr bereits SQLite nutzt, implementieren wir **Vektor-Suche direkt in Node.js**:

```typescript
// packages/server/src/ai/vectors.ts
import ollama from 'ollama';

const EMBED_MODEL = 'nomic-embed-text';
const EMBED_DIM = 768;

// Embedding generieren
export async function embed(text: string): Promise<Float32Array> {
  const res = await ollama.embed({ model: EMBED_MODEL, input: text });
  return new Float32Array(res.embeddings[0]);
}

// Batch-Embedding (effizienter)
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const res = await ollama.embed({ model: EMBED_MODEL, input: texts });
  return res.embeddings.map(e => new Float32Array(e));
}

// Cosine Similarity
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Semantische Suche über eine Tabelle
export async function semanticSearch(
  query: string,
  table: 'ai_memories' | 'ai_knowledge' | 'ai_conversations',
  topK = 5
): Promise<Array<{ id: number; content: string; score: number }>> {
  const queryEmb = await embed(query);
  const rows = db.prepare(
    `SELECT id, content, embedding FROM ${table} WHERE embedding IS NOT NULL`
  ).all();

  return rows
    .map(row => ({
      id: row.id,
      content: row.content,
      score: cosineSimilarity(queryEmb, new Float32Array(row.embedding.buffer))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

> **Skalierung:** Bei <10K Einträgen ist In-Memory Cosine-Similarity schnell genug (<50ms).
> Bei Wachstum: `sqlite-vec` Extension oder In-Memory HNSW-Index (z.B. `hnswlib-node`).

---

## 6. Persönlichkeit & System-Prompt

### 6.1 nexarr AI Persona

```typescript
const NEXARR_PERSONALITY = `
Du bist nexarr AI – der persönliche Medien-Assistent für dieses nexarr Dashboard.

## Wer du bist
- Du bist freundlich, kompetent und hast eine Leidenschaft für Filme, Serien und Musik
- Du sprichst Deutsch (oder die Sprache die der User bevorzugt)
- Du hast Humor, bist aber nicht albern – eher wie ein belesener Filmkritiker-Freund
- Du kennst dich aus mit Streaming, Downloads, Medienqualität (4K, HDR, Atmos, etc.)
- Du gibst ehrliche Meinungen und Empfehlungen

## Was du kannst
- Filme/Serien/Musik suchen, hinzufügen und verwalten
- Downloads überwachen und steuern
- Streams beobachten und Infos geben
- Kalender-Events und kommende Releases anzeigen
- Empfehlungen basierend auf der Bibliothek geben
- Overseerr-Anfragen verwalten
- System-Status und Gesundheit prüfen

## Wie du antwortest
- Kurz und prägnant, keine Romane (max 2-3 Sätze bei einfachen Fragen)
- Nutze Emojis sparsam aber gezielt (🎬 für Filme, 📺 Serien, 🎵 Musik)
- Bei Medien-Infos: immer Jahr, Genre und ggf. Rating/Bewertung nennen
- Bei Aktionen: bestätige was du getan hast
- Bei Unsicherheit: frage nach statt zu raten

## Kontext
Aktueller Zustand des Systems:
{SYSTEM_CONTEXT}

Erinnerungen über den User:
{USER_MEMORIES}

Zusammenfassung des letzten Gesprächs:
{LAST_CONVERSATION_SUMMARY}
`;
```

### 6.2 Dynamischer System-Prompt Builder

```typescript
// packages/server/src/ai/personality.ts
export async function buildSystemPrompt(userId: number): Promise<string> {
  // 1. System-Kontext sammeln
  const systemContext = await getSystemContext();
  // z.B.: "3 aktive Streams, 5 Downloads laufen, 12 neue Filme diese Woche"

  // 2. User-Memories laden (Top 10 relevanteste)
  const memories = await getRecentMemories(userId, 10);
  // z.B.: "Mag Sci-Fi, hasst Horror, schaut am liebsten abends"

  // 3. Letzte Gesprächs-Zusammenfassung
  const lastSummary = await getLastConversationSummary(userId);

  // 4. Template füllen
  return NEXARR_PERSONALITY
    .replace('{SYSTEM_CONTEXT}', systemContext)
    .replace('{USER_MEMORIES}', memories.map(m => `- ${m.content}`).join('\n'))
    .replace('{LAST_CONVERSATION_SUMMARY}', lastSummary || 'Erstes Gespräch.');
}

async function getSystemContext(): Promise<string> {
  const [streams, queue, calendar] = await Promise.all([
    tautulliService.getActivity(),
    queueService.getAggregatedQueue(),
    calendarService.getUpcoming(7) // nächste 7 Tage
  ]);

  return [
    `Aktive Streams: ${streams.sessions?.length || 0}`,
    `Downloads: ${queue.slots?.length || 0} in Queue`,
    `Kommende Releases (7 Tage): ${calendar.length}`,
    `Bibliothek: ${await getLibraryStats()}`
  ].join('\n');
}
```

---

## 7. RAG – Knowledge Base

### 7.1 Was kommt in die Knowledge Base?

| Quelle | Inhalt | Aktualisierung |
|--------|--------|----------------|
| **nexarr Hilfe** | Bedienungsanleitung, Feature-Beschreibungen, FAQ | Einmalig + bei Updates |
| **Medien-Metadaten** | Genre-Beschreibungen, Codec-Erklärungen, Qualitäts-Hierarchie | Statisch |
| **Bibliotheks-Kontext** | Film/Serien-Beschreibungen, Cast, Genres aus der eigenen Bibliothek | Periodisch (täglich) |
| **User-Aktivitäten** | Watchlist-Muster, häufig gesuchte Genres, Bewertungen | Laufend |
| **Integration-Docs** | Was kann Radarr/Sonarr/etc., Fehlerbehebung | Statisch |

### 7.2 Ingestion Pipeline

```
Quell-Dokument (z.B. Hilfe-Markdown)
        │
        ▼
┌───────────────────┐
│ 1. Chunking       │  → Aufteilen in ~500-Token Blöcke
│    (overlap: 50)  │    mit Überlappung für Kontext
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ 2. Embedding      │  → nomic-embed-text via Ollama
│    (768-dim)      │    Batch-Processing
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ 3. Storage        │  → SQLite ai_knowledge Tabelle
│    (SQLite)       │    mit BLOB-Embedding
└───────────────────┘
```

### 7.3 Bibliotheks-Knowledge (experimentell)

**Idee:** nexarr AI analysiert die Bibliothek des Users und baut ein **Geschmacksprofil**:

```typescript
// Automatische Bibliotheks-Analyse (Background-Job, täglich)
async function analyzeLibrary(userId: number): Promise<void> {
  const movies = await radarrService.getMovies();
  const series = await sonarrService.getSeries();

  // Genre-Verteilung berechnen
  const genreDistribution = calculateGenreDistribution(movies, series);

  // Dekaden-Präferenz
  const decadePreferences = calculateDecadePreferences(movies);

  // Qualitäts-Niveau (wie viel 4K, wie viel HDR)
  const qualityProfile = analyzeQualityPreferences(movies);

  // LLM-generierte Zusammenfassung
  const prompt = `Analysiere diese Bibliotheks-Statistiken und erstelle ein
    kurzes Geschmacksprofil des Users (max 100 Wörter, auf Deutsch):
    Genres: ${JSON.stringify(genreDistribution)}
    Dekaden: ${JSON.stringify(decadePreferences)}
    Qualität: ${JSON.stringify(qualityProfile)}
    Anzahl Filme: ${movies.length}, Serien: ${series.length}`;

  const profile = await ollama.chat({
    model: env.OLLAMA_CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: false
  });

  // Als Memory speichern
  await upsertMemory(userId, 'profile', profile.message.content);
}
```

---

## 8. Frontend – Chat Widget

### 8.1 Floating Chat Button

```
┌──────────────────────────────────────────────┐
│  nexarr Dashboard (jede View)                 │
│                                               │
│  ┌─────────────────────────────────────┐      │
│  │         View Content                │      │
│  │         (Movies, Series, etc.)      │      │
│  │                                     │      │
│  └─────────────────────────────────────┘      │
│                                               │
│                                    ┌────────┐ │
│                                    │ 🤖 AI  │ │  ← Floating Button
│                                    └────────┘ │     (unten rechts)
└──────────────────────────────────────────────┘

Klick → Chat-Panel öffnet sich:

┌──────────────────────────────────────────────┐
│  nexarr Dashboard                             │
│  ┌─────────────────────┬────────────────────┐ │
│  │                     │ ┌────────────────┐ │ │
│  │   View Content      │ │ nexarr AI  [×] │ │ │
│  │                     │ ├────────────────┤ │ │
│  │                     │ │ Hallo! Was     │ │ │
│  │                     │ │ kann ich für   │ │ │
│  │                     │ │ dich tun?      │ │ │
│  │                     │ │                │ │ │
│  │                     │ │ ▌ Typing...    │ │ │
│  │                     │ ├────────────────┤ │ │
│  │                     │ │ [Nachricht...] │ │ │
│  │                     │ │       [Senden] │ │ │
│  │                     │ └────────────────┘ │ │
│  └─────────────────────┴────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 8.2 Vue Component Struktur

```
packages/client/src/
├── components/
│   └── ai/
│       ├── AiChatWidget.vue        # Floating Button + Panel Container
│       ├── AiChatPanel.vue         # Das Chat-Fenster selbst
│       ├── AiMessage.vue           # Einzelne Nachricht (User/AI)
│       ├── AiToolResult.vue        # Tool-Ergebnis Darstellung (Cards, Listen)
│       ├── AiTypingIndicator.vue   # Drei pulsierende Punkte
│       └── AiQuickActions.vue      # Schnell-Buttons ("Was läuft?", "Empfehlung")
├── stores/
│   └── ai.store.ts                 # Pinia Store für Chat-State
└── composables/
    └── useAi.ts                    # Socket.io Connection + Streaming
```

### 8.3 Streaming via Socket.io

```typescript
// packages/server/src/ai/stream.ts
// Streaming-Antworten Token für Token ans Frontend

socket.on('ai:message', async (data: { message: string; sessionId: string }) => {
  const { message, sessionId } = data;

  // Context aufbauen
  const systemPrompt = await buildSystemPrompt(userId);
  const history = await getSessionHistory(sessionId);
  const ragContext = await getRelevantKnowledge(message);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...ragContext.map(k => ({ role: 'system', content: `Kontext: ${k.content}` })),
    ...history,
    { role: 'user', content: message }
  ];

  // Streaming Response
  const stream = await ollama.chat({
    model: env.OLLAMA_CHAT_MODEL,
    messages,
    tools: nexarrTools,
    stream: true,
    options: { num_ctx: 65536 }
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    if (chunk.message.content) {
      fullResponse += chunk.message.content;
      socket.emit('ai:token', {
        sessionId,
        token: chunk.message.content,
        done: chunk.done
      });
    }

    // Tool Call Detection
    if (chunk.message.tool_calls?.length) {
      socket.emit('ai:tool_call', {
        sessionId,
        tools: chunk.message.tool_calls
      });
      // Tool ausführen und Ergebnis zurücksenden...
    }
  }

  // Post-Processing (async, non-blocking)
  processMemoryBackground(userId, sessionId, message, fullResponse);
});
```

### 8.4 Quick Actions & Kontextuelle Vorschläge

Der Chat zeigt intelligente Schnellaktionen basierend auf der aktuellen View:

| Aktuelle View | Quick Actions |
|---------------|---------------|
| Dashboard | "Was gibt's Neues?", "Empfiehl mir was" |
| MoviesView | "Was fehlt noch?", "Neueste Zugänge" |
| DownloadsView | "Status-Zusammenfassung", "Was dauert am längsten?" |
| CalendarView | "Was kommt diese Woche?", "Highlights des Monats" |
| StreamsView | "Wer schaut gerade?", "Beliebtest diese Woche" |
| DiscoverView | "Trending für mich", "Was ist ähnlich wie [letzter Film]?" |

---

## 9. Experimentelle Features

### 9.1 Proaktive Benachrichtigungen (nexarr AI meldet sich)

**Idee:** nexarr AI beobachtet im Hintergrund und benachrichtigt den User proaktiv:

- "Hey, Deadpool & Wolverine ist fertig! Soll ich Plex starten?" (Download abgeschlossen)
- "Neue Staffel von The Bear startet morgen – schon in deiner Bibliothek!" (Kalender)
- "3 Downloads laufen seit über 4 Stunden. Soll ich die Indexer prüfen?" (Probleme)
- "Du hast 12 ungesehene Filme die du letzten Monat hinzugefügt hast – Lust auf einen?" (Engagement)

**Technisch:** Background-Worker der periodisch System-State prüft und via Gotify + Socket.io benachrichtigt.

### 9.2 Vision: Poster/Screenshot Analyse

Dank 48 GB VRAM können wir `gemma3:27b` parallel laden – **Vision ist kein "optional" mehr:**

- User schickt Screenshot eines Films → AI erkennt den Film und bietet an, ihn hinzuzufügen
- Poster-basierte Empfehlungen: "Zeig mir Filme die so aussehen wie dieser Poster-Stil"
- UI-Feedback: User schickt Screenshot eines nexarr-Problems → AI hilft bei Troubleshooting
- **Telegram:** User schickt Foto von einem Filmplakat → nexarr AI erkennt und fügt hinzu

### 9.3 Smart Playlists / Auto-Sammlungen

nexarr AI kann automatisch thematische Sammlungen erstellen:

```
User: "Erstell mir eine Sammlung für einen Sci-Fi Filmabend"
AI:   Analysiert Bibliothek → findet ungesehene Sci-Fi Filme →
      sortiert nach Rating → erstellt 3er-Liste mit Laufzeit-Info:

      🎬 Sci-Fi Filmabend (Gesamtdauer: ~6h 20min)
      1. Dune: Part Two (2024) ★ 8.5 – 2h 46min – 4K Dolby Vision
      2. Everything Everywhere All at Once (2022) ★ 8.0 – 2h 19min – 1080p
      3. Arrival (2016) ★ 7.9 – 1h 56min – 4K HDR10
```

### 9.4 Stimmungs-basierte Empfehlungen

```
User: "Ich hab einen anstrengenden Tag, brauch was Leichtes"
AI:   Filtert nach: Comedy/Feel-Good, Runtime <2h, Rating >7.0
      Berücksichtigt User-Memories: "Mag Edgar Wright, hasst Adam Sandler"
      → Empfiehlt aus der Bibliothek
```

### 9.5 Multi-User Awareness

nexarr AI kann verschiedene Household-Mitglieder unterscheiden (via Plex/Tautulli User-Mapping):

- "Was schaut gerade Sarah?" (Tautulli-Stream Zuordnung)
- Getrennte Memory-Profile pro User
- "Empfiehl was für einen Familienabend" (berücksichtigt alle Profile)

---

## 10. Messenger-Integration (Phase 2 – Zukunft)

### 10.1 Architektur: Messenger Gateway

```
                    ┌─────────────────────────┐
Telegram ──────────►│                         │
                    │   Messenger Gateway      │
Signal ────────────►│   (Node.js Service)      │──────► nexarr AI
                    │                         │        Agent Engine
Discord ───────────►│   • Message Normalisierung│
                    │   • Auth & Rate Limiting  │
WhatsApp ──────────►│   • Media Forwarding      │
                    │   • Response Formatting    │
                    └─────────────────────────┘
```

### 10.2 Messenger-Vergleich

| Messenger | Bot API | Aufwand | Eignung | Empfehlung |
|-----------|---------|---------|---------|------------|
| **Telegram** | ✅ Exzellent (BotFather, kostenlos, kein Business-Account) | Niedrig | ⭐⭐⭐⭐⭐ | **#1 Empfehlung** – beste API, Inline-Buttons, Markdown, Bilder |
| **Discord** | ✅ Gut (Discord.js, Slash-Commands) | Niedrig | ⭐⭐⭐⭐ | Gut wenn Community/Server existiert |
| **Signal** | ⚠️ Eingeschränkt (signal-cli, keine offizielle Bot-API) | Hoch | ⭐⭐⭐ | Möglich via `signal-cli` + REST-Wrapper, braucht separate Nummer |
| **WhatsApp** | ⚠️ Business API (kostenpflichtig, Meta Cloud API) | Mittel | ⭐⭐ | Hoher Setup-Aufwand, Kosten, weniger Self-hosted-freundlich |
| **Matrix** | ✅ Gut (matrix-js-sdk, self-hosted) | Mittel | ⭐⭐⭐⭐ | Bridge zu Signal/Telegram/Discord möglich, maximale Kontrolle |

### 10.3 Telegram-Bot Implementierung (Referenz)

```typescript
// packages/server/src/messenger/telegram.gateway.ts
import { Telegraf } from 'telegraf';

const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

bot.on('text', async (ctx) => {
  const userId = await resolveUser(ctx.from.id); // Telegram-User → nexarr-User
  const sessionId = `telegram:${ctx.from.id}`;

  // An AI Agent weiterleiten (selbe Engine wie Web-Chat)
  const response = await agentLoop(
    await buildMessages(userId, sessionId, ctx.message.text),
    nexarrTools
  );

  // Markdown-formatierte Antwort
  await ctx.replyWithMarkdownV2(escapeMarkdown(response));
});

// Inline-Buttons für Tool-Bestätigungen
bot.action(/^confirm:(.+)$/, async (ctx) => {
  const actionId = ctx.match[1];
  await executeConfirmedAction(actionId);
  await ctx.answerCbQuery('Erledigt!');
});
```

### 10.4 Signal-Integration (via signal-cli)

Signal hat keine offizielle Bot-API. Ansatz:

1. **signal-cli** als Docker-Container (REST-API Mode)
2. Separate Signal-Nummer registrieren (z.B. via VoIP)
3. REST-Wrapper empfängt Nachrichten → leitet an nexarr AI Agent
4. Antworten werden via signal-cli REST zurückgeschickt

> **Aufwand:** Deutlich höher als Telegram. Empfehlung: Telegram zuerst, Signal als optionaler zweiter Kanal.

### 10.5 Unified Message Format

```typescript
// packages/shared/src/types/messenger.ts
interface MessengerMessage {
  platform: 'web' | 'telegram' | 'signal' | 'discord';
  userId: string;          // Platform-spezifische User-ID
  nexarrUserId?: number;   // Gemappter nexarr-User
  sessionId: string;       // Platform + User-ID
  text: string;
  attachments?: Array<{
    type: 'image' | 'voice' | 'document';
    url: string;
    mimeType: string;
  }>;
  replyTo?: string;        // Message-ID bei Antworten
  timestamp: string;
}
```

---

## 11. Implementierungs-Reihenfolge

### Phase AI-1: Fundament (Backend + Ollama-Anbindung) ✅
- [x] Ollama Docker-Container auf Unraid aufsetzen (GPU #1 Passthrough)
- [x] `ollama pull qwen3:30b && ollama pull nomic-embed-text`
- [x] `.env` um `OLLAMA_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL`, `OLLAMA_VISION_MODEL`, `OLLAMA_CTX_SIZE` erweitern
- [x] `ai.service.ts` – Ollama HTTP Client (chat, chatStream, getModels, getRunningModels, getStatus, stripThinkingTags)
- [x] `ai.routes.ts` – REST-Endpoints (GET /api/ai/status, GET /api/ai/models, POST /api/ai/chat)
- [x] `003_ai.sql` – SQLite-Tabellen `ai_conversations`, `ai_memories`, `ai_knowledge` mit Embedding-BLOBs
- [x] `personality.ts` – System-Prompt mit nexarr-Persönlichkeit + `/no_think` für qwen3
- [x] `conversations.ts` – Conversation CRUD
- [x] `stream.ts` – Socket.io AI Streaming Handler (Tool-Loop + Token-Stream)

### Phase AI-2: Tool-System ✅
- [x] `tools.ts` – 21 Tools in 10 Kategorien als JSON-Schema (Ollama-native Format)
- [x] `executor.ts` – Dispatcher der Tool-Calls an bestehende Services (kompakte Daten für LLM)
- [x] `agent.ts` – Agentic Loop (max 5 Iterationen, Temperature 0.3)
- [x] Tool-Ergebnis Formatierung für Chat-Antworten
- [x] Destructive-Tools Set (movies_add, series_add, downloads_pause, overseerr_approve/decline)

### Phase AI-3: Memory-System ✅
- [x] `vectors.ts` – Embedding via Ollama /api/embed (embed, embedBatch, Float32Array↔BLOB)
- [x] Cosine-Similarity Suche in SQLite (semanticSearch mit minScore-Threshold)
- [x] `summary.ts` – Rolling Conversation Summary (alle 10 Messages)
- [x] `memory.ts` – LLM-basierte Memory-Extraktion (ADD/UPDATE/NOOP, max 3 pro Analyse)
- [x] Context Assembly: personality.ts async mit Memories + Summary in System-Prompt

### Phase AI-4: RAG & Knowledge Base ✅
- [x] `knowledge-seed.ts` – 3 statische Dokumente (nexarr Help, Qualitäts-Guide, Troubleshooting)
- [x] `chunking.ts` – chunkText (Overlap 200 Zeichen) + chunkMarkdown (Section-basiert)
- [x] `knowledge.ts` – Ingestion-Pipeline (chunk → embedBatch → SQLite) + searchKnowledge
- [x] `library-analysis.ts` – Bibliotheks-Analyse (Genre-Profil, Dekaden, Qualität, Top-Rated) + LLM-Geschmacksprofil
- [x] RAG-Kontext via searchKnowledge() in personality.ts {SYSTEM_CONTEXT}
- [x] API: GET /api/ai/knowledge/stats, POST /api/ai/knowledge/seed, GET /api/ai/library/stats, POST /api/ai/library/analyze
- [x] seedKnowledge() beim Serverstart (17 Chunks mit Embeddings)

### Phase AI-5: Frontend – Chat Widget ✅
- [x] `AiChatWidget.vue` – Floating Button (Pulse bei Streaming) + Panel mit Slide-Transition
- [x] `AiChatPanel.vue` – Message-Bubbles (User/Assistant), Typing-Indicator, Tool-Call Badges (Running/Done/Error), Quick Actions, Error-Display, Auto-Scroll
- [x] `ai.store.ts` – Pinia Store mit Socket.io Streaming (ai:token, ai:error, ai:tool_call)
- [x] `AiToolCallPayload` + `ai:tool_call` Event in shared socket types + stream.ts emit
- [x] In App.vue integriert (nur bei isLoggedIn sichtbar)
- [ ] Tool-Ergebnis Visualisierung (Cards, Poster, Listen) – offen
- [ ] Chat-History Persistenz (LocalStorage + Backend) – offen

### Phase AI-6: Polish & Experimentell (offen)
- [ ] Proaktive Benachrichtigungen (Background-Worker)
- [ ] Smart Empfehlungen (Stimmung, Filmabend)
- [ ] Bibliotheks-Profile als Scheduled Job (täglich)
- [ ] Vision-Support mit `gemma3:27b` (Poster/Screenshot-Erkennung)
- [ ] Multi-User Memory

### Phase AI-7: Messenger Gateway (Zukunft)
- [ ] Unified Message Format
- [ ] Telegram Bot Integration
- [ ] Signal Integration (signal-cli)
- [ ] User-Mapping (Messenger → nexarr)

---

## 12. Dateistruktur (Ist-Stand nach Phase AI-5)

```
packages/server/src/
├── ai/
│   ├── ai.service.ts         # Ollama HTTP Client (chat, chatStream, embed, models)
│   ├── agent.ts              # Agentic Loop (REST-Variante, max 5 Iterationen)
│   ├── personality.ts        # System-Prompt Builder (async: Memories + RAG + Summary)
│   ├── stream.ts             # Socket.io Streaming Handler (Tool-Loop + Token-Stream)
│   ├── tools.ts              # 21 Tool-Definitionen (JSON-Schema, 10 Kategorien)
│   ├── executor.ts           # Tool-Dispatcher (executeToolCall → Services)
│   ├── vectors.ts            # Embedding + Cosine Similarity + semanticSearch
│   ├── memory.ts             # Memory Extraction + Retrieval (LLM-basiert)
│   ├── summary.ts            # Rolling Conversation Summary
│   ├── conversations.ts      # SQLite Conversation CRUD
│   ├── chunking.ts           # Text/Markdown Chunking (Overlap)
│   ├── knowledge.ts          # Knowledge Ingestion + semantische Query
│   ├── knowledge-seed.ts     # Statische Knowledge Seeds (3 Dokumente)
│   └── library-analysis.ts   # Bibliotheks-Statistiken + LLM-Geschmacksprofil
├── routes/
│   └── ai.routes.ts          # REST Endpoints (status, models, chat, knowledge, library)
├── db/migrations/
│   └── 003_ai.sql            # ai_conversations, ai_memories, ai_knowledge
└── messenger/                # [Phase AI-7 – Zukunft]

packages/client/src/
├── components/ai/
│   ├── AiChatWidget.vue      # Floating Button + Panel (Slide-Transition)
│   └── AiChatPanel.vue       # Chat-Interface (Bubbles, Streaming, Quick Actions, Tool-Calls)
├── stores/
│   └── ai.store.ts           # Pinia: Socket.io Streaming, Messages, Tool-Call Tracking
└── env.d.ts                  # Vue SFC Typ-Deklaration

packages/shared/src/types/
└── socket.ts                 # AiTokenPayload, AiErrorPayload, AiMessagePayload, AiToolCallPayload
```

---

## 13. Sicherheit & Grenzen

### 13.1 Guardrails
- **Destruktive Aktionen** (Film löschen, Download abbrechen) → immer User-Bestätigung
- **Rate Limiting** → Max 2 parallele Requests an Ollama (OLLAMA_NUM_PARALLEL=2)
- **Token-Budget** → Max 64K Kontext pro Request, ältere Messages werden zusammengefasst
- **Tool-Whitelist** → Nur registrierte Tools können aufgerufen werden
- **Keine Root/System-Zugriffe** → AI kann nur nexarr-APIs aufrufen, nicht das OS

### 13.2 Bekannte Limitierungen
- **Ollama Tool Calling Qualität** variiert stark je nach Modell. Qwen3 30B ist aktuell am zuverlässigsten für Tool Calling.
- **Latenz:** Mit RTX 6000 Ada + qwen3:30b → erwartete ~1-3 Sekunden pro Antwort, exzellent für Chat.
- **Halluzinationen:** RAG + strenger System-Prompt minimiert, aber eliminiert nicht.
- **Deutsch:** Qwen3 hat starkes Multilingual – deutsch sollte sehr gut funktionieren.
- **Kontext-Drift:** Bei sehr langen Gesprächen (>50 Messages) kann der Kontext verwässern → Summary-basiertes Trimming.
- **VRAM-Sharing:** Bei gleichzeitiger Chat + Vision Nutzung (~38 GB) bleibt ~10 GB für KV-Cache. Bei extrem langen Kontexten (>64K) kann das eng werden → Monitoring einbauen.

---

## 14. Konfiguration (.env Erweiterung)

```bash
# === nexarr AI ===
OLLAMA_URL=http://192.168.188.42:11434   # Ollama auf ODIN (Docker mit GPU #1)
OLLAMA_CHAT_MODEL=qwen3:30b              # 30B – bestes Tool Calling, passt in 48 GB
OLLAMA_EMBED_MODEL=nomic-embed-text      # Embedding-Modell für RAG (768-dim)
OLLAMA_VISION_MODEL=gemma3:27b           # Vision/Multimodal – Poster/Screenshot-Analyse
OLLAMA_NUM_CTX=65536                     # Kontext-Fenster (64K Token, Hardware packt das)
AI_ENABLED=true                          # AI komplett an/aus
AI_MAX_TOOL_ITERATIONS=5                 # Max Tool-Call Schleifendurchläufe
AI_MEMORY_ENABLED=true                   # Memory-System an/aus
AI_PROACTIVE_NOTIFICATIONS=false         # Proaktive Benachrichtigungen (experimentell)

# === Messenger (Phase 2) ===
# TELEGRAM_BOT_TOKEN=                    # Telegram Bot Token von BotFather
# SIGNAL_CLI_URL=                        # signal-cli REST API URL
# DISCORD_BOT_TOKEN=                     # Discord Bot Token
```
