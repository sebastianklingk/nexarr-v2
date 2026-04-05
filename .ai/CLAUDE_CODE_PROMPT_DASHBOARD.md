# Dashboard Rewrite – Claude Code Prompt

## Auftrag
Modulares Dashboard mit Drag & Drop Widgets, Widget-Katalog und Mobile-Support bauen.

## Lies zuerst
1. `.ai/CONTEXT.md` → Stand + Architektur
2. `.ai/LESSONS.md` → bekannte Fallen
3. `.ai/CONVENTIONS.md` → Code-Regeln
4. `.ai/ROADMAP_DASHBOARD.md` → **kompletter Plan** (Widgets, Grid, Mobile, Phasen, Code-Beispiele)

Alles steht in der Roadmap. Arbeite Phase D-1 bis D-5 ab.

## Arbeitsweise
- Backend → Store → View Reihenfolge
- Kleine Commits nach jedem Widget
- `npm run typecheck` vor jedem Commit
- `npm run restart` nach Backend-Änderungen
- CONTEXT.md am Session-Ende updaten
- Frage nicht — arbeite selbstständig
- Alle verfügbaren Skills, Plugins, MCP-Tools frei nutzbar

## Verifikation (nach jeder Änderung)
```
npm run typecheck
npm run restart
playwright:browser_navigate → http://192.168.188.42:3000/dashboard
playwright:browser_snapshot → Elemente prüfen
playwright:browser_take_screenshot → Visuell prüfen
```
Bei Fehlern: `npm run logs` lesen, fixen, weiter.

## Shell
```bash
cd /mnt/user/appdata/openclaw/config/workspace/nexarr-v2 && <befehl>
```

Starte mit Phase D-1.
