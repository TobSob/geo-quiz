# Gamification

> **Stand:** 2026-08-30 · **Verifiziert:** `src/features/gamification/`, `src/features/avatars/avatarCatalog.ts`

## Bausteine

| Baustein | Stand | Ort |
|---|---|---|
| XP & Level | Cap **99** (`LEVEL_CAP`) | `features/gamification/levels.ts` |
| Abzeichen | **17** Definitionen | `badgeCatalog.ts` + Tabelle `badge_definitions` |
| Pokale | Top 3 je Kalenderperiode | `trophyPeriods.ts`, RPC `finalize_cup_trophies` |
| Avatare | **22** Pixel-Avatare | `avatars/avatarCatalog.ts` |
| Vitrine | frei wählbare Ausstellungsstücke | `featuredItems.ts`, Tabelle `profile_featured_items` |

> STATUS.md nennt 21 Avatare — veraltet, seit Migration 0015 (Beta-Tester-
> Avatar `bug`) sind es 22. Nachzählen:
> `grep -o "id: '[a-z0-9_-]*'" src/features/avatars/avatarCatalog.ts | wc -l`

Avatare werden über Level (3–40) sowie Erfolge/Pokale/Prestige freigeschaltet;
`AVATARS` ist bereits nach Schwierigkeit sortiert, `AVATARS_BY_LEVEL` sortiert
zusätzlich.

## Perioden

Pokale **und** Bestenlisten-Zeitfilter laufen über **Kalenderperioden**
(Woche Mo–So, Monat, Jahr, Zeitzone Europe/Berlin) und sind mit ◀/▶ blätterbar
— nicht über rollierende Fenster. Beides teilt sich dieselbe Logik, damit
„diese Woche" in Pokal und Bestenliste dasselbe bedeutet.

## Bestenliste

Der **Geo Cup** ist der Hauptpunkt (großer Button oben, für Accounts
vorausgewählt; Gäste starten bei „Meine Rekorde"). Darunter Level / Global /
Meine Rekorde, alle mit Gruppen-Umschalter und Avataren.

## Vertiefung

- [../../DESIGN-GAMIFICATION.md](../../DESIGN-GAMIFICATION.md) — Abzeichen, Pokale, XP-Kurve
- [../../DESIGN-AVATARS.md](../../DESIGN-AVATARS.md) — Avatare & Spielerkarten
- [../../DESIGN-LEADERBOARD-PERIODS.md](../../DESIGN-LEADERBOARD-PERIODS.md) — warum Kalenderperioden
