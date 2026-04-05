# Prompt Template: Neue Backend-Route

**Verwendung durch Chat-Claude:**
```
"Führe .ai/prompts/new-route.md aus für:
 [BESCHREIBUNG]
 Endpoint: [METHOD] [PATH]
 Service: [service-name].service.ts
 Return-Type: [TypeName]
 Cache-TTL: [TTL]
 Invalidiert: [cache-keys falls Mutation]"
```

---

## Anweisungen für Claude Code

Lies zuerst diese Dateien vollständig:
1. `.ai/CONTEXT.md` – aktueller Projekt-State
2. `.ai/CONVENTIONS.md` – Coding-Regeln (PFLICHT)
3. `.ai/INTEGRATIONS.md` – API-Dokumentation für den betroffenen Service
4. `packages/server/src/routes/radarr.routes.ts` – Referenz-Implementierung
5. `packages/server/src/services/radarr.service.ts` – Referenz-Implementierung

---

## Schritte

### Schritt 1: Type in packages/shared/src/types/integrations.ts

Prüfe ob der Return-Type bereits existiert.
Falls nicht: füge hinzu:

```typescript
export interface [TypeName] {
  // Alle Felder mit korrekten TypeScript-Types
  // Nutze Zod-Schema-Pattern: export const [TypeName]Schema = z.object({...})
  // Dann: export type [TypeName] = z.infer<typeof [TypeName]Schema>
}
```

Exportiere in `packages/shared/src/index.ts`.

### Schritt 2: Service-Funktion in packages/server/src/services/[name].service.ts

```typescript
// GET-Endpoint (mit Cache):
export async function get[Name](): Promise<[TypeName]> {
  return C.fetch(
    '[cache_key]',
    async () => {
      const { data } = await axios.get(`${[name]Base()}/[endpoint]`, {
        headers: [name]Headers(),
        timeout: 10000,
      });
      return [TypeName]Schema.parse(data);  // Zod Validation
    },
    C.TTL.[TTL]
  );
}

// POST/PUT/DELETE-Endpoint (Mutation):
export async function [action][Name](id: number, body?: unknown): Promise<void> {
  await axios.[method](`${[name]Base()}/[endpoint]/${id}`, body, {
    headers: [name]Headers(),
    timeout: 10000,
  });
  C.del('[cache_key]');           // Einzelner Key
  C.delPrefix('[cache_prefix]_'); // Oder Prefix
}
```

### Schritt 3: Route in packages/server/src/routes/[name].routes.ts

```typescript
// Neuen Route-Handler hinzufügen (bestehende Datei bearbeiten):
router.[method]('/[path]', requireAuth, async (req, res, next) => {
  try {
    // Query-Params validieren wenn nötig:
    // const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
    
    const result = await [name]Service.get[Name]();
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

### Schritt 4: Validierung

```bash
npx tsc --noEmit
# Muss fehlerfrei durchlaufen
```

### Schritt 5: Commit

```bash
git add -A
git commit -m "feat([service]): add [description] endpoint"
```

### Schritt 6: CONTEXT.md aktualisieren

Markiere den erledigten Task in SESSION_LOG.md wenn dieser Prompt Teil einer Phase war.

---

## Häufige Fehler vermeiden

- ❌ Kein `any` als Return-Type
- ❌ Keine Business Logic im Route-Handler
- ❌ Kein direktes `res.status(500).json(...)` – immer `next(err)`
- ❌ Cache nicht vergessen bei GET-Endpoints
- ❌ Cache-Invalidierung nicht vergessen bei Mutations
- ✅ Zod-Validation für externe API-Responses
- ✅ Timeout immer explizit setzen
- ✅ `requireAuth` Middleware auf alle geschützten Routes
