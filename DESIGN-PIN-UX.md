# 🗺️ Design-Notizen — Pin-Mode-UX (Städte-Pin & Landmark-Pin)

> Arbeitsdokument zur Nutzer-Rückmeldung 2026-07-16: Pin-Modi fühlen sich
> "mehr Stress als arcade-mäßig cool" an. Grundprinzip (Karte + Klick) bleibt
> unangetastet — es geht um Bedienung/Tempo, nicht ums Spielprinzip.

Legende: ✅ entschieden/umgesetzt · 💬 in Diskussion · ⬜ Idee, nicht beauftragt

---

## Ausgangspunkt: warum fühlt sich Pin stressiger an als Choice?

Gemeinsam identifizierte Ursachen (Diskussion 2026-07-16):

1. Der globale 60-s-Countdown läuft weiter, während man auf einer winzigen
   Weltkarte (Zoom 2) erst reinzoomen/pannen muss — ein ganz anderer Skill
   als "1 von 4 Buttons tippen", braucht spürbar mehr Zeit und Feinmotorik,
   besonders am Handy.
2. Zwei manuelle Schritte pro Frage (Pin setzen → „Bestätigen" → warten →
   „Weiter") statt einem Tap wie bei Choice.
3. Kein Zwischenfeedback beim Zielen — man schießt „blind" und erfährt erst
   nach dem Bestätigen, wie daneben man lag.
4. **Konkret gemeldete Bugs** (Nutzer, 2026-07-16):
   - Die Karte lässt sich komplett aus dem sichtbaren Bereich wegscrollen
     (kein `maxBounds` → man pannt über die Pole hinaus ins Leere und
     verliert die Orientierung).
   - Auf dem Handy im Hochformat wirkt die Karte klein — die halbtransparente
     Top-Leiste (HUD + Foto + Prompt) frisst zu viel Höhe.
   - Horizontales Pannen über große Distanzen (z. B. Europa → Australien)
     fühlt sich mühsam/"meh" an.

**Entscheidung:** Grundprinzip bleibt (Karte + Klick, kein separater Modus-
Umbau). Zuerst die beiden konkreten Bugs fixen (#4), Rest bleibt fürs Erste
Beobachtung/Diskussion.

---

## Umgesetzt (2026-07-16)

| # | Fix | Umsetzung | Status |
|---|---|---|---|
| P1 | Karte kann nicht mehr ins Leere gescrollt werden | `MapPicker.tsx`: `maxBounds` (Breite ±85°, Länge ±270° — großzügiger als eine Weltbreite, damit `worldCopyJump` beim Überqueren der ±180°-Naht weiter nahtlos zurückspringen kann) + `maxBoundsViscosity={1.0}` (Karte "prallt ab" statt durchzurutschen) | ✅ |
| P2 | Karte wirkt im Hochformat zu klein | `index.css`: mobile Top-Leiste (`.quiz-screen--pin .quiz-chrome`) schlanker — Padding 8px→6px, Foto 118×84→88×62 (Hochformat) bzw. 92×64→76×52 (Querformat < 480px Höhe), Prompt 11px→10px, HUD-Gaps 10px→8px. Reduziert die von der Leiste verdeckte (und damit unklickbare) Kartenfläche | ✅ |

---

## Geparkte Idee — Kontinent-Sprung-Buttons (nicht beauftragt)

**Problem:** Ausgangspunkt #3 (manuelles Pixel-für-Pixel-Pannen über große
Distanzen fühlt sich langsam/unspaßig an) ist damit noch nicht gelöst — das
wäre ein echter Zusatz, keine reine Fehlerbehebung.

**Idee:** Kleine Kontinent-Buttons am Kartenrand (Europa/Asien/Afrika/
Amerika/Ozeanien), die per Klick sofort per `fitBounds`/`setView` dorthin
springen. Das manuelle Pannen wird dann nur noch für die **letzte
Feinjustierung** gebraucht, nicht mehr um erstmal überhaupt in die richtige
Weltgegend zu kommen.

**Tradeoff:** etwas mehr UI auf der Karte (Overlay-Buttons kosten Platz/
Aufmerksamkeit), aber deutlich weniger Wisch-Frust bei weit entfernten
Zielen (z. B. Sydney, wenn die Karte gerade auf Europa zentriert ist).

**Offene Fragen, falls das umgesetzt wird:**
- Wie viele/welche Regionen? (5 Kontinente vs. gröber/feiner)
- Wo platziert, ohne mit Zoom-Control, Foto oder Aktionsleiste zu kollidieren?
- Zählt ein Kontinent-Sprung fürs Lern-Tracking/Highscore anders als freies
  Pannen? (Vermutlich nein — reine Navigationshilfe, keine Spielmechanik.)

Status: ⬜ Idee festgehalten, nicht terminiert.

---

## Weitere Beobachtungen (unpriorisiert, aus der Diskussion)

- Zwei-Schritt-Bestätigung (Pin setzen → Bestätigen) könnte zu einem
  Ein-Schritt-Flow werden (Doppelklick/Doppeltipp setzt direkt fest?) —
  noch nicht besprochen, da es die Unterscheidung "Pin verschieben vor dem
  Bestätigen" verlieren würde.
- Denkbar: kleiner visueller Zoom-Hinweis oder Anfangs-Zoomstufe je nach
  Zielgröße (Land vs. Stadt) — noch nicht besprochen.
