# 🕹️ Design-Notizen — Arcade-Umbau der Spielmodi

> Arbeitsdokument für den Umbau von „feste Fragenzahl, Zeitlimit pro Frage" zu
> „feste Zeit, so viele Fragen wie du schaffst". Wird während der Design-Diskussion
> fortgeschrieben; erst wenn hier alles ✅ ist, wandert der Umbau als Phase in die
> [ROADMAP.md](ROADMAP.md).

Legende: ✅ entschieden · 💬 in Diskussion · ⬜ noch nicht besprochen

---

## Kernidee (steht fest)

Alle Modi außer Training werden zeitbasiert: Die Session hat ein festes Zeitbudget,
gespielt wird, bis die Uhr abläuft. Score = Summe aller Antwortpunkte. Schnelligkeit
wird nicht mehr über einen Punkte-Zeitbonus belohnt, sondern automatisch darüber,
dass mehr Fragen ins Zeitfenster passen.

| Regel | Wert | Status |
|---|---|---|
| Einzelmodi | 60 Sekunden | ✅ |
| Cup | 30 Sekunden pro Disziplin | ✅ |
| Training | ohne Zeitlimit (unverändert) | ✅ |
| Basispunkte pro richtiger Antwort | 100 (alle Modi) | ✅ |
| Streak-Multiplikator | +10 % pro Streak-Punkt (Streak 7 → 170 %) | ✅ |
| Streak-Aufbau (Choice-Modi) | richtige Antwort +1, falsche → Streak weg | ✅ |
| Zeit-Rückholung | alle 10 vollen Streak-Punkte (10, 20, 30 …) → +5 Sekunden | ✅ |

### Pin-Modi: Distanzstufen statt Exponentialkurve

Ersetzt das bisherige `100 × e^(−d/R)`-Scoring. Jede Stufe hat ein witziges
Retro-Label (deutsch), Punkte und einen Streak-Effekt:

| Stufe | Label | Punkte | Streak | Extra | Status |
|---|---|---|---|---|---|
| ≤ 100 km | VOLLTREFFER! | 100 | +1 | **+3 s Zeit** | ✅ |
| ≤ 350 km | STARK! | 50 | +0,5 | | ✅ |
| ≤ 1000 km | KNAPP VORBEI | 10 | +0,1 | | ✅ |
| ≤ 2500 km | NAJA… | 1 | bleibt stehen (+0) | | ✅ |
| > 2500 km | VÖLLIG VERPEILT | 0 | Streak weg | | ✅ |

Streaks können dadurch krumme Werte haben (4,4 → 144 %). Die +5-Sekunden-Rückholung
zieht erst beim Überschreiten ganzer Zehner (9,8 → 10,3 löst aus).

*Rebalancing 2026-07-15 (Playtest R3, Nutzer-Entscheid): Zonen von 100/200/500/1000
auf 100/350/1000/2500 km erweitert (Pins lieferten zu schwer Punkte) und
Volltreffer-Zeitbonus +3 s eingeführt. `correct` fürs Lern-Tracking ≤ 350 km.*

**Anti-Tasten-Spam (R3/R4):** Jede beantwortete Frage verbraucht mindestens
**0,5 s** Budget (`MIN_QUESTION_MS`) — unsichtbar statt sichtbarer Strafsekunden
(eine „−2 s"-Variante wurde nach Nutzer-Feedback wieder verworfen). Gehaltene
Tasten (Auto-Repeat auf 1–4) zählen nicht als Antwort. Liegt bewusst über der
Server-Plausibilitätsgrenze von 400 ms/Frage (Migration 0005).

---

## Entschiedene Punkte

*Alle Punkte geklärt (2026-07-12) — der Umbau ist als Phase E in der [ROADMAP.md](ROADMAP.md) eingeplant.*

| # | Punkt | Optionen / Empfehlung | Status |
|---|---|---|---|
| O1 | **Distanzstufen pro Modus skalieren?** → **Entschieden: einheitlich 100/200/500/1000 km für beide Pin-Modi.** Begründung: Beide Modi spielen auf der zoombaren Weltkarte (Faktencheck: City-Pin ist nicht Europa-beschränkt, 143 Städte weltweit) — Präzision kostet Zoom-Zeit, Zeit ist die Währung (Risk/Reward identisch); City vs. Landmark unterscheidet sich nur in der Wissensschwierigkeit. | Einheitliche Stufen, eine Regel für beide Modi. | ✅ |
| O2 | **Streak-Multiplikator unbegrenzt?** → **Entschieden: unbegrenzt, kein Deckel.** Bewusst in Kauf genommen: Leaderboard-Spitze gehört fehlerfreien Runs (Beispielrechnung: 20 Antworten perfekt ≈ 3.900 Pkt, mit einem Fehler in der Mitte ≈ 2.100). Das Drama ab hoher Streak IST das gewollte Spielgefühl. | Unbegrenzt +10 %/Streak-Punkt. | ✅ |
| O3 | **+5 s automatisch oder aktiv einlösen?** → **Entschieden: automatisch** beim Überschreiten von 10/20/30, gefeiert mit 8-Bit-Effekt („+5 SEC!", Screen-Flash; Sound später via Phase C1). Kein Klickziel im Zeitdruck. | Automatische Gutschrift. | ✅ |
| O4 | **Läuft die Uhr während Feedback/Laden weiter?** → **Entschieden: Uhr pausiert.** Sie läuft nur, während eine Frage aktiv beantwortbar ist — Feedback-Einblendung, Distanzlinien-Animation und Foto-Ladezeiten (Landmark) kosten keine Spielzeit. 60 s = reine Denk- und Zielzeit; Feedback darf dadurch spektakulär sein. **Anti-Schummel-Auflagen siehe Abschnitt „Pausen-Regeln" unten.** | Uhr nur bei aktiver Frage. | ✅ |
| O5 | **Punkte-Zeitbonus pro Frage** (bisher bis +50 Choice / +10 Pin) → **Entschieden: fällt ersatzlos weg.** Tempo wird bereits doppelt belohnt (mehr Fragen pro Minute + schnellerer Streak-Aufbau); Formel bleibt sauber: 100 × Streak-Multiplikator. | Ersatzlos streichen. | ✅ |
| O6 | **Fragenpool-Größen geprüft (2026-07-12):** 129 Landmarks, 143 Städte, 245 Länder. Pins schaffen realistisch 10–15 Fragen/Run, Choice 25–30 → alle Pools locker ausreichend. **Implementierungsauflage:** Sampler darf innerhalb einer Session keine Frage wiederholen. | Kein Problem — nur No-Repeat-Regel im Sampler sicherstellen. | ✅ |

---

## Pausen-Regeln (Anti-Schummel-Auflagen zu O4, ergänzt 2026-07-12)

Eine pausierende Uhr hat zwei Missbrauchs-Vektoren — beide werden per Design geschlossen:

1. **Kein Nachdenken bei stehender Uhr:** Frage-Inhalte (Prompt, Optionen, Karte, Foto)
   werden **atomar mit dem Uhr-Start aufgedeckt**. Während der Feedback-Pause wird die
   nächste Frage unsichtbar vorgeladen (Foto-Preload!); nichts von ihr ist sichtbar,
   bevor die Uhr wieder läuft. Die Pause selbst darf dadurch beliebig lang sein
   („Tippen zum Fortfahren") — es gibt in ihr nichts nachzuschlagen.
   Bonus: Foto-Ladezeiten verschwinden komplett aus dem Spielfluss.
2. **Uhr nicht anhaltbar bei sichtbarer Frage:** Während einer aktiven Frage zählt die
   **Wanduhr** (Zeitstempel-Differenzen via `Date.now()`), nicht ein JS-Tick. App in den
   Hintergrund schicken, Tab einfrieren oder DevTools-Pause stoppen die Uhr **nicht** —
   wer weggeht, dessen Zeit läuft weiter. Pausiert wird ausschließlich in den vom Spiel
   kontrollierten Feedback-Fenstern.
3. **Backstop in Phase D:** Der Server kennt Session-Start/-Ende und prüft, ob die
   Gesamt-Wandzeit zur Spielzeit passt (60 s + Rückholungen + begrenzte Feedback-Zeit
   pro Frage). Erfundene „Pausen" fallen serverseitig auf.

---

## Technische Folgen (gesammelt, noch nicht geplant)

- `max_possible` / „Prozent perfekt" verlieren ihren Sinn (keine feste Fragenzahl mehr) →
  Leaderboard-Views sortieren künftig nach Rohpunkten statt `percent`.
- DB-Migration nötig: `cup_runs.total_score`-Check (0–100) passt nicht mehr;
  Plausibilitäts-Trigger (`duration_ms ≥ question_count × 400`) neu denken —
  Sessiondauer ist künftig ~fix (60 s + Rückholungen).
- `SessionSummary`, `scoring.ts`, `cupSession.ts` (u. a. `CUP_QUESTIONS_PER_LEG`,
  `cupTotalScore`) werden umgebaut; Cup-Total = Rohsumme statt 0–100.
- **Reihenfolge:** Dieser Umbau kommt **vor** Phase D (Anti-Cheat) — die neue
  Scoring-Engine wird dann direkt serverfähig portiert statt zweimal gebaut.

---

## Umsetzungs-Log Phase E

*Konkrete Implementierungs-Entscheidungen, damit jede Session ohne Neu-Analyse
weitermachen kann. Neueste oben.*

### E6-Feedback Runde 1 ✅ (2026-07-12, Handy-Test des Nutzers)

Drei Punkte aus dem ersten Praxistest, alle umgesetzt und im Browser verifiziert:

1. **Kategorie-Texte** (HomeScreen): Kein Text erwähnte das Zeitsystem. Neu:
   Tagline „⏱ 60 Sekunden pro Runde · richtige Serien bringen Multiplikator
   und Extra-Zeit" unterm Titel; Cup-Karte „à 30 Sekunden … Punktsumme";
   Pin-Karten erklären die Distanz-Logik; Training sagt „Ohne Zeitdruck".
2. **3-2-1-GO-Countdown** vor jeder Runde (auch je Cup-Leg): Hook startet
   nicht mehr automatisch nach dem Preload (`ready` + `begin()` statt
   Auto-Start), View zeigt `StartCountdown` (3→2→1 je 800 ms, GO! 500 ms,
   Farbwechsel pink→gelb→cyan→grün, CSS `countdown-num`/`countdown-pop`).
   Pausen-Regeln intakt: Frage bleibt bis GO! verdeckt, Uhr startet mit dem
   Aufdecken. Per In-Page-Sampling verifiziert (Frage erscheint bei ~3,0 s).
3. **Lokal-Filter** (ScoresScreen): Chip-Leiste „Alle / 6 Modi / 🏆 Cup /
   🎯 Training" filtert die lokale Liste (vorher alles gemischt).

Noch offen aus E6: eigentliches Balancing (Stufen-Gefühl, Fragen/Minute,
Label-Feinschliff) — braucht weiteren Praxistest.

### E5 ✅ (Code) — DB-Migration + Leaderboard-Umbau (2026-07-12)

**Migration `supabase/migrations/0005_arcade_scoring.sql`** (auch in
`apply_all.sql` angehängt, README-Tabelle ergänzt):

- Löscht alle Alt-Einträge in `score_entries`/`cup_runs` (Nutzer-Entscheid:
  Prozent-Scores und Rohpunkte sind nicht vergleichbar).
- `cup_runs.total_score`: Check 0–100 → `>= 0` (Rohsumme).
- `validate_score_entry()` neu: min. 400 ms/Frage (bleibt), Dauer ≤ 10 min,
  Score ≤ theoretisches Maximum fehlerfreier Läufe `100n + 5n(n−1)`.
- **Views → RPCs:** `leaderboard_scores`/`leaderboard_cups` gedroppt; neu
  `get_leaderboard_scores(p_mode, p_since, p_limit)` und
  `get_leaderboard_cups(p_since, p_limit)` — `distinct on (user_id)` =
  Bestleistung pro Spieler (S1), `p_since` = Zeitfilter (null = Alle),
  security definer mit `is_registered_user()`-Gate, execute nur für
  `authenticated` (PUBLIC/anon explizit revoked). Nie `user_id` exponiert.
  Parametrisierung nimmt Phase F den Gruppenfilter ab (Parameter ergänzen).
- `max_possible` bleibt als Spalte; Client schreibt den Score hinein.
  Echte Ablösung in Phase D (Server rechnet selbst).

**Frontend:** `leaderboardApi.ts` auf RPC-Aufrufe + `LeaderboardPeriod`
(week/month/year/all, rollierend 7/30/365 Tage, client-seitig als
`p_since`-ISO-Datum). `ScoresScreen`: Modus-Picker (6 Chips) + Zeitraum-Picker
im Global-Tab, Zeitraum-Picker im Cups-Tab, Lokal-Tab zeigt Rohpunkte
(Spalten #/Modus/Punkte/Fragen/Datum, Sortierung nach Punkten). Neue
CSS-Klasse `.pixel-btn--small` für Filterleisten.

**Verifiziert:** Tests 75/75, tsc + oxlint sauber; Browser: Lokal-Tab rendert,
Global-Tab zeigt korrekt das Account-Gate (anonyme Session). Die Picker-UI im
eingeloggten Zustand + RPC-Roundtrip sind erst nach DB-Migration prüfbar → E6.

**⚠️ MANUELL OFFEN:** 0005 auf die Live-DB anwenden — SQL-Editor
(`apply_all.sql` NICHT komplett ausführen, nur den 0005-Block; die früheren
Blöcke sind schon drin) oder `npx supabase db push`. Bis dahin: Global/Cups
„Leaderboard nicht erreichbar", Score-Submits scheitern still (lokal bleibt
alles intakt).

**Encoding-Falle (Windows/PS 5.1):** Beim Anhängen an `apply_all.sql` Umlaute
zerschossen (Get-Content ohne -Encoding liest UTF-8-ohne-BOM als ANSI) —
behoben via .NET `ReadAllText/WriteAllText` mit explizitem UTF-8. Für künftige
Appends dasselbe Muster verwenden.

### E4 ✅ — Cup auf 30-s-Legs (2026-07-12)

`CupScreen` nutzt jetzt `ArcadeQuizView` mit `budgetMs = CUP_LEG_SECONDS × 1000`;
Fragen-Vorgenerierung (`generateSession`) und `CUP_QUESTIONS_PER_LEG` sind raus.
`cupScore()` in `cupSession.ts` ist die Rohsumme der Leg-Scores (eigener Test
`cupSession.test.ts`); das alte `cupTotalScore` wurde aus `scoring.ts` entfernt.
`ArcadeQuizView` hat dafür die `showSummary`-Prop aus der alten QuizView
übernommen (Cup rendert eigene Zwischen-/Endscreens). `recordCup` im
progressStore schreibt interim `maxPossible = totalScore` (wie die
toSessionSummary-Brücke). Texte: Intro erklärt Zeitmodell + Serien,
Zwischenstand/Endscreen zeigen Punktsummen statt „/100".

⚠️ **Bekannt & gewollt bis E5:** `submitCupRun` läuft gegen den DB-Check
`cup_runs.total_score between 0 and 100` — Cup-Rohsummen > 100 werden vom
Server abgelehnt (Submit scheitert still, lokale Wertung intakt). Die
E5-Migration ersetzt den Check.

Browser-verifiziert: Intro-Text, Leg 1 Flaggen mit 30-s-Budget, Zeitablauf →
Interstitial („+100 Punkte", „Zwischenstand: 100 Punkte"), Leg 2 Hauptstädte
mit frischem Budget. Suite 75/75, tsc + oxlint sauber (das alte
CupScreen-Lint-Warning ist durch den Umbau weg).

**Nächster Schritt E5:** DB-Migration + Leaderboard-Umbau — `score_entries`/
`cup_runs`-Checks & Plausibilitäts-Trigger ersetzen, Views auf Rohpunkte +
Bestleistung pro Spieler (DESIGN-SOCIAL S1), Modus-Auswahl im Global-Tab,
`SessionSummary`/`toSessionSummary`-Interim ablösen, Alt-Scores-Entscheidung
(leeren vs. markieren) beim Nutzer einholen.

### E3 ✅ — Hook + `ArcadeQuizView` (2026-07-12)

Neu: `frontend/src/hooks/useArcadeSession.ts` (React-Anbindung der Engine) und
`frontend/src/components/ArcadeQuizView.tsx` (zeitbasierte Ansicht inkl.
`ArcadeSummaryView`). `PlayScreen` nutzt sie für alle 6 Einzelmodi. CSS-Zusätze
in `index.css`: `.arcade-clock`, `.time-pop` (+5-SEC-Effekt).

**Entscheidungen/Details:**

- Engine um `prepareNext()` erweitert (Vorziehen ohne Uhr-Start) — Grundlage für
  den unsichtbaren Foto-Preload; `next()`/`start()` decken die vorbereitete
  Frage atomar auf. Preload-Timeout 4 s (`PRELOAD_TIMEOUT_MS`), damit ein
  kaputtes Bild den Start nie blockiert.
- Alte `QuizView` + `useQuizSession` + `scoring.ts` bleiben BESTEHEN: Training
  (dauerhaft, „unverändert" lt. Kernregeln) und Cup (bis E4) laufen darüber.
- **Bugfix:** `PlayScreen` braucht `key={mode:runKey}` — bei Mode-Wechsel über
  die Route (`/play/flags` → `/play/city-pin`) blieb sonst die alte Session
  samt Timer aktiv (im Browser gefunden).
- Interim-Brücke `toSessionSummary()` (in useArcadeSession.ts): füllt das alte
  Format mit `maxPossible = score` (Prozent-Anzeigen zeigen 100 %) — wird in
  E4/E5 ersetzt. PlayScreen submittet keine Runden mit 0 Antworten.
  ⚠️ Für E5 vorgemerkt: der alte DB-Trigger (`max_possible ≤ question_count × 225`)
  lehnt sehr hohe Arcade-Scores ab — Submits scheitern dann still, bis die
  Migration da ist.
- Choice-Feedback 1200 ms, rückt erst weiter, wenn die Folgefrage vorbereitet
  ist (`nextReady`); Pin-„Weiter"-Button zeigt bis dahin „LADE…".
- Streak-Badge ab Streak ≥ 1: `⚡/🔥 {streak (de-DE, 1 Dezimale)} · {multiplier %}`.
- Ergebnisscreen rankt nach Trefferquote (S ab 90 % und ≥ 5 Fragen).

**Browser-Verifikation (Dev-Server, 2026-07-12):** Countdown + Balken laufen;
2. richtige Antwort gab 110 Punkte (Score 210, Badge „⚡ 2 · 120%"); Pin-Feedback
zeigte „VÖLLIG VERPEILT / 1206 km daneben / +0"; Uhr stand während 4 s Feedback
nachweislich still; Zeitablauf führte sauber zum Ergebnisscreen; Konsole ohne
Fehler; Tests 75/75, `tsc -b` und oxlint ohne neue Findings.

**Nächster Schritt E4:** `CupScreen` auf `ArcadeQuizView` mit `budgetMs =
CUP_LEG_SECONDS × 1000` umstellen, `CUP_QUESTIONS_PER_LEG` raus, Cup-Total =
Rohsumme; danach alte `QuizView`-Reste prüfen (Training behält sie).

### E2 ✅ — `arcadeSession.ts` (2026-07-12)

Klasse `ArcadeSession` in `frontend/src/features/quiz-engine/arcadeSession.ts`
+ 12 Tests (Suite 72/72 grün, `tsc -b` sauber). Framework-frei mit injizierbarer
Uhr (`now()`) — E3 wrappt sie in einen React-Hook, Phase D nutzt denselben Code
in der Edge Function.

**API & Semantik (bindend für E3):**

- Konfig: `{ mode, budgetMs, nextQuestion(usedIds), now? }`. Fragenquelle liefert
  `null` bei erschöpftem Pool → Session endet. Standardquelle:
  `makeGeneratorSource(mode, dataBundle)` (No-Repeat, 100 Versuche).
- Phasen: `idle → question ⇄ feedback → done`. `start()` deckt die erste Frage
  auf; Uhr startet atomar mit dem Aufdecken (Pausen-Regel 1 — die UI darf
  Inhalte erst zeigen, wenn `phase === 'question'`; Preload in der Feedback-Pause).
- `remainingMs()` tickt NUR in `question`-Phase (Wanduhr-Differenz). Feedback ist
  budgetneutral. Zu spät eintreffende Antworten (Budget schon leer, z. B. App
  weggedrückt) geben `null` zurück und beenden die Session — Pausen-Regel 2.
- `answerChoice(index|null)` / `answerPin(distanceKm|null)` → `ArcadeAnswerFeedback`
  mit `points`, `streakBefore/After`, `reclaimedSeconds` (>0 = „+5 SEC!"-Effekt
  anzeigen), `tier` (Pin-Label via `tier.label`). Kein Pin gesetzt = VERPEILT.
  Die UI berechnet die Distanz (haversine) und übergibt nur km.
- Rückholungen erhöhen das Budget sofort (`remainingMs()` springt hoch).
- Pin-`correct` fürs Lern-Tracking (progressStore): Stufe VOLLTREFFER/STARK — seit dem R3-Rebalancing (2026-07-15) ≤ 350 km (`PIN_CORRECT_MAX_KM`).
- `forceTimeUp()`: UI-Anzeige bei 0 → beendet nur, wenn das Budget wirklich leer
  ist (verhindert Drift zwischen Anzeige und Engine).
- `summary()` → `ArcadeSummary { mode, score, questionCount, correctCount,
  bestStreak, playedMs (nur aktive Zeit), timeAddedSeconds, answers }` —
  Mapping auf DB/`SessionSummary` passiert in E4/E5.

**Nächster Schritt E3:** React-Hook um `ArcadeSession` (Tick-Interval nur für die
Anzeige), QuizView-Umbau: Countdown statt Fragen-Zähler, Streak/Multiplikator-HUD,
„+5 SEC!"-Effekt, Tier-Labels aus `PIN_TIERS`, Foto-Preload in der Feedback-Pause.
Training läuft weiter über den alten `useQuizSession`-Pfad, bis E3 abgeschlossen
ist; danach `scoring.ts`-Reste aufräumen.

### E1 ✅ — `arcadeScoring.ts` (2026-07-12)

Neues Modul `frontend/src/features/quiz-engine/arcadeScoring.ts` + Tests
(21 Stück, Suite 60/60 grün). Bewusst **neben** dem alten `scoring.ts` angelegt —
die App kompiliert unverändert weiter; `scoring.ts` wird in E2/E3 gelöscht,
sobald `QuizView`/Session-Engine auf die neue API umgestellt sind.

**API-Konventionen (bindend für E2/E3):**

- `streakMultiplier(streak)` = `1 + streak × 0.1`, unbegrenzt. Der Multiplikator
  nutzt die Streak **VOR** der aktuellen Antwort (Streak 7 → nächste Antwort 170 Pkt).
- Streaks werden nach **jedem** Update via `roundStreak()` auf eine Nachkommastelle
  gerundet (Float-Drift-Schutz). Nie ungerundete Streaks speichern.
- `scoreChoiceArcade(correct, streak)` / `scorePinArcade(distanceKm, streak)` →
  Punkte; `nextStreakChoice` / `nextStreakPin` → neue Streak (Fehlstufe bricht auf 0).
- `PIN_TIERS` (inkl. Labels, Punkte, Streak-Deltas) ist die einzige Quelle für
  die Stufen — UI liest Labels von dort (`pinTierFor(km)`).
- `reclaimedSeconds(prev, next)` → 0 oder n × 5 s; zählt überschrittene volle
  Zehner, bei Streak-Verlust immer 0.
- Konstanten: `SESSION_SECONDS = 60`, `CUP_LEG_SECONDS = 30`,
  `RECLAIM_EVERY = 10`, `RECLAIM_SECONDS = 5`, `BASE_POINTS = 100`.

**Nächster Schritt E2:** Session-Engine — globaler Timer (Wanduhr via `Date.now()`,
Pausen-Regeln oben beachten!), No-Repeat-Sampler, Training unverändert.

---

## Verlauf

| Datum | Eintrag |
|---|---|
| 2026-07-12 | Pausen-Regeln zu O4 ergänzt (Nutzer-Einwand: Pause darf nicht schummelbar sein): atomares Aufdecken mit Uhr-Start + Preload, Wanduhr-Messung bei aktiver Frage, Server-Backstop in Phase D. In Roadmap-Schritt E2 übernommen |
| 2026-07-12 | Alle offenen Punkte O1–O6 im Chat entschieden: einheitliche Pin-Stufen, Streak unbegrenzt, +5 s automatisch, Uhr pausiert bei Feedback, Zeitbonus gestrichen, Pools ausreichend. Umbau als Phase E in die Roadmap überführt |
| 2026-07-12 | Dokument angelegt: Kernregeln aus erstem Design-Gespräch fixiert, offene Punkte O1–O6 gesammelt |
