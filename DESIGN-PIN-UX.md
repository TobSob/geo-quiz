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

## Umgesetzt (2026-07-17)

| # | Fix | Umsetzung | Status |
|---|---|---|---|
| P3 | OSM/CARTO-Attribution-Link saß direkt über dem „Weiter"/„Bestätigen"-Button (nur 10px Abstand, fast volle horizontale Überlappung) — wurde beim Antippen des Buttons versehentlich mitgetroffen und hat aus dem Spiel raus auf externe Seiten geführt | `MapPicker.tsx`: eigene `<AttributionControl position="bottomleft" prefix={false} />` statt der Default-Attribution (die ohne Positionsangabe unten-rechts sitzt); jetzt zusammen mit dem Zoom-Control unten-links, wo nur der selten getippte „Aufgeben"-Button in der Nähe ist. Verifiziert per Bounding-Box-Check: keine horizontale Überlappung mehr mit „Weiter"/„Bestätigen" in Mobil- noch Desktop-Layout | ✅ |

---

## Beauftragt (2026-07-17) — Ein-Tap-Antwort + volles Tile-Preload

Nutzer-Entscheidung: Kombination aus der geparkten Kontinent-Sprung-Idee und
der bisher nur notierten Ein-Schritt-Bestätigung, plus Tile-Preload gegen
Nachlade-Ruckler. **Nach echtem Gerätetest (Handy) revidiert:** Kontinent-
Buttons wieder entfernt ("unnötig"), Ein-Tap-Antwort bestätigt ("macht es
schon besser"), Tile-Preload gezielt nachgebessert, weil das Nachladen beim
seitlichen Pannen auf dem Handy weiter auftrat.

| # | Fix | Umsetzung | Status |
|---|---|---|---|
| P4 | Weites Pixel-für-Pixel-Pannen fühlt sich mühsam an | Kontinent-Sprung-Buttons implementiert (5 Buttons, `flyToBounds`) — nach Handy-Test wieder **entfernt**: Nutzer-Feedback "die Buttons sind unnötig". `ContinentJumpButtons`/`CONTINENTS`/`ExposeMap` komplett aus `MapPicker.tsx` und `ArcadeQuizView.tsx` raus, dazugehöriges CSS entfernt | ❌ verworfen (Nutzer-Feedback) |
| P5 | Zwei manuelle Schritte pro Frage (Pin setzen → Bestätigen → warten → Weiter) nur in den **getimten** Modi (Arcade/Cup) | `ArcadeQuizView.tsx`: Klick auf die Karte beantwortet die Frage sofort (`onPin` ruft `answerPin` direkt), kein separater „Bestätigen"-Tap mehr. **Training bleibt bewusst zweistufig** (`QuizView.tsx` unverändert). Nutzer-Feedback nach Handy-Test: "macht es schon besser" | ✅ bestätigt |
| P6 | Beim Pannen (v.a. seitlich am Handy) laden Kacheln sichtbar nach | Erste Version (Kontinent-Boxen bei Zoom 4 only) reichte laut Handy-Test nicht. Neu: `MapPicker.tsx` lädt jetzt die **komplette Welt** bei Zoom 2–5 vor (16+64+256+1024 = 1360 Kacheln), nicht mehr nur grobe Kontinent-Kästen — die alte Version hatte Ozeane, Lücken zwischen den Kästen und die niedrigen Start-Zoomstufen gar nicht abgedeckt | ✅ (Details/Bugs unten) |

**Bewusst NICHT verändert:** Die Möglichkeit, den Pin vor dem Bestätigen zu
verschieben, entfällt in Arcade/Cup jetzt tatsächlich (das war der in der
vorherigen Runde notierte Trade-off) — abgefedert dadurch, dass die
Distanz-Scoring-Stufen (100/350/1000/2500 km) ohnehin großzügig genug sind,
dass ein leicht daneben gesetzter Pin selten den ganzen Punktetopf kostet.

### Zwei echte Bugs beim P6-Rewrite gefunden (nicht nur das Layout-Problem der verworfenen Buttons)

1. **Retina-Mismatch (der eigentliche Grund fürs Nachladen auf dem Handy):**
   Leaflets `{r}`-Platzhalter im Tile-URL-Template löst auf jedem Retina-
   Display (`devicePixelRatio > 1` — praktisch jedes moderne Handy) IMMER zu
   `@2x` auf, unabhängig von der `detectRetina`-Option (die steuert einen
   anderen Mechanismus, siehe `leaflet-src.js:12201` vs. `:12093`). Der
   Preload lud bisher die 1x-Variante — komplett am eigentlich angeforderten
   Kachel-Set vorbei. Jetzt: `RETINA_SUFFIX` per `devicePixelRatio` erkannt
   und ins Preload-URL-Template übernommen, exakt wie Leaflet es macht.
2. **GC-Risiko bei referenzlosen `Image()`-Prefetches:** `new Image().src = url`
   ohne gehaltene Referenz ist für den Garbage Collector fair game — er kann
   die laufende Anfrage abbrechen, bevor sie fertig lädt. Jetzt in einem
   modulweiten `keepAlive`-Array gehalten, damit alle 1360 Anfragen wirklich
   durchlaufen (in einem isolierten Test ohne Referenzhaltung liefen manche
   Ladevorgänge nicht zuverlässig durch).

Verifiziert im Browser (375px Mobile-Emulation, `devicePixelRatio: 2`):
Live-Kachel-URL und Preload-URL stimmen jetzt exakt überein (`@2x` beidseitig),
Pannen über mehrere Bildschirmbreiten (Europa → Mexiko) zeigt keine grauen
Platzhalter-Kacheln mehr. Kontinent-Button-Layout-Bug (Buttons liefen aus dem
375px-Screen) ist mit dem Feature selbst wieder verworfen, keine Nacharbeit
nötig. Echtes Gerät noch offen (Handy-Rückmeldung zur zweiten Preload-Version
steht noch aus).

---

## Weitere Beobachtungen (unpriorisiert, aus der Diskussion)

- Kein Zwischenfeedback beim Zielen (man erfährt erst nach dem Tap, wie
  daneben man lag) — durch P5 jetzt sogar noch "blinder", da der Tap direkt
  die Antwort ist. Falls sich das nach echtem Spieltest immer noch komisch
  anfühlt, wäre ein Distanz-Ring oder Live-Indikator der nächste Kandidat.
- Denkbar: kleiner visueller Zoom-Hinweis oder Anfangs-Zoomstufe je nach
  Zielgröße (Land vs. Stadt) — noch nicht besprochen.
