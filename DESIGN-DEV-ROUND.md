# DESIGN — Dev-Runde (erzwingbare Fragen zum Testen)

**Status:** umgesetzt · 2026-07-26
**Auslöser:** Der Datumsgrenzen-Bug beim Pinnen (Bora Bora, siehe
[DESIGN-PIN-UX.md](DESIGN-PIN-UX.md), Eintrag 2026-07-26) ließ sich in der
normalen App nur durch zufälliges Durchspielen reproduzieren — es gab keinen
Weg, gezielt „Bora Bora, kurz über die ±180°-Naht" o. Ä. anzusteuern.

## Ziel

Ein **Dev-only-Werkzeug**, mit dem man eine echte Arcade-Runde spielt, aber
die Fragen selbst zusammenstellt: Modus wählen, konkrete Items (Länder /
Städte / Landmarks) in eine Playlist legen (Duplikate erlaubt) und
durchspielen. Damit sind Grenzfälle (Datumsgrenze, Pole, sehr nahe/ferne
Ziele, bestimmte Flaggen/Umrisse) reproduzierbar prüfbar.

Nur im Dev-Build (`npm run dev`) erreichbar — im Production-Build ist die
Route weder verlinkt noch im Bundle (Lazy-Import hinter `import.meta.env.DEV`).

## Umsetzung (maximale Wiederverwendung)

Die Runde ist eine **ganz normale `ArcadeQuizView`** — gleicher Timer, gleiches
Feedback, gleiches Auflösen, exakt derselbe `MapPicker`. Einziger Unterschied:
die Fragenquelle.

- `arcadeSession.ts` → `makeForcedSource(mode, data, keys)`: liefert Fragen zu
  einer festen Schlüssel-Liste (iso2 bzw. City-/Landmark-ID) in Reihenfolge
  über das bestehende `generateQuestion(..., forcedKey)`. Ignoriert bewusst
  `usedIds`, damit dasselbe Ziel mehrfach hintereinander kommen darf. Liste
  erschöpft → `null` → Runde endet (wie ein leerer Pool).
- `useArcadeSession(mode, budgetMs, sourceOverride?)`: optionaler
  Quellen-Override; ohne ihn unverändert die zufällige `makeGeneratorSource`.
- `ArcadeQuizView` reicht ein optionales `sourceOverride`-Prop durch.
- `routes/DevScreen.tsx`: Modus-Dropdown + durchsuchbare Item-Liste →
  Playlist → „Runde starten". Reicht `makeForcedSource` als `sourceOverride`
  in `ArcadeQuizView`. Meldet **keinen** Score ab (kein `submitScore`, kein
  `recordSession`) — reines Testen, verfälscht Progress/Leaderboard nicht.
- Zugang: `import.meta.env.DEV`-gate für Route (`/dev`, App.tsx) und
  Menü-Kachel (HomeScreen).

### Warum der 60-s-Timer stört nicht

Das Zeitbudget tickt laut Arcade-Regeln nur in der **Frage-Phase**, nicht in
der **Feedback-/Auflöse-Phase**. Man kann das aufgelöste Ergebnis (Linie,
Distanz, Zoom) also beliebig lange inspizieren, ohne Zeit zu verlieren — genau
was zum Debuggen des Kartenverhaltens gebraucht wird.

## Bewusst nicht gemacht

- Kein eigener „unendlicher" Modus ohne Timer — die Feedback-Pause deckt das
  Inspektionsbedürfnis bereits ab, und „wie echte Runde" war die Vorgabe.
- Kein Persistieren der Playlist — Wegwerf-Werkzeug.
