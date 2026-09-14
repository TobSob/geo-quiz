# Quiz-Engine

> **Stand:** 2026-08-30 · **Verifiziert:** `src/features/quiz-engine/`, `npm run test` → 148/148 in 15 Dateien

## Modi

Sechs, als `GameMode` in `types.ts`: `flags`, `countries` (Hauptstadt→Land),
`capitals` (Land→Hauptstadt), `outline` (Umriss erkennen), `city-pin`,
`landmark-pin`. Dazu zwei Rahmen: **Cup** (alle sechs rotierend) und
**Training** (ohne Zeitdruck, zählt nicht in die Bestenliste).

## Arcade-Scoring (`arcadeScoring.ts`)

Zeitbudget statt fester Fragenzahl. Alle Werte sind exportierte Konstanten:

| Konstante | Wert |
|---|---|
| `SESSION_SECONDS` | 60 |
| `CUP_LEG_SECONDS` | 30 |
| `BASE_POINTS` | 100 |
| `STREAK_STEP` | 0.1 (Multiplikator, ohne Deckel) |
| `RECLAIM_EVERY` / `RECLAIM_SECONDS` | alle 10 Treffer +5 s |
| `MIN_QUESTION_MS` | 500 (unsichtbare Anti-Tasten-Spam-Grenze) |
| `VOLLTREFFER_TIME_BONUS` | 3 s |
| `PIN_CORRECT_MAX_KM` | 350 |

### Pin-Stufen (`PIN_TIERS`)

| Stufe | bis km | Punkte | Streak | Zeit |
|---|---|---|---|---|
| VOLLTREFFER! | 100 | 100 | +1 | +3 s |
| STARK! | 350 | 50 | +0,5 | — |
| KNAPP VORBEI | 1000 | 10 | +0,1 | — |
| NAJA… | 2500 | 1 | 0 | — |
| VÖLLIG VERPEILT | ∞ | 0 | bricht Streak | — |

Die Grenzen stammen aus drei Playtest-Runden (2026-07-14/15), nicht aus dem
Bauch — Änderungen daran gehören wieder durch einen Playtest.

## Weitere Module

- `questionGenerator.ts` — deterministische Frage-IDs, Same-Region-Distraktoren,
  `questionFromId`-Roundtrip (wichtig für den Cup: alle Spieler, ein Seed).
- `adaptiveSampler.ts` — gewichtete Zufallsauswahl, 30 % Flat-Mix,
  5er-Ring-Buffer gegen Wiederholungen. Nur Training.
- `arcadeSession.ts` / `cupSession.ts` — Zustandsmaschinen; Cup = 6 Legs à 30 s,
  Cup-Total ist die Rohsumme der Legs.
- `scoring.ts` — Altpfad, nur noch Training (ohne Zeitdruck).
- `../geo/distance.ts` — Haversine.

## Vertiefung

- [../../DESIGN-ARCADE.md](../../DESIGN-ARCADE.md) — das komplette Regelwerk und seine Begründung
- [../DEVELOPMENT.md](../DEVELOPMENT.md) §3 — Fragen, IDs, Sampler
