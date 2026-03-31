# Prompt Template: Neue Integration onboarden

**Verwendung durch Chat-Claude:**
```
"Führe .ai/prompts/new-integration.md aus für:
 Integration: [Name] (z.B. Jellyfin)
 Farbe: #[hex]
 .env Keys: [NAME]_URL, [NAME]_API_KEY (oder andere)
 Basis-URL: z.B. http://192.168.188.69:8096
 Auth: z.B. X-MediaBrowser-Token Header
 Wichtigste Endpoints: [Liste]
 Cache-Welle: 6 (oder andere)"
```

---

## Anweisungen für Claude Code

Lies zuerst diese Dateien vollständig:
1. `.ai/CONTEXT.md`
2. `.ai/CONVENTIONS.md`
3. `.ai/INTEGRATIONS.md` – Referenz für bestehende Integrationen
4. `packages/server/src/routes/radarr.routes.ts` – Referenz Route
5. `packages/server/src/services/radarr.service.ts` – Referenz Service
6. `packages/server/src/config/env.ts` – Zod-Schema für .env

---

## Schritte (alle 9 müssen abgeschlossen werden)

### Schritt 1: .env.example ergänzen

```bash
# [NAME] (optional)
[NAME]_URL=
[NAME]_API_KEY=    # oder [NAME]_TOKEN=
```

### Schritt 2: Zod-Schema in packages/server/src/config/env.ts

```typescript
// In envSchema.shape einfügen:
[NAME]_URL: z.string().url().optional(),
[NAME]_API_KEY: z.string().optional(),
```

### Schritt 3: Types in packages/shared/src/types/integrations.ts

```typescript
// Zod Schema zuerst:
export const [Name]ItemSchema = z.object({
  id:    z.string().or(z.number()),  // je nach API
  name:  z.string(),
  // ... alle relevanten Felder
});

// Type ableiten:
export type [Name]Item = z.infer<typeof [Name]ItemSchema>;

// Weitere Types für Response-Wrapper etc.
export const [Name]ResponseSchema = z.object({
  Items: z.array([Name]ItemSchema),
  TotalRecordCount: z.number(),
});
```

Exportiere alle neuen Types in `packages/shared/src/index.ts`.

### Schritt 4: Service in packages/server/src/services/[name].service.ts

```typescript
import axios from 'axios';
import { env } from '../config/env';
import { C } from '../cache/cache';
import { [Name]ItemSchema } from '@nexarr/shared';

// Helper Functions
const [name]Base = () => env.[NAME]_URL + '/[api-prefix]';
const [name]Headers = () => ({
  '[Auth-Header]': env.[NAME]_API_KEY ?? '',
});

// Guard für nicht-konfigurierte Integration
function assertConfigured() {
  if (!env.[NAME]_URL || !env.[NAME]_API_KEY) {
    throw new ApiError('[Name] ist nicht konfiguriert', 503);
  }
}

// Services:
export async function getLibrary(): Promise<[Name]Item[]> {
  assertConfigured();
  return C.fetch(
    '[name]_library',
    async () => {
      const { data } = await axios.get(`${[name]Base()}/[endpoint]`, {
        headers: [name]Headers(),
        timeout: 10000,
      });
      return z.array([Name]ItemSchema).parse(data);
    },
    C.TTL.COLLECTION
  );
}

// ... weitere Service-Funktionen
```

### Schritt 5: Routes in packages/server/src/routes/[name].routes.ts

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as [name]Service from '../services/[name].service';

const router = Router();

router.get('/library', requireAuth, async (req, res, next) => {
  try {
    const library = await [name]Service.getLibrary();
    res.json(library);
  } catch (err) {
    next(err);
  }
});

// Status/Health Endpoint (IMMER implementieren)
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const status = await [name]Service.getStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

export { router as [name]Router };
```

### Schritt 6: Router in packages/server/src/app.ts registrieren

```typescript
import { [name]Router } from './routes/[name].routes';
// ...
app.use('/api/[name]', [name]Router);
// ⚠️ IMMER registrieren – auch wenn nicht konfiguriert
// Guard ist im Service via assertConfigured()
```

### Schritt 7: Cache-Wellen in packages/server/src/cache/waves.ts

```typescript
// In Welle 6 (Optional Integrations) einfügen:
{
  key: '[name]_status',
  interval: C.TTL.STATIC,
  fn: () => [name]Service.getStatus().catch(() => null),
},
{
  key: '[name]_library',
  interval: C.TTL.COLLECTION,
  fn: () => [name]Service.getLibrary().catch(() => null),
},
```

### Schritt 8: Settings in packages/client/src/views/SettingsView.vue

Im Verbindungen-Abschnitt eine neue Integration-Karte hinzufügen:

```vue
<IntegrationCard
  name="[Name]"
  :color="'#[hex]'"
  :url-key="'[NAME]_URL'"
  :key-name="'[NAME]_API_KEY'"
  :is-configured="settings.[name]Configured"
  @test="testConnection('[name]')"
/>
```

### Schritt 9: INTEGRATIONS.md aktualisieren

Diese Datei (`.ai/INTEGRATIONS.md`) mit der neuen Integration ergänzen:
- Alle implementierten Endpoints
- Auth-Pattern
- Cache-Keys
- Wichtige Hinweise

---

## Validierung (alles muss grün sein)

```bash
# TypeScript
npx tsc --noEmit

# Server startet ohne Fehler (auch wenn Integration nicht konfiguriert)
node packages/server/dist/server.js &
sleep 2
curl http://localhost:3000/api/[name]/status
# Erwartete Response: { error: '[Name] ist nicht konfiguriert' } mit 503
kill %1
```

## Commit

```bash
git add -A
git commit -m "feat([name]): add [Name] integration (service, routes, settings)"
```

---

## Checkliste Qualitätskontrolle

- [ ] Service wirft `ApiError` wenn nicht konfiguriert (nicht crasht)
- [ ] Route immer registriert (keine `if (env.X_URL)` Wrapper in app.ts)
- [ ] Alle externen Calls via `C.fetch()` mit passendem TTL
- [ ] Zod-Validation für alle API-Responses
- [ ] Timeout explizit gesetzt (10000 Standard, 15000 für ABS-ähnliche)
- [ ] Cache-Invalidierung nach allen Mutations
- [ ] INTEGRATIONS.md aktualisiert
- [ ] .env.example ergänzt
- [ ] TypeScript fehlerfrei
