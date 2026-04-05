# nexarr v2

Self-hosted Media Dashboard – Radarr, Sonarr, Lidarr, Prowlarr, SABnzbd, Tautulli, Overseerr, Bazarr, Gotify, Plex, TMDB & Audiobookshelf in einer einheitlichen Dark-UI.

**Stack:** Node 20 + TypeScript 5 + Express 5 + Vue 3 + Vite + Pinia + Socket.io + SQLite  
**Architektur:** Monorepo (npm workspaces)

## Dev starten

```bash
cp packages/server/.env.example packages/server/.env
# .env befüllen
npm install
npm run dev
```

Server läuft auf http://localhost:3000
