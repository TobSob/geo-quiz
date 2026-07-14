# 🏅 Design-Notizen — Gamification (Abzeichen, Pokale, XP & Level)

> Arbeitsdokument, Stil wie [DESIGN-ARCADE.md](DESIGN-ARCADE.md). Alle Punkte mit dem
> Nutzer entschieden (Design-Chat 2026-07-13); der Umbau läuft als **Phase G**
> in der [ROADMAP.md](ROADMAP.md).

Legende: ✅ entschieden · 💬 in Diskussion · ⬜ noch nicht besprochen

---

## Grundkonzept (steht fest)

Drei Bausteine, alle zahlen auf ein gemeinsames XP-Konto ein:

1. **Abzeichen (Badges)** — 16 Stück in je 5 Stufen (Normal → Bronze → Silber →
   Gold → Diamant) für konkrete Leistungen, jede Stufe mit eigenem witzigem
   Untertitel.
2. **Pokale** — nur im Cup-Modus („deswegen heißt er doch auch Cup-Modus"):
   Wochen-, Monats- und Jahresbester je Kalenderperiode, dauerhaft in einer
   Hall of Fame verewigt.
3. **XP & Level** — jede gewertete Runde, jedes neue Abzeichen und jeder Pokal
   gibt XP; daraus ergibt sich ein Spieler-Level (Cap 99).

| Regel | Wert | Status |
|---|---|---|
| Speicherung | **Nur Server, account-gebunden** (Nutzer-Entscheid). Gäste sehen einen Teaser — konsistent mit dem Leaderboard-Gating (0004): `submit_score` verlangt ohnehin registrierte Accounts | ✅ |
| Rückwirkende Vergabe | Ja, wo möglich: Backfill aus `score_entries`/`cup_runs`/`user_progress` beim Einspielen der Migration. Streak- und Volltreffer-Zähler sind nicht rekonstruierbar → starten bei 0 | ✅ |
| UI-Ort | Eigener Screen **„🏅 Erfolge"** (`/achievements`) mit Tabs Abzeichen / Pokale / Level; LV-Chip im Header; Unlock-Panel am Rundenende | ✅ |
| Level-Bestenliste | Neuer Tab „Level" in der Bestenliste, global **und** je Freundesgruppe (Nutzer-Wunsch). Sortiert nach XP, kein Zeitfilter (XP ist Allzeit) | ✅ |
| Anti-Cheat-Einordnung | Die neuen Client-Angaben (Streak, Treffer, Volltreffer) beeinflussen **nur Badge-Metriken**, nie Leaderboards. Plausibilitätschecks serverseitig; der echte Fix bleibt Phase D | ✅ |

---

## XP-Ökonomie (steht fest)

| Quelle | XP | Anmerkung |
|---|---|---|
| Gewertete Runde (Einzelmodus & Cup-Leg) | `ceil(score / 100)`, min. 1 | typ. 20–40 XP pro 60-s-Runde, 10–20 je Cup-Leg |
| Cup abgeschlossen | +50 | zusätzlich zu den 6 Leg-Abgaben |
| Abzeichen Normal / Bronze / Silber / Gold / Diamant | 25 / 50 / 100 / 250 / 500 | je Stufe einmalig |
| Pokal (Platz 1 / 2 / 3) | Woche 200/100/50 · Monat 500/250/125 · Jahr 1500/750/375 | bei Finalisierung der Periode (Top 3 seit 0009) |

## Level-Kurve (steht fest)

Kumulierte XP für Level *n*: **`xpForLevel(n) = 50 · n · (n − 1)`** — schnelle
erste Level, dann linear wachsende Abstände. Anzeige-Cap: **Level 99**.
Berechnung nur clientseitig (`features/gamification/levels.ts`), der Server
speichert ausschließlich XP.

| Level | XP gesamt | Casual-Spieler (2–3 Runden/Tag) |
|---|---|---|
| 2 | 100 | Tag 1 (erste Session, dank Normal-Badges) |
| 3 | 300 | Tag 2–3 |
| 5 | 1.000 | Woche 1–2 |
| 10 | 4.500 | ~6 Wochen |
| 15 | 10.500 | ~3–4 Monate |
| 20 | 19.000 | ~6 Monate |
| 30 | 43.500 | ~14 Monate |
| 50 | 122.500 | Langzeitziel |

---

## Pokale (steht fest)

| Regel | Wert | Status |
|---|---|---|
| Nur Cup-Modus | Pokale je Kalenderwoche/-monat/-jahr | ✅ |
| Periodengrenzen | Kalenderperioden in **Europe/Berlin**, Woche = ISO (Mo–So) | ✅ |
| Gewinner | **Top 3** je Periode (🥇/🥈/🥉, Nutzer-Entscheid 2026-07-14 — vorher nur Platz 1). Rangfolge: beste Einzelleistung pro Spieler (höchster `total_score`), Tie → früheres `played_at`; max. ein Pokal je Spieler und Periode | ✅ |
| Pokal-XP | Gestaffelt nach Rang: Woche 200/100/50 · Monat 500/250/125 · Jahr 1500/750/375 | ✅ |
| Vergabezeitpunkt | Erst **nach Ablauf** der Periode — kein pg_cron verfügbar, daher **Lazy-Finalisierung**: `finalize_cup_trophies()` läuft bei jedem Lesen (Erfolge-Screen, Hall of Fame) und jeder Cup-Abgabe und trägt alle abgeschlossenen, noch offenen Perioden nach. Advisory-Lock + Unique-Constraint machen das racefest | ✅ |
| Rückwirkend | Ja — beim Einspielen der Migration werden alle abgeschlossenen Perioden seit dem ersten Cup-Run vergeben | ✅ |
| Hall of Fame | Öffentlich für registrierte Accounts (nur `display_name`, wie Leaderboards), eigener Abschnitt im Pokale-Tab | ✅ |
| Laufende Periode | Wird nicht angezeigt/gewertet — UI-Hinweis verweist auf die Bestenliste als „aktueller Stand" | ✅ |

---

## Badge-Katalog (steht fest — Copy-Referenz)

16 Abzeichen. Stufen: **Normal / Bronze / Silber / Gold / Diamant** — jede Stufe
hat ihren eigenen Untertitel (Nutzer-Wunsch), die Sprüche steigern sich.
Technische Quelle der Wahrheit für die Schwellen: Seed in
`supabase/migrations/0008_gamification.sql`; Copy lebt in
`frontend/src/features/gamification/badgeCatalog.ts` (dieses Dokument ist die
Review-Referenz).

Metriken kommen aus `player_stats` (serverseitig gepflegt bei jeder Abgabe).

| # | Badge | Metrik | Schwellen N/B/S/G/D |
|---|---|---|---|
| 1 | 🌍 **Weltenbummler** | beantwortete Fragen | 50 / 250 / 1.000 / 5.000 / 20.000 |
| 2 | 🧠 **Besserwisser** | richtige Antworten | 25 / 150 / 750 / 3.000 / 12.000 |
| 3 | 🧹 **Punkte-Staubsauger** | Gesamtpunkte | 10k / 50k / 250k / 1M / 5M |
| 4 | 🕹️ **Dauerzocker** | gespielte Runden | 10 / 50 / 200 / 1.000 / 5.000 |
| 5 | 🚀 **Highscore-Jäger** | beste Einzelrunde | 1.500 / 2.500 / 3.500 / 4.500 / 6.000 |
| 6 | ⚡ **Serientäter** | längste Streak | 5 / 10 / 15 / 20 / 30 |
| 7 | 🎯 **Pixel-Sniper** | Volltreffer (Pin-Modi) | 10 / 50 / 250 / 1.000 / 5.000 |
| 8 | 🏆 **Cup-Kämpfer** | beendete Cups | 1 / 10 / 50 / 250 / 1.000 |
| 9 | 📅 **Stammgast** | Spieltage | 3 / 14 / 60 / 180 / 365 |
| 10 | 🏅 **Pokal-Regal** | gewonnene Pokale | 1 / 3 / 10 / 25 / 60 |
| 11 | 🚩 **Flaggen-Fanatiker** | richtige in Flaggen | 25 / 100 / 500 / 2.000 / 10.000 |
| 12 | 🗺️ **Kontinental-Kenner** | richtige in Länder | 25 / 100 / 500 / 2.000 / 10.000 |
| 13 | 🏛️ **Hauptstadt-Held** | richtige in Hauptstädte | 25 / 100 / 500 / 2.000 / 10.000 |
| 14 | 👁️ **Silhouetten-Seher** | richtige in Umrisse | 25 / 100 / 500 / 2.000 / 10.000 |
| 15 | 📍 **Städte-Scharfschütze** | richtige in Städte-Pin | 15 / 75 / 300 / 1.200 / 6.000 |
| 16 | 🗿 **Monumenten-Magier** | richtige in Sehenswürdigkeiten | 15 / 75 / 300 / 1.200 / 6.000 |

*(Pin-Modi haben ~10–15 Fragen/Runde statt ~25–30 → niedrigere Schwellen.)*

### Untertitel je Stufe

| Badge | Normal | Bronze | Silber | Gold | Diamant |
|---|---|---|---|---|---|
| 🌍 Weltenbummler | „Einmal um den Block." | „Der Reisepass hat erste Stempel." | „Einmal um den Globus, bitte." | „Du kennst Länder, die dein Atlas nicht kennt." | „Die Erde ruft an: Sie will ihren Job zurück." |
| 🧠 Besserwisser | „Du hattest recht. Zufall?" | „Du hattest recht. Schon wieder." | „Klugscheißen ist jetzt offiziell ein Hobby." | „Das wandelnde Lexikon." | „Google fragt inzwischen dich." |
| 🧹 Punkte-Staubsauger | „Krümel? Nein. Punkte. Alle." | „Saugt zuverlässig jede Punktedecke leer." | „Beutel voll. Weitersaugen." | „PUNKTE-MILLIONÄR! Der Automat weint." | „Es gibt nichts mehr zu holen. Du holst trotzdem." |
| 🕹️ Dauerzocker | „Nur noch EINE Runde. Ehrlich." | „Okay, noch ZEHN Runden. Letztes Angebot." | „Dein Daumen hat jetzt Muskelkater." | „Der Highscore-Bildschirm kennt dich beim Vornamen." | „Der Automat zahlt dir langsam Miete." |
| 🚀 Highscore-Jäger | „Warmgespielt." | „Die Tastatur glüht leicht." | „Streak-Maschine im Serienbetrieb." | „Fast schon unheimlich." | „Bitte einmal die Hände zeigen. Nur zur Kontrolle." |
| ⚡ Serientäter | „Combo!" | „Combo! Combo!" | „C-C-C-COMBO!" | „Die Streak-Anzeige braucht mehr Stellen." | „Fehler sind für dich nur ein Gerücht." |
| 🎯 Pixel-Sniper | „Zielwasser genippt." | „Zielwasser: literweise." | „Trifft Städte mit verbundenen Augen." | „Das Fadenkreuz ist reine Deko." | „GPS fragt dich nach dem Weg." |
| 🏆 Cup-Kämpfer | „Sechs Disziplinen, null Gnade." | „Der Pokal kennt deinen Händedruck." | „Sechskampf ist dein Cardio." | „Cup-Modus? Du nennst es Feierabend." | „Der Cup hat jetzt Angst vor DIR." |
| 📅 Stammgast | „Man sieht sich wieder!" | „Der Automat hat dich vermisst." | „Dein Stammplatz ist reserviert." | „Halbes Jahr, ganzes Herz." | „365 Tage. Die Erde hat eine Runde gedreht — du auch." |
| 🏅 Pokal-Regal | „Der erste Pokal. Noch glänzt er." | „Ein Brett reicht nicht mehr." | „Staubwedel nicht vergessen." | „Statiker wegen Regal-Last kontaktiert." | „Das Regal ist jetzt ein Museum." |
| 🚩 Flaggen-Fanatiker | „Streifen? Sterne? Alles klar." | „Du winkst zurück." | „Du träumst in Fahnenstoff." | „Vexillologe ehrenhalber." | „Flaggen hissen sich vor dir von selbst." |
| 🗺️ Kontinental-Kenner | „Grenzen? Grob bekannt." | „Der Atlas nickt anerkennend." | „Du liest Landkarten wie Comics." | „Kein Land bleibt unerkannt." | „Die UNO holt sich bei dir Rat." |
| 🏛️ Hauptstadt-Held | „Paris, London — läuft." | „Auch Bern statt Zürich. Respekt." | „Naypyidaw. Ohne zu googeln." | „Jede Hauptstadt grüßt zurück." | „Bürgermeister kennen DICH." |
| 👁️ Silhouetten-Seher | „Der Stiefel war einfach. Zugegeben." | „Umrisse sind dein Sudoku." | „Erkennt Länder am Schattenriss." | „Schattenspiele auf Weltniveau." | „Dir reicht ein Pixel Küstenlinie." |
| 📍 Städte-Scharfschütze | „Pin rein, Daumen drauf." | „Meistens die richtige Stadt. Meistens." | „Navi? Brauchst du nicht." | „Du pinnst Städte im Schlaf." | „Stadtpläne zeichnen sich nach dir." |
| 🗿 Monumenten-Magier | „Eiffelturm erkannt. Guter Start." | „Weltwunder? Wochenendausflug." | „Du grüßt Statuen mit Vornamen." | „Moai drehen sich nach dir um." | „Museen fragen dich nach Leihgaben." |

Stufen-Farben (PICO-8): Normal = Weiß/dim · Bronze = `--orange` · Silber = hell
· Gold = `--yellow` · Diamant = `--cyan`.

---

## Technik-Entscheidungen (steht fest)

| # | Punkt | Entscheidung | Status |
|---|---|---|---|
| T1 | Stats-Speicher | Eine Zeile `player_stats` je User (XP + alle Badge-Metriken inkl. `mode_correct jsonb`), additiv gepflegt **in** `submit_score`/`submit_cup_run` — keine zweite Abgabe-Roundtrip | ✅ |
| T2 | Neue Abgabe-Daten | `submit_score` bekommt 3 **defaultete** Parameter `p_correct_count`, `p_best_streak`, `p_volltreffer` (alter Client bleibt lauffähig, kein Lockstep-Deploy). Rückgabe wird jsonb-Unlock-Payload `{entry_id, xp_gained, xp_total, new_badges}` → explizites `drop function` nötig (Rückgabetyp-Wechsel) | ✅ |
| T3 | Badge-Schwellen | Geseedete Tabelle `badge_definitions(badge_id, metric, thresholds int[5])` + generische Award-Schleife `award_badges()` (Rebalancing = UPDATE, kein Funktions-Umbau). Copy (Namen/Sprüche/Emojis) nur im Client | ✅ |
| T4 | Badge-Vergabe | Eine Zeile je erreichter Stufe in `player_badges` (PK user+badge+tier) — „neu freigeschaltet" = echtes Insert, XP je Stufe sauber einmalig | ✅ |
| T5 | Pokal-Tabelle | `cup_trophies` mit `unique(period_type, period_start)`; Finalisierung idempotent (Advisory-Lock + `on conflict do nothing`) | ✅ |
| T6 | Plausibilität | `correct ≤ question_count`, `streak ≤ question_count`, `volltreffer ≤ correct`; 0005-Trigger + 0007-Wanduhr laufen unverändert weiter | ✅ |
| T7 | Level-Bestenliste | RPC `get_leaderboard_levels(p_limit, p_group)` auf `player_stats` (XP absteigend), Gate `is_registered_user()`, Gruppenfilter wie 0005/0006-Leaderboards | ✅ |

---

## Umsetzungs-Log Phase G

### G6 ✅ Pokale auf Top 3 — 2026-07-14

Nutzer-Entscheid nach dem Live-Test: statt nur des Besten bekommen die
**drei besten Cup-Spieler** jeder abgeschlossenen Periode einen Pokal.

- **Migration `0009_trophy_top3.sql`**: `cup_trophies.rank` (1–3, Default 1 —
  Bestandspokale bleiben Platz 1), Unique-Constraints `(period, rank)` und
  `(period, user)` (max. ein Pokal je Spieler und Periode).
  `finalize_cup_trophies()` neu: Kandidaten = Bestleistung pro Spieler,
  `row_number` → Top 3, vergeben wird nur, was fehlt (freier Rang + Spieler
  noch ohne Pokal) — dadurch werden Plätze 2/3 alter Perioden nachvergeben.
  XP-Staffel s. o. `get_cup_trophies` (Signatur-Drop wegen neuer
  `rank`-Spalte) und `get_gamification` liefern den Rang mit.
- **Frontend**: `TROPHY_XP` als Rang-Tripel, `RANK_EMOJI` (🥇🥈🥉),
  `trophyTitle()` („Wochenbester" für Platz 1, sonst „Woche · Platz 2/3");
  Erfolge-Screen zeigt Rang in „Deine Pokale" + Hall of Fame
  (Zeilen-Key um Rang erweitert), XP-Quellen-Text aktualisiert,
  Katalog-Test pinnt die neue Staffel.
- `apply_pending.sql` neu angelegt (nur 0009), `apply_all.sql` + README ergänzt.

### G1–G4 ✅ (Code) — 2026-07-13

**Migration `supabase/migrations/0008_gamification.sql`** (an `apply_pending.sql`
hinter 0007 angehängt; `apply_all.sql` + `supabase/README.md` aktualisiert):

- Tabellen `player_stats` (XP + alle Badge-Metriken inkl. `mode_correct jsonb`,
  read-own), `badge_definitions` (Seed, 16 Badges), `player_badges`
  (PK user+badge+tier — eine Zeile je Stufe), `cup_trophies`
  (`unique(period_type, period_start)`).
- `submit_score`/`submit_cup_run` gedroppt und neu (Rückgabetyp bigint → jsonb):
  alle 0007-Checks unverändert, neu 3 defaultete Parameter (`p_correct_count`,
  `p_best_streak`, `p_volltreffer`) mit Plausibilitätsgrenzen, Stats-Upsert,
  `award_badges()`-Aufruf, Unlock-Payload `{entry_id|cup_run_id, xp_gained,
  xp_total, new_badges}`.
- `award_badges(uuid)` (generische Schleife über den Seed, XP je echtem Insert)
  und `finalize_cup_trophies()` (Advisory-Lock, nur abgeschlossene Perioden,
  Europe/Berlin, Tie → früheres `played_at`, Pokal-XP + trophy_count,
  danach Badge-Check) sind rein intern — kein Grant an Clients.
- Lese-RPCs: `get_gamification()` (eigener Stand, finalisiert vorher),
  `get_cup_trophies(p_limit)` (Hall of Fame, nur display_name),
  `get_leaderboard_levels(p_limit, p_group)` (XP absteigend, Gruppenfilter
  wie 0006).
- Backfill: `player_stats` aus `score_entries`+`cup_runs`+`user_progress`
  (correct-Zähler als gedeckelte Näherung inkl. Training), dann `award_badges`
  je User, dann `finalize_cup_trophies()` → rückwirkende Pokale.

**Frontend:**

- `features/gamification/levels.ts` (Kurve, `levelForXp`, `levelProgress`,
  `xpForScore`) + `badgeCatalog.ts` (16 Badges × 5 Sprüche, Tier-Farben,
  XP-Konstanten, `formatTrophyPeriod` mit ISO-KW) — beide mit Tests, der
  Katalog-Test pinnt Schwellen/Metriken gegen den SQL-Seed.
- `api/gamificationApi.ts` (`fetchGamification`, `fetchHallOfFame`,
  `fetchLeaderboardLevels`, `parseUnlockPayload`, `mergeUnlockPayloads`),
  `state/gamificationStore.ts` (nicht persistiert, `load`/`applyUnlock`/`reset`).
- `scoreApi`: `submitScore`/`submitCupRun` → `Promise<UnlockPayload | null>`,
  neue RPC-Parameter; Cup bündelt Run- + Leg-Payloads.
  `SessionSummary.volltrefferCount` (aus `answers` in `toSessionSummary`).
- UI: `routes/AchievementsScreen.tsx` (Tabs Abzeichen/Pokale/Level, eigener
  Gast-Teaser), Route `/achievements` + Header-Chip „LV n" (nur registriert)
  in `App.tsx`, Home-Kachel „🏅 Erfolge", Bestenlisten-Tab „Level" mit
  Global/Gruppe-Umschalter (`ScoresScreen`, `RequireAccount` exportiert +
  `message`-Prop), `components/UnlockPanel.tsx` im Runden-Summary
  (`ArcadeQuizView`) und Cup-Endscreen, `sfx.levelup()`.

**Verifiziert:** Tests 101/101, tsc + oxlint sauber (eine vorbestehende
Fast-Refresh-Warnung in PlayScreen); Browser: Home-Kachel, Gast-Teaser auf
Erfolge- und Level-Tab, Gast-Runde endet sauber ohne Unlock-Panel.
**Offen (G5):** `apply_pending.sql` (0007 → 0008) auf der Live-DB einspielen,
danach E2E mit registriertem Account (Unlock-Panel, Badges, Level-Chip,
Hall of Fame) — bis dahin liefern die submit-RPCs keine Payload.

---

## Verlauf

| Datum | Eintrag |
|---|---|
| 2026-07-14 | Pokale auf **Top 3** umgestellt (Migration 0009, Nutzer-Entscheid nach Live-Test): 🥇/🥈/🥉 je Periode mit XP-Staffel, Nachvergabe für alte Perioden. Live-Verifikation von 0007+0008 davor abgeschlossen: Backfill (LV 6, 8/16 Badges, Wochen-Pokal KW 28), Unlock-Panel mit LEVEL UP im Browser bestätigt; Test-Bot-Runde per `revert_bot_round.sql` rückstandslos entfernt |
| 2026-07-13 | Dokument angelegt; alle Punkte im Design-Chat entschieden: Speicherung nur Server (account-gebunden), Pokale nur für den Cup-Modus (Wochen-/Monats-/Jahresbester, Kalenderperioden Europe/Berlin, lazy finalisiert — kein pg_cron), eigener Erfolge-Screen, rückwirkender Backfill, eigene Untertitel je Badge-Stufe, Level-Bestenliste global + Gruppen. Als Phase G in die Roadmap übernommen |
