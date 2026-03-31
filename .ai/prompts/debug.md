# Prompt Template: Bug debuggen

**Verwendung durch Chat-Claude:**
```
"Führe .ai/prompts/debug.md aus für:
 Problem: [Beschreibung des Bugs]
 Symptom: [Was passiert konkret]
 Betroffene Datei(en): [Pfade]
 Fehlermeldung: [Exakte Fehlermeldung wenn vorhanden]
 Reproduzierbar: [Immer / manchmal / nach X]"
```

---

## Anweisungen für Claude Code

### Phase 1: Informationen sammeln

1. `.ai/CONTEXT.md` lesen – aktuellen Stand kennen
2. Logs lesen:
   ```bash
   tail -100 /tmp/nexarr-v2.log
   # oder
   tail -f /tmp/nexarr-v2.log
   ```
3. TypeScript Check:
   ```bash
   npx tsc --noEmit 2>&1
   ```
4. Betroffene Datei lesen (vollständig, nicht nur Ausschnitt)

### Phase 2: Hypothesen prüfen

**Backend-Bugs:**
```bash
# Endpoint direkt testen
curl -H "Cookie: [session]" http://192.168.188.42:3000/api/[endpoint]

# Mit ausführlicher Ausgabe
curl -v -H "Cookie: [session]" http://192.168.188.42:3000/api/[endpoint] 2>&1

# Body prüfen
curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: [session]" \
  -d '{"key":"value"}' \
  http://192.168.188.42:3000/api/[endpoint]
```

**Cache-Probleme:**
```bash
# Cache-Status prüfen
curl http://192.168.188.42:3000/api/cache/stats | jq .

# Spezifischen Key prüfen
curl http://192.168.188.42:3000/api/cache/stats | jq '.["[cache_key]"]'

# Cache für Key löschen (via Server-Restart oder DEL-Endpoint)
```

**TypeScript-Fehler:**
```bash
# Nur eine Datei prüfen
npx tsc --noEmit packages/server/src/services/[name].service.ts

# Verbose Output
npx tsc --noEmit --listFiles 2>&1 | head -50
```

**Vue Frontend-Bugs:**
```bash
# Vite Dev Server Logs prüfen
# Browser Console Errors prüfen (via Playwright oder manuell)

# Netzwerk-Requests prüfen:
# Browser DevTools → Network → nach /api/ filtern
```

### Phase 3: Häufige Bug-Muster (zuerst prüfen)

**"Undefined cannot read property of..."**
- Wahrscheinlich: API-Response hat andere Struktur als erwartet
- Fix: Zod-Schema prüfen, API-Response loggen

**"Router nicht registriert / 404"**
- Wahrscheinlich: Route in app.ts nicht registriert
- Fix: `packages/server/src/app.ts` prüfen

**"Cache gibt alte Daten"**
- Wahrscheinlich: Mutation hat Cache nicht invalidiert
- Fix: `C.del()` nach Mutation aufrufen

**"TypeScript Fehler: Type X is not assignable to Type Y"**
- Wahrscheinlich: Zod-Schema stimmt nicht mit Interface überein
- Fix: Schema und Interface synchronisieren

**"Vue: Cannot read property of null"**
- Wahrscheinlich: Daten noch nicht geladen, kein Loading-State
- Fix: `v-if="data !== null"` oder `?.` Optional Chaining

**"Socket.io Event kommt nicht an"**
- Prüfen: Event-Name exakt gleich auf Server und Client?
- Prüfen: Client hat `socket.on('[event]', ...)` aufgerufen?
- Prüfen: Server emittiert an alle (`io.emit`) oder spezifischen Socket?

**"CORS Error"**
- Betrifft nur externe API-Calls vom Browser direkt
- Fix: Image-Proxy Endpoint nutzen für externe Bilder
- Fix: Alle API-Calls über den nexarr Backend-Proxy leiten

**"Integration antwortet nicht"**
- Timeout zu kurz? (ABS braucht min. 15s)
- URL falsch? (http vs https, Port)
- API-Key falsch? Test-Endpoint aufrufen

### Phase 4: Fix implementieren

Vor dem Fix:
- [ ] Ursache verstanden und dokumentiert
- [ ] Fix ist minimal (ändert nur was nötig ist)
- [ ] Fix bricht keine anderen Funktionen

Nach dem Fix:
```bash
# 1. TypeScript Check
npx tsc --noEmit

# 2. Server neu starten
pkill -f "tsx" 2>/dev/null
npm run dev > /tmp/nexarr-v2.log 2>&1 &
sleep 3

# 3. Bug reproduzieren und verifizieren dass er weg ist

# 4. Commit
git add -A
git commit -m "fix([scope]): [beschreibung des fixes]

Problem: [was war falsch]
Ursache: [warum ist es passiert]
Fix: [was wurde geändert]"
```

### Phase 5: Learning dokumentieren

In `.ai/SESSION_LOG.md` unter "Probleme / Learnings" eintragen:
```
- [Bug-Beschreibung]: Ursache war [X]. Fix: [Y]. 
  Verhindere mit: [Regel/Pattern]
```

---

## Was Claude Code NICHT tun soll beim Debuggen

- ❌ Nicht sofort anfangen zu ändern ohne die Ursache zu verstehen
- ❌ Nicht mehrere Hypothesen gleichzeitig als Fix implementieren
- ❌ Nicht `console.log` in Produktions-Code lassen
- ❌ Nicht `any` als Quick-Fix für TypeScript-Fehler
- ❌ Nicht ganze Dateien neu schreiben wenn ein kleiner Fix reicht
- ✅ Erst verstehen, dann fixen, dann validieren
