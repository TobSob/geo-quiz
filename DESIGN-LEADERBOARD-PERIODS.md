# DESIGN-LEADERBOARD-PERIODS — Kalender-Zeiträume in der Bestenliste (2026-07-22)

> Nutzer-Feedback: „Die Ansichten sind nicht konsequent — sie zeigen nicht die
> aktuelle Woche an, außerdem fehlt das Blättern durch die Wochen wie im
> Erfolge-Abschnitt."
> Verwandte Docs: [DESIGN-SOCIAL.md](DESIGN-SOCIAL.md) (Bestenlisten-Regeln),
> [DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md) (Pokal-Perioden, Blätter-UI).

## Problem

Zwei Stellen im Spiel reden über „die Woche" — und meinen Unterschiedliches:

| | Bestenliste (`get_leaderboard_*`) | Pokale (`finalize_cup_trophies`) |
|---|---|---|
| Woche | **letzte 7 Tage**, rollierend ab jetzt | **Kalenderwoche** Mo–So, `date_trunc('week', … at time zone 'Europe/Berlin')` |
| Monat | letzte 30 Tage | Kalendermonat |
| Jahr | letzte 365 Tage | Kalenderjahr |

Folgen:
1. **„Woche" ist nicht die aktuelle Woche.** Am Mittwoch zeigt der Filter halb
   die Vorwoche mit. Wer die Bestenliste liest, um zu sehen, wer gerade auf den
   Wochen-Pokal zusteuert, bekommt die falsche Menge — obwohl die Erfolge-Seite
   selbst sagt: „den aktuellen Stand zeigt die Bestenliste".
2. **Kein Blättern.** Ein rollierendes Fenster hat keine Vorgänger, also gibt es
   auch kein ◀/▶ wie im Pokale-Tab. Vergangene Wochen sind gar nicht einsehbar.

## Regeln

**R1 — Kalenderperioden statt rollierender Fenster.** „Woche/Monat/Jahr" in der
Bestenliste bedeuten exakt dasselbe wie beim Pokal: Kalenderwoche (Mo–So),
Kalendermonat, Kalenderjahr, jeweils in **Europe/Berlin**. „Alle" bleibt
unbegrenzt.

**R2 — Blättern wie im Erfolge-Screen.** Unter den Zeitraum-Chips steht dieselbe
◀ / Label / ▶ -Zeile wie im Pokale-Tab, mit derselben Beschriftung
(`formatTrophyPeriod`: „KW 30 2026" / „Juli 2026" / „2026"). ▶ ist in der
laufenden Periode gesperrt, ◀ an der ältesten Periode mit Einträgen.

**R3 — Die laufende Periode ist als solche erkennbar.** Bei Offset 0 steht unter
dem Label ein dezentes „läuft noch" — der Unterschied zur abgeschlossenen
Hall-of-Fame-Periode ist damit sichtbar, ohne eine zweite Beschriftungslogik.

**R4 — Zurücksetzen auf „aktuell".** Jeder Wechsel von Zeitraum, Modus oder
Gruppe springt zurück auf Offset 0. Man landet nie unbemerkt in einer alten
Woche.

**R5 — Level-Tab bleibt ohne Zeitraum.** XP sind kumulativ und account-gebunden;
eine „XP dieser Woche" gäbe es serverseitig gar nicht. Der Tab behält seinen
erklärenden Satz („alle Zeiträume zusammen").

## Umsetzung

### Grenzen berechnet der Client, filtert der Server

Die Perioden-Mathematik liegt in `frontend/src/features/leaderboard/periods.ts`
(rein, testbar). Der Server bekommt nur zwei Zeitstempel und muss von Perioden
nichts wissen:

- `berlinToday()` — heutiges Kalenderdatum in Europe/Berlin, via
  `Intl.DateTimeFormat`, als reines UTC-Mitternachtsdatum.
- `periodStart(period, offset)` — Anfang der Periode, `offset` Perioden vor der
  laufenden (0 = aktuell). Woche = Montag, wie `date_trunc('week', …)`.
- `berlinMidnight(date)` — der UTC-Moment, an dem in Berlin dieser Kalendertag
  beginnt. Einstufige Offset-Korrektur genügt: Berliner Zeitumstellungen liegen
  um 01:00 UTC, die Korrektur bewegt sich zwischen 22:00 und 00:00 UTC — dort
  wechselt der Offset nie. (Tests decken beide DST-Seiten ab.)
- `maxPeriodOffset(period, firstPlayed)` — wie weit ◀ zurückgehen darf.

### Migration 0016

`get_leaderboard_scores` / `get_leaderboard_cups` bekommen ein **zusätzliches,
defaultetes** `p_until timestamptz` (Halboffenes Intervall `p_since <= t <
p_until`). Zusätzlich statt ersetzend, damit ein bereits deployter alter Client
(der nur `p_since` schickt) nach dem Einspielen unverändert weiterläuft —
PostgREST löst die Funktion über die übergebenen Argumentnamen auf.

Neu: `get_leaderboard_first_played(p_mode, p_group)` liefert den frühesten
Eintrag (Modus `null` = Cup-Läufe) — die Untergrenze fürs Blättern. Ohne diese
RPC (Migration noch nicht eingespielt) bleibt ◀ gesperrt.

### Verhalten ohne Migration 0016

Der Client fällt bei `PGRST202` („keine passende Funktion") einmalig auf den
Aufruf ohne `p_until` zurück. Ergebnis: Offset 0 stimmt weiterhin (obere Grenze
ist ja „jetzt"), Blättern ist ohnehin gesperrt, weil die Untergrenzen-RPC fehlt.
Die Bestenliste bleibt also in jeder Deploy-Reihenfolge benutzbar.

## Umsetzungs-Log

- 2026-07-22: Umgesetzt. Neu: `features/leaderboard/periods.ts` (+ Tests),
  Migration `0016_calendar_leaderboard_periods.sql`,
  `PeriodNav` in `ScoresScreen`. `PERIOD_LABELS` von `leaderboardApi` nach
  `periods.ts` gezogen. **Offen: 0016 auf der Live-DB einspielen**, danach
  `npm run deploy`.
