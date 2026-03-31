# nexarr v2 – Architecture & Implementation Plan
> Stand: März 2026 | Architect: Claude | Status: Planning

---

## 1. Warum v2?

v1 hat bewiesen dass das Konzept funktioniert – 17 Seiten, 20+ Integrationen, KI-Chat, PWA.
Die technische Schuld ist jedoch real und wächst mit jeder Phase:

| Problem v1 | Konsequenz | v2-Lösung |
|---|---|---|
| `index.js` 165KB Monolith | Jeder Edit riskiert den Server | Modulare Routes + Services |
| Kein `?.` / kein `{...}` | Workarounds überall, unlesbarer Code | Node 18+, TypeScript |
| Cache erst in Phase 15 | 14 Phasen technische Schuld | Cache Backbone = Phase 0 |
| Auth erst in Phase 13 | Alles muss nachgerüstet werden | Auth = Phase 0 |
| 17× HTML Copy-Paste | Bugs in jeder Datei einzeln fixen | Vue SPA, shared Components |
| SSE instabil | Reconnect-Logik in jedem Client | Socket.io, auto-reconnect |
| SQLite fehlt | Logs/History in Memory, verloren nach Restart | SQLite für dynamische Daten |
| Kein Type-Safety | Fehler zur Laufzeit statt Build-Zeit | TypeScript End-to-End |

---

## 2. Finaler Tech Stack

### Backend
| Entscheidung | Technologie | Begründung |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Stabiler als 18, Optional Chaining, alle modernen Features |
| Language | **TypeScript 5** | Type-Safety, bessere IDE-Unterstützung, fängt Bugs früh |
| Framework | **Express 5** | Bewährt, größtes Ökosystem, perfekte Claude-Kenntnis |
| Real-time | **Socket.io 4** | Auto-Reconnect, Room-System, Fallback auf Polling |
| Config | **.env via Zod** | Validation beim Start – fehlt `RADARR_URL`? → klarer Fehler |
| Datenbank | **SQLite via better-sqlite3** | File-based, zero infrastructure, Backup = 1 Datei kopieren |
| Auth | **Passport.js + bcrypt** | Single-User jetzt, Multi-User-ready für später |
| HTTP-Client | **Axios** | Wie v1, bekannte API |
| Ausführung | **tsx** | TypeScript direkt ausführen, kein manueller Build-Step im Dev |

### Frontend
| Entscheidung | Technologie | Begründung |
|---|---|---|
| Framework | **Vue 3** (Composition API) | Ideal für Dashboards, SFC-Komponenten, beste DX |
| Build-Tool | **Vite 5** | Sub-Sekunden HMR, nativer ESM, schnellster Dev-Server |
| Routing | **Vue Router 4** | SPA Navigation, keine Reload zwischen Seiten |
| State | **Pinia** | Offizieller Vue State Manager, einfacher als Vuex |
| Real-time | **Socket.io Client** | Korrespondiert zum Backend |
| Styling | **CSS (Design System v2)** | styles.css portiert, CSS Variables, kein CSS-Framework |
| Icons | **SVG inline via Components** | Wie v1, nur als Vue Component |

### Infrastructure
| Entscheidung | Technologie |
|---|---|
| Containerisierung | Docker (Multi-Stage Build) |
| Container Registry | GitHub Container Registry (`ghcr.io`) |
| CI/CD | GitHub Actions |
| Deployment | Portainer (Portainer Stack oder Container) |
| VCS | Gitea (primär) + GitHub (public, CI/CD) |
| Monorepo | npm Workspaces |

---

## 3. Projekt-Struktur

```
nexarr-v2/
│
├── packages/
│   ├── server/                          # TypeScript Backend
│   │   ├── src/
│   │   │   ├── server.ts               # Entry Point (Port binden, Socket.io init)
│   │   │   ├── app.ts                  # Express App Setup (Middleware, Routes)
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── env.ts              # Zod-Schema für .env Validation
│   │   │   │   └── constants.ts        # TTLs, Limits, App-Farben
│   │   │   │
│   │   │   ├── db/
│   │   │   │   ├── index.ts            # SQLite Connection + Migration Runner
│   │   │   │   └── migrations/
│   │   │   │       ├── 001_init.sql    # Sessions, Users, Settings
│   │   │   │       ├── 002_logs.sql    # Notification Logs, Activity
│   │   │   │       └── 003_cache.sql   # Persistenter Cache (optional)
│   │   │   │
│   │   │   ├── cache/
│   │   │   │   ├── cache.ts            # Cache Backbone v2 (portiert + verbessert)
│   │   │   │   └── waves.ts            # Startup Wave Definitions
│   │   │   │
│   │   │   ├── socket/
│   │   │   │   ├── index.ts            # Socket.io Setup + Auth Middleware
│   │   │   │   ├── queue.handler.ts    # Download Queue Events
│   │   │   │   ├── activity.handler.ts # Activity Bar Events
│   │   │   │   └── notifications.handler.ts
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts             # requireAuth, requireRole
│   │   │   │   ├── errorHandler.ts     # Zentraler Error Handler
│   │   │   │   └── rateLimiter.ts      # Per-Route Rate Limits
│   │   │   │
│   │   │   ├── routes/                 # Je eine Datei pro Integration
│   │   │   │   ├── auth.routes.ts      # Login, Logout, Session
│   │   │   │   ├── radarr.routes.ts
│   │   │   │   ├── sonarr.routes.ts
│   │   │   │   ├── lidarr.routes.ts
│   │   │   │   ├── prowlarr.routes.ts
│   │   │   │   ├── sabnzbd.routes.ts
│   │   │   │   ├── tautulli.routes.ts
│   │   │   │   ├── overseerr.routes.ts
│   │   │   │   ├── bazarr.routes.ts
│   │   │   │   ├── gotify.routes.ts
│   │   │   │   ├── tmdb.routes.ts
│   │   │   │   ├── ollama.routes.ts
│   │   │   │   ├── abs.routes.ts       # Audiobookshelf
│   │   │   │   ├── settings.routes.ts
│   │   │   │   ├── system.routes.ts    # Cache Stats, Logs, Restart
│   │   │   │   └── proxy.routes.ts     # Image Proxy
│   │   │   │
│   │   │   ├── services/               # Business Logic, reine Funktionen
│   │   │   │   ├── radarr.service.ts   # API-Wrapper mit Types
│   │   │   │   ├── sonarr.service.ts
│   │   │   │   ├── ...
│   │   │   │   ├── notifications.service.ts  # Kanal-Dispatch-Logic
│   │   │   │   └── ai.service.ts             # Ollama + Tool-Handling
│   │   │   │
│   │   │   └── types/                  # Server-seitige Types
│   │   │       ├── express.d.ts        # req.user Augmentation
│   │   │       └── integrations.ts     # Integration-Config Types
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   ├── client/                          # Vue 3 + Vite Frontend
│   │   ├── src/
│   │   │   ├── main.ts                 # Vue App Init
│   │   │   ├── App.vue                 # Root Component (Sidebar + Router-View)
│   │   │   │
│   │   │   ├── router/
│   │   │   │   └── index.ts            # Vue Router (alle Routen)
│   │   │   │
│   │   │   ├── stores/                 # Pinia Stores
│   │   │   │   ├── auth.store.ts       # User Session
│   │   │   │   ├── queue.store.ts      # Download Queue (Socket.io populated)
│   │   │   │   ├── activity.store.ts   # Activity Bar
│   │   │   │   ├── settings.store.ts   # App Settings
│   │   │   │   └── notifications.store.ts
│   │   │   │
│   │   │   ├── composables/            # Shared Vue Composables
│   │   │   │   ├── useApi.ts           # fetch wrapper mit Error Handling
│   │   │   │   ├── useSocket.ts        # Socket.io Hook
│   │   │   │   ├── useToast.ts         # Toast Notifications
│   │   │   │   ├── useModal.ts         # Modal System
│   │   │   │   ├── useImageProxy.ts    # Image Proxy Helper
│   │   │   │   └── useInfiniteScroll.ts
│   │   │   │
│   │   │   ├── components/             # Shared UI Components
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Sidebar.vue
│   │   │   │   │   ├── SidebarItem.vue
│   │   │   │   │   └── ActivityBar.vue
│   │   │   │   ├── ui/
│   │   │   │   │   ├── PosterCard.vue  # Universelle Poster-Karte (Film/Serie/Musik)
│   │   │   │   │   ├── HeroSection.vue # Fanart Hero für Detail-Seiten
│   │   │   │   │   ├── Modal.vue
│   │   │   │   │   ├── Toast.vue
│   │   │   │   │   ├── Badge.vue
│   │   │   │   │   ├── LoadingGrid.vue # Skeleton Loader
│   │   │   │   │   ├── EmptyState.vue
│   │   │   │   │   └── DataTable.vue
│   │   │   │   ├── media/
│   │   │   │   │   ├── MediaGrid.vue   # Grid mit Filter/Sort/Search
│   │   │   │   │   ├── AlphabetNav.vue
│   │   │   │   │   ├── QualityBadge.vue
│   │   │   │   │   └── SubtitleWidget.vue
│   │   │   │   └── ai/
│   │   │   │       ├── AiChat.vue      # Floating AI Panel
│   │   │   │       └── AiMessage.vue
│   │   │   │
│   │   │   ├── views/                  # Page-Level Vue Components
│   │   │   │   ├── LoginView.vue
│   │   │   │   ├── DashboardView.vue
│   │   │   │   ├── MoviesView.vue
│   │   │   │   ├── MovieDetailView.vue
│   │   │   │   ├── SeriesView.vue
│   │   │   │   ├── SeriesDetailView.vue
│   │   │   │   ├── MusicView.vue
│   │   │   │   ├── ArtistDetailView.vue
│   │   │   │   ├── DownloadsView.vue
│   │   │   │   ├── CalendarView.vue
│   │   │   │   ├── SearchView.vue
│   │   │   │   ├── StatsView.vue
│   │   │   │   ├── StreamsView.vue
│   │   │   │   ├── IndexerView.vue
│   │   │   │   ├── DiscoverView.vue
│   │   │   │   ├── UpgradesView.vue
│   │   │   │   ├── RequestsView.vue
│   │   │   │   ├── NotificationsView.vue
│   │   │   │   ├── AbsView.vue
│   │   │   │   └── SettingsView.vue
│   │   │   │
│   │   │   ├── assets/
│   │   │   │   ├── styles/
│   │   │   │   │   ├── main.css        # CSS Variables (Design System)
│   │   │   │   │   ├── components.css  # Shared Component Styles
│   │   │   │   │   └── transitions.css # Page Transitions
│   │   │   │   └── icons/             # SVG Icons als Vue Components
│   │   │   │       └── index.ts        # Re-exports alle Icons
│   │   │   │
│   │   │   └── types/                  # Frontend Types
│   │   │       └── index.ts
│   │   │
│   │   ├── public/
│   │   │   ├── logo.png
│   │   │   ├── favicon.ico
│   │   │   └── manifest.json
│   │   │
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared/                          # Gemeinsame Types (Server + Client)
│       ├── src/
│       │   ├── types/
│       │   │   ├── api.ts              # API Request/Response Types
│       │   │   ├── integrations.ts     # Radarr, Sonarr etc. Entity Types
│   │   │   │   ├── socket.ts           # Socket.io Event Types
│   │   │   │   └── auth.ts             # User, Session Types
│   │   │   └── index.ts
│   │   └── package.json
│
├── docker/
│   ├── Dockerfile                       # Multi-Stage: Build + Production
│   ├── docker-compose.yml               # Production Stack
│   └── docker-compose.dev.yml           # Dev mit Volume-Mounts + HMR
│
├── .github/
│   └── workflows/
│       ├── build.yml                    # Build + Push zu ghcr.io
│       └── lint.yml                     # TypeScript Check + ESLint
│
├── .env.example                         # Dokumentierte Env-Vars
├── package.json                         # Root Workspace
├── tsconfig.base.json                   # Shared TS Config
└── V2_PLAN.md                          # Dieses Dokument
```

---

## 4. Datenbank-Schema (SQLite)

Nur dynamische Daten in SQLite. Statische Config bleibt in `.env`.

```sql
-- Migration 001: Core
CREATE TABLE users (
  id          INTEGER PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,          -- bcrypt hash
  role        TEXT DEFAULT 'admin',   -- 'admin' | 'viewer' | 'requester'
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  sid         TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  expired_at  INTEGER NOT NULL
);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER DEFAULT (unixepoch())
);

-- Migration 002: Logs & Activity
CREATE TABLE notification_log (
  id          INTEGER PRIMARY KEY,
  channel     TEXT NOT NULL,          -- 'gotify' | 'ntfy' | 'browser'
  event       TEXT NOT NULL,          -- 'download_complete' | 'import' etc.
  title       TEXT NOT NULL,
  body        TEXT,
  status      TEXT NOT NULL,          -- 'sent' | 'failed'
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE TABLE activity_log (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL,          -- 'download' | 'import' | 'search' etc.
  app         TEXT NOT NULL,          -- 'radarr' | 'sonarr' etc.
  title       TEXT,
  detail      TEXT,
  created_at  INTEGER DEFAULT (unixepoch())
);
```

---

## 5. Auth-Konzept

**Jetzt:** Single-User, ein Passwort (Admin), bcrypt + express-session.

**Architektonisch vorbereitet für:** Multi-User via `users` Table und `role`-Feld.
Wenn Multi-User gebraucht wird → `users` Table schon da, nur UI-Flow ergänzen.

```typescript
// middleware/auth.ts
export const requireAuth = (req, res, next) => {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// Vorbereitet aber nicht exposed:
export const requireRole = (role: 'admin' | 'viewer' | 'requester') =>
  (req, res, next) => {
    if (req.session.userRole === role || req.session.userRole === 'admin')
      return next();
    res.status(403).json({ error: 'Forbidden' });
  };
```

Auth-State im Frontend via Pinia `auth.store.ts` – alle API-Calls gehen durch `useApi()` composable das automatisch 401 abfängt und zur Login-Seite redirectet.

---

## 6. Socket.io Event-Architektur

Klares Event-Naming-Schema: `namespace:action` oder `namespace:entity:action`

```typescript
// Shared Types (packages/shared/src/types/socket.ts)
export interface ServerToClientEvents {
  'queue:update':       (data: QueueState) => void;
  'activity:update':    (data: ActivityState) => void;
  'download:complete':  (data: DownloadEvent) => void;
  'notification:new':   (data: Notification) => void;
  'cache:invalidated':  (key: string) => void;
  'system:status':      (data: SystemStatus) => void;
}

export interface ClientToServerEvents {
  'queue:subscribe':    () => void;
  'queue:unsubscribe':  () => void;
}
```

Vue Composable macht den Rest unsichtbar:

```typescript
// composables/useSocket.ts
export function useQueue() {
  const store = useQueueStore();
  const { socket } = useSocket();

  onMounted(() => socket.emit('queue:subscribe'));
  onUnmounted(() => socket.emit('queue:unsubscribe'));

  socket.on('queue:update', (data) => store.update(data));

  return store;
}
```

---

## 7. Cache Backbone v2

Cache.js aus v1 wird portiert und erweitert. Kernlogik ist bereits solide.

**Verbesserungen gegenüber v1:**
- TypeScript-Interfaces für alle Cache-Entries
- Persistenz-Option: häufig gebrauchte Daten in SQLite (überlebt Server-Restart)
- Socket.io Push statt SSE bei Cache-Updates
- Besseres Logging: welche Wave wie lange, welche Keys stale

```typescript
// Beispiel: Typisierter Cache-Aufruf
const movies = await C.fetch<RadarrMovie[]>(
  'radarr_movies',
  () => radarrService.getMovies(),
  C.TTL.COLLECTION
);
```

---

## 8. .env Validation mit Zod

Startup-Fehler sofort erkennbar statt mysteriöse Runtime-Crashes.

```typescript
// config/env.ts
const envSchema = z.object({
  PORT:              z.string().default('3000'),
  NODE_ENV:          z.enum(['development', 'production']).default('development'),
  SESSION_SECRET:    z.string().min(32),
  DB_PATH:           z.string().default('./data/nexarr.db'),

  // Alle Integrationen optional
  RADARR_URL:        z.string().url().optional(),
  RADARR_API_KEY:    z.string().optional(),
  SONARR_URL:        z.string().url().optional(),
  // ...

  AUTH_PASSWORD_HASH: z.string().optional(), // leer = Auth disabled
});

export const env = envSchema.parse(process.env);
// Schlägt fehl wenn SESSION_SECRET fehlt oder PORT kein String ist
// Gibt klare Fehlermeldung was genau fehlt
```

---

## 9. Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/
RUN npm ci --workspace=packages/shared \
           --workspace=packages/server \
           --workspace=packages/client

COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

COPY packages/server ./packages/server
RUN npm run build --workspace=packages/server

COPY packages/client ./packages/client
RUN npm run build --workspace=packages/client

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/server/dist ./server
COPY --from=builder /app/packages/client/dist ./public
COPY --from=builder /app/packages/server/node_modules ./node_modules

VOLUME ["/app/data"]        # SQLite DB
VOLUME ["/app/config"]      # .env

EXPOSE 3000
CMD ["node", "server/server.js"]
```

---

## 10. GitHub Actions CI/CD

```yaml
# .github/workflows/build.yml
name: Build & Push

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build & Push to GHCR
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ghcr.io/sebastianklingk/nexarr:latest
            ghcr.io/sebastianklingk/nexarr:${{ github.sha }}
```

Portainer: "Update the Stack" oder Webhook-Trigger → pulled `latest` automatisch.

---

## 11. Migrations-Strategie v1 → v2

### Was 1:1 portiert wird (kein Rewrite)
- `cache.js` → `packages/server/src/cache/cache.ts` (TypeScript-Wrapper)
- `styles.css` → `packages/client/src/assets/styles/main.css`
- `icons.js` → `packages/client/src/assets/icons/` (Vue Components)
- AI-Chat Tool-Definitionen → `services/ai.service.ts`
- Alle API-Proxy-Logik → jeweilige `*.service.ts`

### Was neu strukturiert wird
- `index.js` Routes → aufgeteilt in `routes/*.ts` + `services/*.ts`
- HTML-Seiten → Vue Views + shared Components
- Inline JS in HTML → Vue Composables
- SSE → Socket.io Events

### Was neu geschrieben wird (war in v1 nicht vorhanden)
- Zod Env Validation
- SQLite Schema + Migrations
- TypeScript Interfaces für alle Integrations
- Vue Router Guards (Auth-Check vor geschützten Routen)
- Pinia Stores

---

## 12. Implementierungs-Phasen

### Phase 0 – Fundament (1 Session)
- [ ] Monorepo-Struktur anlegen (`packages/server`, `packages/client`, `packages/shared`)
- [ ] TypeScript Setup in allen drei Packages
- [ ] Zod Env Validation
- [ ] SQLite Setup + Migration Runner
- [ ] Express App mit Auth Middleware (Passport.js + bcrypt)
- [ ] Socket.io Setup (Server + Client)
- [ ] Cache Backbone v2 portiert
- [ ] Dockerfile + docker-compose
- [ ] GitHub Actions Pipeline
- [ ] Login-Seite (Vue)
- [ ] Sidebar + App Shell (Vue)

### Phase 1 – Radarr / Movies (1 Session)
- [ ] `radarr.service.ts` (alle API-Calls typisiert)
- [ ] `radarr.routes.ts`
- [ ] `MoviesView.vue` + `MovieDetailView.vue`
- [ ] `PosterCard.vue` Component (universell für alle Medien)
- [ ] Socket.io: Radarr Queue Events

### Phase 2 – Sonarr + Lidarr (1 Session)
- [ ] `sonarr.service.ts` + `lidarr.service.ts`
- [ ] Entsprechende Routes + Views
- [ ] PosterCard wiederverwendet

### Phase 3 – Dashboard + Real-time (1 Session)
- [ ] `DashboardView.vue` mit allen Widgets
- [ ] Socket.io Activity Bar
- [ ] Queue Store (Pinia) – live durch Socket.io

### Phase 4 – Downloads + Calendar + Search (1 Session)
- [ ] `DownloadsView.vue`, `CalendarView.vue`, `SearchView.vue`
- [ ] SABnzbd + Prowlarr Services

### Phase 5 – Stats + Streams + Discover (1 Session)
- [ ] Tautulli Service + Stats View
- [ ] TMDB Service + Discover View
- [ ] Streams View

### Phase 6 – Settings + alle optionalen Integrationen (1 Session)
- [ ] `SettingsView.vue` (vollständig, alle Sektionen)
- [ ] Overseerr, Bazarr, Gotify, ABS Services + Views

### Phase 7 – AI Chat + Polish (1 Session)
- [ ] `AiChat.vue` mit allen 27+ Tools
- [ ] Notification System (SQLite Log + Socket.io Push)
- [ ] Mobile Responsive Polish
- [ ] PWA Manifest + Service Worker

---

## 13. Coding-Konventionen v2

### TypeScript
```typescript
// ✅ Immer explizite Return Types bei Services
async function getMovies(): Promise<RadarrMovie[]> { ... }

// ✅ Zod für externe API-Responses validieren
const movie = RadarrMovieSchema.parse(response.data);

// ✅ Nie `any` – lieber `unknown` mit Type Guard
function isRadarrMovie(x: unknown): x is RadarrMovie { ... }
```

### Vue 3
```vue
<!-- ✅ Composition API, kein Options API -->
<script setup lang="ts">
const props = defineProps<{ movieId: number }>();
const { data: movie } = useApi(`/api/radarr/movie/${props.movieId}`);
</script>

<!-- ✅ Kein inline onclick – Events via emit -->
<PosterCard @click="openMovie(movie.id)" />
```

### Backend Routes
```typescript
// ✅ Jede Route-Datei: Router + Service getrennt
// routes/radarr.routes.ts – nur HTTP-Handling
router.get('/movies', requireAuth, async (req, res, next) => {
  try {
    const movies = await radarrService.getMovies();
    res.json(movies);
  } catch (err) {
    next(err); // Zentraler Error Handler
  }
});

// services/radarr.service.ts – nur Business Logic
export async function getMovies(): Promise<RadarrMovie[]> {
  return C.fetch('radarr_movies', () =>
    axios.get(`${env.RADARR_URL}/api/v3/movie`, {
      headers: { 'X-Api-Key': env.RADARR_API_KEY }
    }).then(r => r.data),
    C.TTL.COLLECTION
  );
}
```

---

## 14. Dev-Workflow

```bash
# Development starten (beide Packages parallel)
npm run dev

# Das startet:
# - packages/server: tsx watch src/server.ts (Port 3000)
# - packages/client: vite dev (Port 5173, proxied zu :3000)

# TypeScript Check (vor jedem Commit)
npm run typecheck

# Docker Build lokal testen
docker compose -f docker/docker-compose.dev.yml up

# Production Build
npm run build
docker build -f docker/Dockerfile -t nexarr-v2 .
```

---

## 15. Was v2 NICHT ist

- Kein Micro-Services Overhead – ein Backend-Prozess, eine DB, ein Container
- Kein GraphQL – REST ist für diesen Use-Case richtig
- Kein Redux-Complexity – Pinia ist einfach und ausreichend
- Keine Test-Suite erzwingen – kein Jest-Setup der den Start verlangsamt
  (Tests können später ergänzt werden, sind kein Blocker)
- Keine breaking Changes am .env Format – v1 `.env` muss importierbar bleiben

---

## 16. Timeline-Einschätzung

| Phase | Inhalt | Sessions |
|---|---|---|
| 0 | Fundament, Auth, Socket.io, Docker | 1–2 |
| 1–3 | Core Media (Radarr/Sonarr/Lidarr + Dashboard) | 2–3 |
| 4–6 | Alle restlichen Features (v1 Feature-Parität) | 3–4 |
| 7 | AI + Polish + PWA | 1 |
| **Total** | | **~8–10 Sessions** |

v1 hat für denselben Umfang ~20+ Sessions gebraucht.
v2 ist schneller weil: Logik existiert bereits, Struktur ist klar, kein Debugging von Architektur-Entscheidungen.

---

## 17. Startschuss-Checkliste

Wenn wir v2 beginnen, sind das die ersten Commits:

```
commit 1: Monorepo scaffold (package.json workspaces, tsconfig.base.json)
commit 2: packages/shared – API Types, Socket Types
commit 3: packages/server – Express + Auth + DB + Socket.io skeleton
commit 4: packages/client – Vite + Vue Router + Pinia skeleton + Login View
commit 5: Docker + GitHub Actions
commit 6: Cache Backbone v2 portiert
→ Ab hier: Feature-Phasen
```

---

*Dieses Dokument ist der Single Source of Truth für nexarr v2.*
*Jede Architektur-Abweichung wird hier dokumentiert bevor sie implementiert wird.*

---

## 18. UI & Design System (v2)

> **Kernphilosophie:** Inhalte stehen im Vordergrund. Die UI tritt in den Hintergrund.
> nexarr soll sich wie eine native App anfühlen – nicht wie eine Webseite.

---

### 18.1 Das Kernproblem von v1 – und wie v2 es löst

**Problem:** In v1 werden App-Farben (Radarr Orange, Sonarr Blau etc.) direkt als
Textfarben auf `#0a0a0a` Hintergrund verwendet. Das produziert Kontrast-Ratios von 3:1
bis 3.5:1 – der WCAG AA Standard für normalen Text erfordert 4.5:1.

**Symptom:** Section-Titles, Labels, Metadaten sind in bestimmten Farben schwer lesbar.

**v2-Lösung:** Strikte Rollentrennung zwischen Text-Hierarchie und App-Farben:
- Text IMMER aus der semantischen Text-Hierarchie (siehe 18.2)
- App-Farben NUR für Akzente: Borders, Badges, Icons, Left-Bar-Indikatoren
- Niemals App-Farbe als Body-Text oder Section-Heading-Farbe

---

### 18.2 Semantische Text-Hierarchie

```css
/* design-system/tokens.css */
:root {
  /* Hintergrund-Schichten */
  --bg-base:        #0a0a0a;   /* Page Background */
  --bg-surface:     #111111;   /* Cards, Sidebar, Panels */
  --bg-elevated:    #161616;   /* Hover-States, Sub-Cards */
  --bg-overlay:     #1e1e1e;   /* Dropdowns, Tooltips */
  --bg-border:      #2a2a2a;   /* Default Borders */
  --bg-border-hover:#3a3a3a;   /* Hover Borders */

  /* Text-Hierarchie (WCAG AA konform auf #0a0a0a) */
  --text-primary:   #ffffff;   /* 21:1  – Titles, Hero Content */
  --text-secondary: #cccccc;   /* 11.6:1 – Card Titles, Labels */
  --text-tertiary:  #999999;   /* 5.9:1  – Metadata, Descriptions */
  --text-muted:     #666666;   /* 3.6:1  – Section Labels, Hints (nur für dekorativen Text) */
  --text-disabled:  #444444;   /* 2.1:1  – AUSSCHLIESSLICH dekorativ, nie für Information */

  /* nexarr Brand */
  --accent:         #9b0045;
  --accent-hover:   #b8005a;
  --accent-muted:   #9b004522;

  /* App-Farben (nur als Akzente) */
  --radarr:         #F4A54A;
  --sonarr:         #35C5F4;
  --lidarr:         #22C65B;
  --prowlarr:       #FF7F50;
  --sabnzbd:        #F5C518;
  --tautulli:       #E5C06D;
  --overseerr:      #7C4DFF;
  --bazarr:         #A78BFA;
  --gotify:         #0060A8;
  --plex:           #E5A00D;
  --tmdb:           #01B4E4;
  --abs:            #F0A500;

  /* Semantische Status-Farben */
  --status-success: #22c55e;
  --status-warning: #fbbf24;
  --status-error:   #f87171;
  --status-info:    #60a5fa;

  /* Spacing System (8px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Typography Scale */
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 14px;
  --text-md:   16px;
  --text-lg:   18px;
  --text-xl:   24px;
  --text-2xl:  32px;
  --text-hero: 48px;
}
```

---

### 18.3 Navigation – Kontextsensitiv

**Desktop:** Kollabierbare Sidebar (Icons-only + Label, wie Plex)
- Breite expanded: 220px
- Breite collapsed: 56px
- Toggle: Keyboard-Shortcut `[` oder Klick auf Logo
- Zustand wird in localStorage gespeichert
- Aktivem Item: `2px solid var(--accent)` Left-Border + `var(--accent-muted)` Background
- App-Icons: Farbige Dot-Indikatoren in App-Farbe (kein Text in App-Farbe)

**Mobile:** Automatisch Bottom Navigation Bar
- 4 Haupt-Items + "Mehr"-Tab
- Aktives Item: Akzent in `--accent`
- Badge für ungelesene Notifications als Dot auf dem Icon
- Kein Hamburger-Menü – Bottom-Bar ist immer sichtbar

**Breakpoint:** `768px` – unter dieser Breite: Sidebar ausgeblendet, Bottom-Bar eingeblendet

```vue
<!-- Sidebar.vue – automatisches Verhalten -->
<template>
  <aside :class="['sidebar', { collapsed: isCollapsed, mobile: isMobile }]">
    <!-- Desktop: kollabierbare Sidebar -->
    <template v-if="!isMobile">
      <SidebarContent :collapsed="isCollapsed" />
    </template>
  </aside>

  <!-- Mobile: Bottom Bar -->
  <nav v-if="isMobile" class="bottom-nav">
    <BottomNavContent />
  </nav>
</template>
```

---

### 18.4 Poster-Grid – 3 Ansichten mit persistentem Toggle

User-Präferenz wird in SQLite `settings` Tabelle gespeichert (Key: `grid_view_movies`, `grid_view_series`, etc.). Jede Bibliothek hat eine eigene gespeicherte Präferenz.

**Ansicht 1: Poster (Default)**
```
Grid: repeat(auto-fill, minmax(140px, 1fr))
Card: Poster 2:3 Ratio, Hover = sanfte Glow-Border in App-Farbe + Y-Offset
Overlay: subtiles Gradient-Overlay für Titel + Rating, NUR bei Hover (nicht permanent)
Rating: Top-Right Badge, Background rgba(0,0,0,0.75), kein Rating-Icon – nur die Zahl
```

**Ansicht 2: Fokus-Karten**
```
Grid: repeat(auto-fill, minmax(280px, 1fr))
Card: Horizontal – kleines Poster links (60px), Info rechts
Info: Titel (--text-secondary), Jahr + Laufzeit + Genre (--text-tertiary), Badges
Badges: Qualität (grüner Chip), Rating (oranger Chip), Status
```

**Ansicht 3: Liste**
```
Tabelle: Nummer, Thumbnail (28×42), Titel, Jahr, Qualität, Rating
Hover: Row-Highlight auf --bg-elevated
Sortierbar durch Klick auf Column-Header
```

---

### 18.5 Detail-Seiten – Tab-System

Hero bleibt das Herzstück (Fanart, Titel, Metadaten). Darunter **Tab-Navigation** statt Scroll-Chaos:

```
Movie Detail Tabs:
├── Übersicht    – Beschreibung, Besetzung, Ähnliche Filme (TMDB)
├── Dateien      – MediaInfo-Badges, Qualität, Untertitel (Bazarr)
├── Tautulli     – Wiedergabe-History, User-Stats
└── Suche        – Prowlarr-Suche direkt im Kontext

Series Detail Tabs:
├── Staffeln     – Accordion wie v1 (bewährt)
├── Übersicht    – Beschreibung, Cast, Infos
├── Suche        – Pro Episode / Staffel / Serie
└── Untertitel   – Bazarr-Widget
```

**Detail-Hero Verbesserung:**
- Fanart füllt 100% Breite, min-height: 420px
- Schwarzer Gradient von unten (60% Höhe) – Titel ist immer lesbar
- Titel in `--text-primary` (weiß, 32px), nie in App-Farbe
- Links neben Titel: App-Farb-Indicator (`4px border-left: var(--radarr)`)
- Ratings: IMDb, TMDB, RT – klar getrennte Chips, kein Farbmix
- Action-Buttons: einheitliche Ghost-Style mit App-Farbe als Hover-Akzent

---

### 18.6 Animationen & Transitions – "Durchdacht"

Das Ziel ist **Meaningful Motion** – jede Animation hat einen Grund.

```css
/* Page Transitions (Vue Router) */
.page-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.page-enter-from   { opacity: 0; transform: translateY(8px); }
.page-leave-active { transition: opacity 0.15s ease; }
.page-leave-to     { opacity: 0; }

/* Card Hover */
.poster-card {
  transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              border-color 0.2s ease,
              box-shadow 0.2s ease;
}
.poster-card:hover {
  transform: translateY(-4px);
  border-color: var(--app-color-20); /* 20% opacity App-Farbe */
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

/* Sidebar Toggle */
.sidebar { transition: width 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94); }

/* Loading Skeleton */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

**Regeln:**
- Alle Transitions ≤ 300ms (über 300ms fühlt sich langsam an)
- `cubic-bezier(0.25, 0.46, 0.45, 0.94)` als Standard-Easing (iOS-ähnlich)
- Keine Bounce-Effekte – zu verspielt für ein Dashboard
- `prefers-reduced-motion`: alle Animationen deaktivieren

---

### 18.7 App-Farb-Kontext Pattern (neu in v2)

Wenn der User auf einer Radarr-Seite ist, soll das subtil erkennbar sein – ohne aggressiv zu sein.

```css
/* Seiten-Kontext via CSS Custom Property */
/* In MoviesView.vue: */
<div class="page-context" style="--context-color: var(--radarr)">

.page-context .section-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 1em;
  background: var(--context-color);
  margin-right: 10px;
  border-radius: 2px;
  vertical-align: middle;
}

.page-context .active-filter {
  border-color: var(--context-color);
  color: var(--text-secondary); /* NICHT var(--context-color) als Textfarbe */
}

.page-context .cta-button:hover {
  border-color: var(--context-color);
  box-shadow: 0 0 0 1px var(--context-color);
}
```

Das bedeutet: Orange Left-Bars auf Radarr-Seiten, Blaue auf Sonarr-Seiten – aber immer nur als Akzent, nie als Text.

---

### 18.8 Komponenten-Bibliothek (Vue)

Jede Komponente folgt demselben Muster: Props definiert, Emit dokumentiert, Slot für Custom Content.

```
PosterCard.vue       – universell für Film/Serie/Musik, nimmt MediaItem-Type
HeroSection.vue      – Fanart Hero, Props: backdropUrl, title, meta, appColor
AppBadge.vue         – Chip für App-Kontext (Radarr/Sonarr etc.)
StatusBadge.vue      – Chip für Status (Verfügbar/Ausstehend/Fehler)
QualityBadge.vue     – 4K/1080p/720p mit entsprechender Farbe
SkeletonGrid.vue     – Shimmer Loading State für Poster-Grids
EmptyState.vue       – Leerer Zustand mit Icon + Text + optional CTA
DataTable.vue        – Sortierbare Tabelle für Downloads/History
Modal.vue            – Zentrales Modal-System (Teleport zu body)
Toast.vue            – Notification Toasts (Teleport zu body)
ConfirmDialog.vue    – Bestätigungs-Dialoge (löschen etc.)
SearchInput.vue      – Globales Search-Input mit Keyboard-Navigation
AlphabetNav.vue      – A-Z Navigation für große Bibliotheken
ViewToggle.vue       – Poster/Fokus/Liste Toggle mit persistentem State
```

---

### 18.9 Responsive Breakpoints

```css
/* Mobile First */
--bp-sm:  480px;   /* Großes Phone */
--bp-md:  768px;   /* Tablet – Sidebar → Bottom Nav */
--bp-lg: 1024px;   /* Laptop */
--bp-xl: 1280px;   /* Desktop */
--bp-2xl:1536px;   /* Large Desktop */

/* Poster-Grid Columns */
/* < 480px:  2 Spalten */
/* < 768px:  3 Spalten */
/* < 1024px: 4 Spalten */
/* < 1280px: 5 Spalten */
/* >= 1280px: 6-8 Spalten */

grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
/* auto-fill passt sich automatisch an – keine Media Query nötig */
```

---

### 18.10 Was v1 Design-Entscheidungen v2 übernimmt

Diese Dinge waren in v1 gut und bleiben:
- Dark Theme `#0a0a0a` als Base – das ist richtig, kein Change
- Fanart-Hero auf Detail-Seiten – einer der stärksten UI-Momente
- App-Farben als Identifikatoren – Radarr = Orange etc. – das System ist gut
- nexarr `#9b0045` als Brand-Akzent – bleibt absolut
- SVG Icons inline, kein Icon-Font – performanter, kontrollierbarer
- Toast-Notifications für Feedback – bewährt
- Keyboard-Shortcuts System – bleibt, wird ausgebaut

---

### 18.11 Design-Entscheidungen die v2 NICHT macht

- Kein Light Mode – würde das gesamte System verdoppeln, kein Mehrwert
- Kein CSS-Framework (Tailwind etc.) – das Design-System ist custom, ein
  Framework würde Konflikte erzeugen und keine Vorteile bringen
- Keine adaptiven Cover-Art-Farben (Apple Music Stil) – zu komplex für den
  Mehrwert, und Canvas-Analyse ist performance-intensiv
- Kein Masonry-Grid – sieht gut aus, ist aber schwer mit Vue-Virtualisierung
  kombinierbar (nötig für große Bibliotheken mit 2000+ Filmen)

---

## 19. AI-Collaboration-System

> **Ziel:** Chat-Claude und Claude Code arbeiten in jeder Session mit maximalem Kontext
> und minimalem Overhead. Keine wiederholten Erklärungen, kein Raten, kein veraltetes Wissen.

### 19.1 Das `.ai/` Verzeichnis

```
.ai/
├── CONTEXT.md          ← Immer aktueller Projekt-State (wird jede Session aktualisiert)
├── CONVENTIONS.md      ← Code-Regeln, Patterns, was NIEMALS gemacht wird
├── INTEGRATIONS.md     ← Alle externen APIs: Endpoints, Auth, Types, Cache-Keys
├── SESSION_LOG.md      ← Was wann gemacht wurde, was offen ist
└── prompts/
    ├── new-route.md        ← Template: neue Backend-Route
    ├── new-view.md         ← Template: neue Vue View
    ├── new-integration.md  ← Template: neue externe Integration
    └── debug.md            ← Template: Bug debuggen
```

**Diese Dateien sind nicht für GitHub** – sie gehen in `.gitignore` für das public Repo,
bleiben aber im Gitea-Repo versioniert. `ROADMAP.md` und `V2_PLAN.md` ebenfalls.

### 19.2 Arbeitsaufteilung

| Aufgabe | Chat-Claude | Claude Code |
|---|---|---|
| Architektur-Entscheidungen | ✅ Plant | ❌ |
| Phasen-Planung | ✅ Definiert | ❌ |
| Claude-Code-Prompts verfassen | ✅ Schreibt | ❌ |
| CONTEXT.md / SESSION_LOG.md | ✅ Aktualisiert | ❌ |
| Backend Routes + Services | ❌ | ✅ Implementiert |
| Vue Views + Components | ❌ | ✅ Implementiert |
| TypeScript Types | ❌ | ✅ Implementiert |
| Git Commits | ❌ | ✅ Führt aus |
| Debugging | Beide | Beide |

### 19.3 Session-Ablauf

```
START:
  1. Sebastian: "Neues Feature X"
  2. Chat-Claude: liest SESSION_LOG.md + CONTEXT.md → kennt aktuellen Stand
  3. Chat-Claude: plant, stellt Fragen, schreibt Claude-Code-Prompt

IMPLEMENTATION:
  4. Claude Code: liest .ai/CONTEXT.md + .ai/CONVENTIONS.md + .ai/INTEGRATIONS.md
  5. Claude Code: implementiert, validiert (tsc --noEmit), committet

SESSION-ABSCHLUSS:
  6. Chat-Claude: aktualisiert SESSION_LOG.md + CONTEXT.md
  7. Commit: git add .ai/ && git commit -m "docs: session log update"
```

### 19.4 Prompt-Effizienz

Statt jedes Mal langen Kontext mitzuschicken:

```
# Ineffizient (v1-Stil):
"Erstelle eine neue Route für Sonarr. Das Backend nutzt Express,
 TypeScript, die Cache Backbone aus cache.ts, Auth via requireAuth
 Middleware, und Fehler sollen via next(err) weitergegeben werden..."

# Effizient (v2-Stil):
"Führe .ai/prompts/new-route.md aus für: Sonarr Episode History.
 Endpoint: GET /api/v3/history, Cache-TTL: HISTORY, Return-Type: SonarrHistoryItem[]"
```

Der Prompt-Template enthält alles – Konventionen, Datei-Pfade, Validierungs-Schritte.
Chat-Claude muss nur noch die variablen Teile einfügen.

### 19.5 TypeScript als AI-Dokumentation

Shared Types in `packages/shared/src/types/` sind die Single Source of Truth.
Claude Code rät nie API-Shapes – es liest die Interfaces.

```typescript
// Claude Code kann immer nachschlagen:
// packages/shared/src/types/integrations.ts
// → RadarrMovie, SonarrSeries, LidarrArtist etc.

// packages/shared/src/types/socket.ts
// → ServerToClientEvents, ClientToServerEvents

// packages/shared/src/types/api.ts
// → ApiResponse<T>, PaginatedResponse<T>, ApiError
```

Wenn ein Type falsch oder unvollständig ist → `tsc --noEmit` schlägt fehl →
sofortiges Feedback, kein Runtime-Bug.

### 19.6 Was .ai/-Dateien NICHT sind

- Kein Ersatz für echten Code-Kommentar (der steht im Code)
- Keine Duplikation von TypeScript-Types (die stehen in /shared)
- Keine Pflege-Last – Änderungen werden nur bei Session-Abschluss geschrieben,
  nicht nach jedem einzelnen Commit
