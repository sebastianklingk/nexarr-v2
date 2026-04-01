# nexarr v2 – Lessons Learned
> Wird nach jeder Korrektur durch den User ergänzt.
> Ziel: Wiederholungsfehler über Sessions hinweg eliminieren.
> Format: Datum · Kontext · Was schiefging · Regel die es verhindert

---

<!-- Einträge werden hier chronologisch ergänzt, neueste zuerst -->

<!-- Beispiel-Format:
## 2026-04-01 · radarr.routes.ts · Fehlender Cache-Invalidate
**Was passierte:** Nach dem Hinzufügen eines Films wurde der Cache nicht invalidiert,
UI zeigte alten Stand.
**Regel:** Nach jedem schreibenden API-Call den zugehörigen Cache-Key invalidieren.
-->
