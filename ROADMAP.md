# 🗺️ Roadmap — GeoQuiz

> Die nächsten Phasen als abhakbarer Plan. Bei jedem erledigten Schritt: Status hier umstellen **und** einen Eintrag im [Verlauf](#verlauf) ergänzen.
> Abgeschlossene Phasen 0–4 sind in [STATUS.md](STATUS.md) dokumentiert.

Legende: ⬜ offen · 🔄 in Arbeit · ✅ fertig · ⚠️ blockiert (Grund in Notiz) · ⏭️ übersprungen

---

## Phase A — Web-Deployment 🚀

*Ziel: Das Spiel ist unter einer öffentlichen URL vom Handy aus spielbar. Geringster Aufwand, sofortiger Nutzen — und ein realer Mobile-Test vor dem Android-Aufwand.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| A1 | Hosting-Entscheidung (Cloudflare Pages / GitHub Pages / Netlify) | ✅ | **Cloudflare Pages** (Nutzer-Entscheid 2026-07-14): Git-Integration, Build-Env-Vars, schnelles CDN, kein Traffic-Limit im Free Tier. Prod-Build lokal verifiziert (292 KB gzip JS), HashRouter → keine Redirect-Config nötig |
| A2 | Build-Env am Host konfigurieren (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | ✅ | Entfällt beim gewählten Direct-Upload-Flow: gebaut wird lokal, die Werte kommen aus `frontend/.env.local` (Anon-Key ist öffentlich) |
| A3 | Deploy einrichten | ✅ | **Direct Upload statt Git-Integration** (Dashboard-Git-Flow war 2026 unbrauchbar versteckt): `npm run deploy` in `frontend/` baut und deployt per Wrangler CLI (`wrangler login` einmalig). Live: https://geo-quiz-a6s.pages.dev — Achtung: Push deployt NICHT automatisch, nach Releases `npm run deploy` ausführen |
| A4 | Supabase-Auth-Konfiguration: Site-URL + Redirect-URLs auf die neue Domain | ⬜ | Wichtig für die Bestätigungs-Mail des Account-Upgrades — Dashboard → Authentication → URL Configuration: Site-URL `https://geo-quiz-a6s.pages.dev`, Redirect-URLs ergänzen (localhost:5173 drinlassen) |
| A4b | Auth-Mails eindeutschen — **bewusst aufgeschoben bis zum echten Public-Launch** (Nutzer-Entscheid 2026-07-12; bis dahin bleiben die englischen Supabase-Standard-Mails). Dann: Custom SMTP einrichten (Pflicht — Templates sind beim eingebauten Versand gesperrt), Templates aus [supabase/email-templates.md](supabase/email-templates.md) einfügen (v. a. „Change email address") | ⬜ | Alles vorbereitet, Setup-Anleitung in der Template-Datei. Absender dann am besten direkt über die eigene Domain (fällt mit A1/A7 an) statt Zwischenschritt Gmail |
| A5 | Smoke-Test Desktop: alle 8 Modi einmal anspielen, Anmeldung, Leaderboard | 🔄 | Basis-Check live bestanden (Seite lädt, ● ONLINE, Konsole sauber); vollständiger Modi-Durchlauf durch den Menschen offen |
| A6 | Smoke-Test Handy (echtes Gerät): Touch auf Leaflet-Pins, Umriss-Karte, Lesbarkeit der Pixel-Fonts | ⬜ | Erster echter Mobile-Praxistest — Erkenntnisse fließen in Phase B; jetzt einfach die Live-URL am Handy öffnen |
| A7 | Live-URL in README + GitHub-About eintragen | ✅ | README-Kopf verlinkt https://geo-quiz-a6s.pages.dev; GitHub-Homepage per `gh repo edit` gesetzt |

**Fertig-Kriterium:** Eine fremde Person kann die URL öffnen, sofort spielen und sich optional registrieren.

---

## Phase B — Android-App (Capacitor) 🤖

*Ziel: Installierbare Android-App mit zuverlässiger Session-Persistenz. Voraussetzung: Phase A abgeschlossen (Mobile-Erkenntnisse) und Android Studio installiert.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| B1 | **Voraussetzung (manuell):** Android Studio + SDK installieren | ✅ | CLI-only statt volle IDE: Temurin JDK 21 (winget) + Android-SDK-Kommandozeilentools (`platform-tools`, `platforms;android-34`, `build-tools;34.0.0`) nach `C:\Android\sdk`. `JAVA_HOME`/`ANDROID_HOME` persistent gesetzt |
| B2 | Capacitor einrichten: `@capacitor/core` + `cap init` (App-ID z. B. `de.tobsob.geoquiz`) | ✅ | App-ID `de.tobsob.geoquiz`, `capacitor.config.ts` |
| B3 | `npx cap add android` — Android-Projekt generieren | ✅ | `android/` im Repo; Debug-Build (`gradlew assembleDebug`) erfolgreich verifiziert |
| B4 | Supabase-Session auf Capacitor-Storage-Adapter umstellen (Preferences-Plugin statt localStorage) | ✅ | `@capacitor/preferences` als `auth.storage` in `supabaseClient.ts`; im Emulator E2E verifiziert: anonyme Identität (`ATOMIC_YETI_90`) überlebt `force-stop` + Neustart. Web unverändert (Preferences fällt dort auf localStorage zurück) |
| B5 | Emulator-Test: alle Modi, Fokus Karten (Pan/Zoom/Tap-Präzision, Stress-Test kleine Länder wie Luxemburg) | 🔄 | AVD `geoquiz_pixel7` (Pixel 7, Android 14) eingerichtet, APK installiert; Flaggen + Profil + Online-Anmeldung getestet. Erstes Pin-Modus-Feedback führte zum Vollbild-Umbau (siehe Verlauf 2026-07-11); Portrait + Landscape im Emulator verifiziert. `frontend/.env.local` mit neuem `sb_publishable`-Key wiederhergestellt. Offen: finaler Praxistest der Pin-Präzision durch den Menschen |
| B6 | Test auf echtem Gerät (`npx cap run android`) | ⬜ | braucht USB-Debugging |
| B7 | App-Icon + Splash-Screen im 8-Bit-Look | ⬜ | `@capacitor/assets` generiert alle Größen aus einer Vorlage |
| B8 | Signierter Release-Build (`.aab`/`.apk`) | ⬜ | Keystore anlegen und **sicher verwahren** — Play-Store-Upload optional/später |

**Fertig-Kriterium:** App startet auf einem echten Gerät, anonyme Session überlebt Neustart, Karten sind präzise bedienbar.

---

## Phase C — Polish ✨

*Ziel: Das „richtig gut"-Finish. Reihenfolge nach Impact sortiert, Punkte sind unabhängig voneinander abhakbar.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| C1 | 8-Bit-Sound-Effekte via WebAudio (richtig/falsch/Streak/Bullseye/Cup-Fanfare) + Mute-Toggle | ✅ | `features/audio/sfx.ts`: Oszillator-Synthese ohne Assets — richtig (Blips hoch), falsch (Sägezahn runter), VOLLTREFFER (C-Dur-Arpeggio), +5 SEC (Münz-Jingle), Countdown-Tick/GO, Fanfare (Runden-/Cup-Ende); auch Training (alter Pfad) hat richtig/falsch. Mute-Toggle 🔊/🔇 im Header, persistiert (`settingsStore`, localStorage `geo-quiz-settings`). AudioContext lazy nach User-Geste (Autoplay-Policy) |
| C2 | Code-Splitting: Leaflet + Topojson lazy laden (`React.lazy` pro Route) | ⬜ | Bundle aktuell ~700 KB JS; Ziel: < 300 KB initial |
| C3 | Haptics auf Android (`@capacitor/haptics` bei richtig/falsch) | ⬜ | erst nach Phase B sinnvoll |
| C4 | Screen-Übergänge + Feedback-Animationen verfeinern (steps()-Transitions, Konfetti-Pixel bei Rang S) | ⬜ | |
| C5 | PWA-Manifest + Service Worker (installierbar am Handy, echtes Offline-Caching) | ⬜ | günstige Alternative/Ergänzung zur Android-App |
| C6 | Cup-Ergebnis: Balken-Breakdown pro Disziplin statt nur Tabelle | ⬜ | |
| C7 | `npm audit`-Findings prüfen (5 high, transitiv) | ⬜ | vermutlich Dev-Dependencies — prüfen, ob Runtime betroffen |

---

## Phase E — Arcade-Umbau der Spielmodi 🕹️

> **Reihenfolge-Hinweis:** Phase E kommt **vor** Phase D — die neue Scoring-Engine wird danach direkt serverfähig portiert statt zweimal gebaut.

*Ziel: Alle Modi außer Training werden zeitbasiert („feste Zeit, so viele Fragen wie du schaffst"). Regelwerk vollständig entschieden und begründet in [DESIGN-ARCADE.md](DESIGN-ARCADE.md): 60 s Einzelmodi / 30 s Cup-Legs, 100 Basispunkte × unbegrenzter Streak-Multiplikator (+10 %/Punkt), Pin-Distanzstufen 100/200/500/1000 km mit Retro-Labels und Bruchteil-Streaks, +5 s automatisch je 10 volle Streak-Punkte, Uhr pausiert bei Feedback, kein Punkte-Zeitbonus mehr.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| E1 | Scoring-Engine neu: 100 × Streak-Multiplikator, Distanzstufen statt Exponentialkurve, Bruchteil-Streaks (+1 / +0,5 / +0,1 / +0), Rückhol-Logik (ganze Zehner → +5 s) | ✅ | Neues Modul `arcadeScoring.ts` + `arcadeScoring.test.ts` (21 Tests, Suite komplett grün: 60/60). Liegt NEBEN dem alten `scoring.ts` — App kompiliert unverändert; altes Modul + Konstanten (`MAX_TIME_BONUS`, `falloffKm`, `MAX_CHOICE_SCORE`) fliegen in E2/E3 raus, wenn die Aufrufer umgestellt sind. API-Konventionen: DESIGN-ARCADE „Umsetzungs-Log" |
| E2 | Session-Engine: globaler 60-s-Timer statt `timeLimitMs` pro Frage, Uhr läuft nur bei aktiver Frage, Fragen-Nachschub ohne Wiederholung innerhalb der Session | ✅ | `arcadeSession.ts` (Klasse `ArcadeSession`, framework-frei, injizierbare Uhr) + 12 Tests (Suite 72/72 grün, tsc sauber). Pausen-Regeln umgesetzt: Budget tickt nur bei aktiver Frage, Wanduhr-Messung (zu späte Antwort = ungültig + Session-Ende), Rückholungen verlängern Budget. `makeGeneratorSource()` = No-Repeat-Quelle. React-Anbindung + UI = E3; Details im Umsetzungs-Log (DESIGN-ARCADE) |
| E3 | UI-Umbau: Countdown prominent, Streak/Multiplikator-HUD, „+5 SEC!"-Effekt, Distanzstufen-Feedback mit Retro-Labels | ✅ | Neu: `useArcadeSession.ts` (Hook um die Engine, Foto-Preload, Anzeige-Tick) + `ArcadeQuizView.tsx` (eigene Ansicht; alte `QuizView` bleibt für Training + Cup bis E4). `PlayScreen` umgestellt (Session-Key = Mode+RunKey — Bugfix: Mode-Wechsel erzeugte sonst keine frische Session). Im Browser E2E verifiziert: Countdown, 100→110-Punkte-Multiplikator, Streak-Badge „⚡ 2 · 120%", Tier-Feedback „VÖLLIG VERPEILT +0", Uhr eingefroren im Feedback, Zeitablauf → Ergebnisscreen. Tests 75/75, tsc + lint sauber. Details: Umsetzungs-Log |
| E4 | Cup umstellen: 30-s-Legs statt 5 Fragen (`CUP_QUESTIONS_PER_LEG` entfällt), Cup-Total = Rohsumme statt 0–100-Prozentwert | ✅ | `CupScreen` auf `ArcadeQuizView` (`budgetMs = CUP_LEG_SECONDS`), `cupScore()` = Rohsumme (eigener Test), `cupTotalScore` aus `scoring.ts` entfernt, `showSummary`-Prop ergänzt, Intro/Zwischenstand/Endscreen-Texte auf Punktsumme. Browser-verifiziert: Intro → Leg 1 (30 s) → Zeitablauf → Interstitial „+100 / Zwischenstand 100 Punkte" → Leg 2 mit frischem Budget. Tests 75/75, tsc + lint sauber. ⚠️ `submitCupRun` scheitert bei Rohsummen > 100 am alten DB-Check — behoben in E5 |
| E5 | DB-Migration: `cup_runs.total_score`-Check (0–100) ersetzen, Leaderboard-Views auf Rohpunkte statt `percent` sortieren, **Bestleistung pro Spieler** (S1) + **Zeitfilter Woche/Monat/Jahr/Alle** (Nutzer-Wunsch), `max_possible`-Semantik geklärt (Spalte bleibt, Client schreibt Score; Ablösung in Phase D). UI: Modus-Auswahl im Global-Tab + Zeitraum-Picker (Global & Cups), Lokal-Tab auf Rohpunkte | ✅ | Migration `0005_arcade_scoring.sql`: löscht Alt-Einträge (Nutzer-Entscheid), ersetzt Views durch RPCs `get_leaderboard_scores/cups(mode, since, limit)` (security definer, nur `authenticated`), neuer Trigger (400 ms/Frage, max. 10 min, Score ≤ 100n+5n(n−1)). **0005 auf Live-DB verifiziert (2026-07-12: RPC existiert, Gating greift)** — Achtung: 0005 nie erneut ausführen, der `delete`-Block würde neue Scores löschen |
| E6 | Balancing-Runde auf echtem Gerät: Fragen/Minute pro Modus messen, Stufen-Gefühl bei Pins prüfen, Label-Feinschliff | ✅ | Drei Playtest-Runden umgesetzt (2026-07-14/15, siehe Verlauf): Pin-Zonen auf **100/350/1000/2500 km** erweitert (Nutzer-Entscheid), VOLLTREFFER gibt **+3 s** zurück, „correct"-Grenze ≤ 350 km; Anti-Tasten-Spam als unsichtbare Mindestzeit 0,5 s/Frage (sichtbare Strafsekunden nach Feedback wieder verworfen); Choice-Layout ohne Scrollen (Flagge/Umriss skalieren mit Fensterhöhe); Training komplett neu (Setup: Kategorien + Endlos/10/25, ohne Zeitdruck) |

**Fertig-Kriterium:** Alle Modi außer Training laufen zeitbasiert nach dem neuen Regelwerk, Leaderboards zeigen Rohpunkte, Cup funktioniert mit 30-s-Legs — verifiziert auf einem echten Gerät.

---

## Phase F — Freundesgruppen 👥

> **Reihenfolge-Hinweis:** nach Phase E, vor Phase D (entschieden in [DESIGN-SOCIAL.md](DESIGN-SOCIAL.md) S3).

*Ziel: Gruppe erstellen, retro-lesbaren Beitrittscode teilen (z. B. `TURBO-YETI-83`), Mitglieder vergleichen sich in einer gefilterten Bestenliste (Bestleistung pro Mitglied). Nur für registrierte Accounts, Verwaltung minimal (Ersteller löscht, jeder kann austreten). Vollständiges Konzept in [DESIGN-SOCIAL.md](DESIGN-SOCIAL.md).*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| F1 | DB-Migration: `friend_groups` + `friend_group_members`, RLS, Limits (50 Mitglieder/Gruppe, 12 Gruppen/Spieler) | ✅ | `0006_friend_groups.sql`; RLS-Rekursion via security-definer-Helper `is_group_member()` gelöst; nur Select-Policies — Mutationen ausschließlich per RPC |
| F2 | RPCs: `create_group(name)`, `join_group(code)`, `leave_group`, `delete_group`, `list_my_groups` | ✅ | Codes `WORT-TIER-9999` (~1,4 Mio. Kombinationen) + Rate-Limit 20 Beitrittsversuche/h (`group_join_attempts`) — Durchprobieren aussichtslos. Execute nur für `authenticated` |
| F3 | Gruppen-Bestenliste: Leaderboard-RPCs um `p_group` erweitert (Bestleistung je Mitglied) | ✅ | Signaturwechsel → alte Funktionen gedroppt; Nicht-Mitglieder bekommen leere Liste |
| F4 | Profil-UI: Abschnitt „Freundesgruppen" — erstellen, Code teilen (Share-Sheet/Clipboard), beitreten, Liste mit Mitgliederzahl, verlassen/löschen mit Rückfrage | ✅ | `groupApi.ts` mit deutschen Fehlermeldungen; Panel nur für registrierte Accounts |
| F5 | Bestenlisten-UI: Umschalter „🌍 Global / 👥 Gruppe" im Global- und Cup-Tab | ✅ | Erscheint erst, wenn man Gruppen hat |
| F6 | E2E-Test mit zwei Accounts (zweites Gerät/Emulator): erstellen, beitreten, Scores vergleichen, austreten, löschen | ✅ | Vom Nutzer real getestet (2026-07-12): Gruppenflow funktioniert. **Phase F damit abgeschlossen** |

**Fertig-Kriterium:** Zwei echte Accounts können über einen geteilten Code in einer Gruppe landen und ihre Bestleistungen pro Modus vergleichen.

---

## Phase D — Anti-Cheat: Server-autoritatives Scoring 🛡️

> **Reihenfolge-Hinweis:** startet erst nach den Phasen E und F (siehe dort).

*Ziel: Der Client kann über den Spielverlauf nicht mehr lügen — Scores entstehen serverseitig (Edge Function als Spielleiter), nicht mehr per Client-Insert. Bewusste Grenze: Ein Bot, der Antworten nachschlägt, bleibt prinzipbedingt ununterscheidbar von einem sehr guten Spieler; Ziel ist „nicht belügbar", nicht „unschlagbar". Offline-/Trainingsmodus behält den lokalen Pfad.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| D1 | **Stufe 1 (Zwischenschritt mit Sofortnutzen):** `start_session()`-RPC mit serverseitigem Startzeitstempel; Score-Abgabe als RPC, die reale Serverzeit gegen `duration_ms` prüft; direkten Insert auf `score_entries`/`cup_runs` entzogen | ✅ | Migration `0007_session_guard.sql`: `play_sessions`-Wanduhrkonto (started_at + consumed_ms — behauptete Spielzeit muss real vergangen sein; Cup teilt sich EIN Konto über alle 6 Legs, Start nur beim ersten Leg), Session-Verfall nach 30 min, alter Plausibilitäts-Trigger läuft als zweite Schicht weiter. Client: `submit_score`/`submit_cup_run`-RPCs + `startPlaySession()` in PlayScreen (je Runde/Replay) und CupScreen (Cup-Start). **⚠️ 0007 noch auf Live-DB einspielen (`apply_pending.sql`)** |
| D2 | Rate-Limit: max. Scores pro User/Stunde (Check in der Abgabe-RPC) | ✅ | In 0007 enthalten: 30 Einzel-Scores/h, 6 Cup-Runs/h (Cup braucht Luft: 1 Cup = 1 Run + 6 Leg-Scores) |
| D3 | Quiz-Engine serverfähig machen: `questionGenerator`/`scoring` in ein von Web + Edge Function geteiltes Paket extrahieren (inkl. Distanz-Scoring der Pin-Modi) | ⬜ | Deno-kompatibel halten (keine DOM-/Node-APIs im Kern); Länderdaten mitliefern |
| D4 | Edge Function `quiz-session`: erzeugt Fragerunde aus Seed, richtige Antworten bleiben serverseitig (nur Session-ID + Fragen ohne Lösungen an den Client) | ⬜ | Session-State in eigener Tabelle (`quiz_sessions`), ablaufend nach z. B. 30 min |
| D5 | Antwort-Endpoint: Client schickt pro Frage nur die Antwort, Server bewertet, misst Zeit pro Frage und schreibt am Ende selbst den Score (`score_entries`-Insert nur noch durch die Function) | ⬜ | Antwort-Latenz tolerant handhaben (Netzwerk-Jitter ≠ Bedenkzeit); Cup-Runs mitdenken |
| D6 | Client-Umbau: Online-Modi laufen über die Session-API, Offline/Training weiter lokal; sauberes Fallback bei Netzabriss mitten in der Runde (Runde verwerfen oder lokal weiterspielen, kein halber Online-Score) | ⬜ | |
| D7 | Ausreißer-Sicht für Moderation: Admin-Query/View für statistische Anomalien (100 %-Runs nahe Zeitminimum, Score-Frequenz) + Weg, Einträge vom Leaderboard zu entfernen | ⬜ | „Erkennen statt verhindern" als letzte Schicht |

**Fertig-Kriterium:** Kein Weg mehr, einen Leaderboard-Score einzutragen, dessen Punktzahl der Client selbst berechnet hat; D1 wirkt bereits vorab als eigenständige Hürde.

---

## Phase G — Gamification 🏅

> **Reihenfolge-Hinweis:** unabhängig von D3–D7 umsetzbar, setzt aber das Einspielen von Migration 0007 voraus (0008 baut auf den 0007-RPCs auf).

*Ziel: Abzeichen in 5 Stufen (Normal/Bronze/Silber/Gold/Diamant) mit witzigen Untertiteln je Stufe, Pokale für Wochen-/Monats-/Jahresbeste im Cup-Modus (Hall of Fame), XP + Level (Cap 99) inkl. Level-Bestenliste (global + Gruppen). Speicherung serverseitig, account-gebunden; rückwirkender Backfill. Vollständiges Konzept in [DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md).*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| G1 | DB-Migration `0008_gamification.sql`: `player_stats`, `badge_definitions` (Seed), `player_badges`, `cup_trophies`; `submit_score`/`submit_cup_run` neu (Unlock-Payload als jsonb, 3 neue defaultete Parameter), `award_badges()`, `finalize_cup_trophies()` (lazy, kein pg_cron), `get_cup_trophies`, `get_gamification`, `get_leaderboard_levels`; Backfill inkl. rückwirkender Pokale | ✅ | Code komplett; Reihenfolge in `apply_pending.sql` zwingend 0007 → 0008. **Auf Live-DB noch nicht eingespielt (G5)** |
| G2 | Frontend-Fundament: `features/gamification/` (Level-Kurve + Badge-Katalog mit Tests), `api/gamificationApi.ts`, `state/gamificationStore.ts`, `scoreApi` auf Unlock-Payload | ✅ | Katalog-Test pinnt Schwellen gegen den SQL-Seed |
| G3 | UI: Erfolge-Screen (`/achievements`, Tabs Abzeichen/Pokale/Level), LV-Chip im Header, Menüpunkt, Level-Tab in der Bestenliste (Global/Gruppe) | ✅ | Gast-Teaser mit eigenem Text |
| G4 | Unlock-Anzeige am Rundenende (+XP, LEVEL UP, neue Badges mit Spruch) + `sfx.levelup()` | ✅ | `UnlockPanel` im Runden-Summary und Cup-Endscreen |
| G5 | Verifikation: Tests/tsc/lint, Browser-E2E, Migration auf Live-DB (`apply_pending.sql`), SQL-Idempotenz-Checks | ✅ | 0007+0008 live (2026-07-14), Account-E2E bestätigt: Backfill (LV 6, 8/16 Badges, rückwirkender Wochen-Pokal), Unlock-Panel mit LEVEL UP, Level-Bestenliste. Test-Bot-Runde rückstandslos entfernt |
| G6 | Pokale auf **Top 3** umstellen (Nutzer-Wunsch): `cup_trophies.rank`, XP-Staffel 200/100/50 (Woche), 500/250/125 (Monat), 1500/750/375 (Jahr), Nachvergabe alter Perioden, UI mit 🥇/🥈/🥉 | ✅ | 0009 auf Live-DB verifiziert (2026-07-14): `rank` kommt in beiden Lese-RPCs an, Finalisierung idempotent (kein XP-Doppel), Nachvergabe korrekt leer (KW 28 hatte nur einen Cup-Spieler). **Phase G damit abgeschlossen** |

**Fertig-Kriterium:** Eine gespielte Runde zeigt XP-Gewinn und neue Abzeichen, der Erfolge-Screen führt Abzeichen/Pokale/Level, abgelaufene Cup-Perioden erzeugen Pokale in der Hall of Fame, die Level-Bestenliste funktioniert global und in Gruppen.

---

## Phase H — Avatare & Spielerkarten 🎭

*Ziel: Wählbare 8-Bit-Pixel-Avatare (GB-Trainer-Stil), Spielerkarte mit Erfolgen/Bestpunkten, Avatare in der Bestenliste. Vollständiges Regelwerk in [DESIGN-AVATARS.md](DESIGN-AVATARS.md).*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| H1 | Avatar-Katalog (prozedurale 16×16-Sprites) + Renderer + Picker im Profil + `avatarStore` | ✅ | 21 Avatare: 2 Starter (Junge, Mädchen), 19 freischaltbar über eine durchgehende Level-Kurve 3–40 (u. a. Kanarienvögel Sora/Riku, Prinzessin Mira, Superheld) bzw. Abzeichen/Pokal; Prestige „Geologe" bei allen 16 Abzeichen auf Diamant. Picker sortiert nach Freischalt-Schwierigkeit (`AVATARS_BY_LEVEL`). Gäste können nichts freischalten (Picker: „Nur mit Account"). Zwei Grafik-Iterationen (flache Icons → geschattete GB-Sprites), Starter-Umfang in R6 von 8 auf 2 reduziert (Nutzer-Entscheid, mehr Fortschrittsgefühl) |
| H2 | Avatar in Header (mit Verbindungsstatus-Punkt statt „● ONLINE"-Text), Spielerkarte (`PlayerCard`: Level/XP, Erfolgs-Embleme, Bestpunkte) + Overlay beim Klick auf die eigene Bestenlisten-Zeile, Cup-Punkte-Hover in „Meine Rekorde" | ✅ | Header dadurch mobil-tauglich (kein Überlauf bei 375 px) |
| H3 | Migration `0010_profile_avatars.sql`: `profiles.avatar_id` + Nur-Lese-RPC `get_profile_avatars(names[])`; Client-Sync (`avatarApi.ts`): Auswahl → Profil, Login-Reconcile, Bestenlisten-Zeilen aller Spieler mit Avatar | ✅ | Additiv — Leaderboard-RPCs unangetastet; Client läuft ohne Migration graceful (nur ohne fremde Avatare) |
| H4 | **Migrationen 0010–0012 auf Live-DB einspielen** | ⬜ | Danach erscheinen fremde Avatare, der Cup-Aufklapp-Button und echte fremde Spielerkarten; alle drei Dateien auch ans Ende von `apply_all.sql` angehängt |
| H5 | Spielerkarten fremder Accounts (Embleme/Bestpunkte anderer beim Klick) | ✅ | Bug-Fix (R8, Nutzer-Report): Migration `0012_player_card.sql` (`get_player_card(display_name)`), `PlayerCard` in `PlayerCardView` (Anzeige) + Datenquellen (eigen/fremd) aufgeteilt, jede Bestenlisten-Zeile klickbar. „Karten-Skins" bleibt offen (DESIGN-AVATARS A3) |
| H6 | Cup-Bestenliste: Klick auf den Score klappt die Punkte je Disziplin auf (Nutzer-Wunsch) | ✅ | Migration `0011_cup_leg_breakdown.sql` (`get_leaderboard_cups` + `cup_run_id`, neue RPC `get_cup_run_legs`); `CupScoreButton`/`CupLegBreakdownRow` in ScoresScreen.tsx, graceful ohne Migration (reiner Text statt Button). Details: DESIGN-AVATARS V9 |
| H7 | **Bug-Fix:** Disziplin-Reihenfolge im Cup-Aufklapp war zufällig (Parallel-Submit-Timing) | ✅ | Migration `0013_cup_leg_order.sql`: `get_cup_run_legs` sortiert jetzt fest nach der echten Cup-Reihenfolge. Reiner SQL-Fix, kein Frontend-Redeploy nötig |

**Fertig-Kriterium:** Jeder Spieler in der globalen Bestenliste ist an seinem Pixel-Avatar erkennbar; ein Klick auf eine Zeile zeigt DIESER Person Karte (Level, Embleme, Bestpunkte); die Cup-Bestenliste zeigt auf Klick die Punkte je Disziplin.

---

## Ideen-Parkplatz (unpriorisiert)

- Duell-Modus (asynchron: gleicher Fragen-Seed, Ergebnis vergleichen)
- Tages-Challenge (deterministischer Seed pro Datum, eigenes Leaderboard)
- Schwierigkeitsstufen (Fragenpool nach Population/Bekanntheit filtern)
- Statistik-Screen (Lernkurve, schwächste Regionen als Heatmap)
- i18n (Datenmodell hat bereits `name`/`nameDe` — UI-Strings extrahieren)

---

## Verlauf

*Neueste Einträge oben. Format: Datum — was wurde erledigt/entschieden.*

| Datum | Eintrag |
|---|---|
| 2026-07-16 | Bug-Fix R9: Disziplinen im aufgeklappten Cup-Score erschienen zufällig sortiert (Ursache: `submitCupRun` schickt alle 6 Legs parallel, Einfüge-Reihenfolge in `score_entries` hängt vom Timing ab). Migration `0013_cup_leg_order.sql` sortiert `get_cup_run_legs` jetzt fest nach Cup-Reihenfolge. Reiner SQL-Fix |
| 2026-07-16 | Playtest R8 (Bug-Report): Klick auf eine fremde Bestenlisten-Zeile öffnete immer die eigene Karte. Neue Migration `0012_player_card.sql` (name-basierte RPC `get_player_card`, liefert XP/Abzeichen/Bestpunkte je Modus + Cup-Bestwert für jeden registrierten Account); `PlayerCard` in Anzeige- (`PlayerCardView`) und Datenquellen-Komponenten (eigen/fremd) aufgeteilt, jede Zeile jetzt klickbar. tsc/103 Tests/Build/Lint grün |
| 2026-07-16 | Playtest R7 (Nutzer-Wunsch): Cup-Bestenliste bekommt Punkte je Disziplin — Klick auf den Score klappt die sechs Leg-Scores auf. Neue Migration `0011_cup_leg_breakdown.sql` (`get_leaderboard_cups` liefert `cup_run_id`, neue RPC `get_cup_run_legs`), Client fällt ohne Migration graceful auf reinen Text zurück. tsc/103 Tests/Build/Lint grün |
| 2026-07-15 | Playtest R6: Avatar-Picker-Reihenfolge gefixt + Starter-Umfang neu entschieden (Nutzer-Entscheid) — nur **Junge/Mädchen** bleiben Starter, alle 19 übrigen Avatare (inkl. der bisherigen Starter Sora/Riku/Punk/Cool/Mira/Superheld) bekamen eindeutige, aufsteigende Level-Schwellen 3–40 statt der 8-Starter-Regelung aus R5. Picker zeigt jetzt konsistent eine Fortschrittsleiste (`AVATARS_BY_LEVEL`) |
| 2026-07-15 | Playtest R5: Starter-Avatare umgebaut (Nutzer-Wunsch) — Kanarienvögel **Sora** (orange) + **Riku** (gelb/schwarz) ersetzen Lena/Max, **Mira → Prinzessin**, **Superheld** neu, Robo → Level 8 (21 Avatare gesamt). [DESIGN-AVATARS.md](DESIGN-AVATARS.md) als Plan-Doc angelegt, README/STATUS/ROADMAP auf aktuellen Stand gebracht. Arbeitsweise ab jetzt: jede Umsetzung bekommt ein Design-Doc, Docs werden nachgezogen |
| 2026-07-15 | Playtest R4: keine Avatar-Unlocks als Gast („Nur mit Account"), 4 neue Avatare (Geist, Vampir, Drache, **Geologe** = Prestige bei 16× Diamant), Header mobil kompakt (Status-Punkt am Avatar statt „● ONLINE"), sichtbare „−2 s"-Strafe ersetzt durch unsichtbare Mindestzeit 0,5 s/Frage, **Avatare in der Bestenliste für alle Spieler** (Migration `0010_profile_avatars.sql` + `avatarApi` — **H4: 0010 noch auf Live-DB einspielen**) |
| 2026-07-15 | Playtest R3 umgesetzt: Pin-Zonen 100/**350/1000/2500** km + VOLLTREFFER +3 s (E6-Entscheid), Anti-Tasten-Spam, Training-Neubau (Setup-Screen: Kategorien-Filter + Endlos/10/25, ohne Zeitdruck — `useQuizSession` mit Streaming-Quelle), Choice-Layout ohne Scrollen. **Avatar-System eingeführt** (Phase H1/H2): Katalog + Picker + Spielerkarte + Cup-Punkte-Hover; Grafik-Iteration 2 im GB-Trainer-Stil nach Feedback |
| 2026-07-14 | **Web-Deployment live** (Phase A weitgehend durch): Cloudflare Pages per Wrangler Direct Upload (Dashboard-Git-Flow unbrauchbar), Projekt `geo-quiz` → https://geo-quiz-a6s.pages.dev, `npm run deploy`-Script, README + GitHub-About verlinkt. Live-Smoke-Test: lädt, ONLINE, Konsole sauber. Offen: A4 (Supabase-Site-URL, manuell), voller A5-Durchlauf, A6-Handy-Test |
| 2026-07-14 | 0009 auf Live-DB verifiziert (`rank` in den RPC-Antworten, Idempotenz bestätigt) — **Phase G komplett abgeschlossen**. `apply_pending.sql` + `revert_bot_round.sql` gelöscht, Live-DB-Stand: 0001–0009 |
| 2026-07-14 | G5 abgeschlossen (0007+0008 auf Live-DB, Account-E2E komplett bestätigt inkl. Backfill, Unlock-Panel, rückwirkendem Wochen-Pokal; Test-Bot-Runde per Revert-SQL entfernt). G6 „Pokale Top 3" auf Nutzer-Wunsch umgesetzt (Migration 0009 + UI mit 🥇/🥈/🥉 und XP-Staffel) — **offen: 0009 einspielen (`apply_pending.sql`)** |
| 2026-07-13 | Phase G umgesetzt (G1–G4 Code komplett, Details im Umsetzungs-Log von [DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md)): Migration 0008, Badge-Katalog (16×5 Sprüche), Erfolge-Screen, Level-Bestenliste, Unlock-Panel. Tests 101/101, Gast-Flows im Browser verifiziert. **Offen: `apply_pending.sql` (0007→0008) auf Live-DB, dann Account-E2E** — bis dahin scheitern Online-Submits weiterhin still (0007 fehlt ja ebenfalls noch) |
| 2026-07-13 | Phase G „Gamification" geplant und durchentschieden ([DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md)): Abzeichen in 5 Stufen mit eigenem Spruch je Stufe, Pokale nur im Cup-Modus (Kalenderperioden, lazy finalisiert), XP/Level serverseitig account-gebunden, Level-Bestenliste global + Gruppen, rückwirkender Backfill |
| 2026-07-12 | D1+D2 und C1 umgesetzt (Reihenfolge-Entscheid: SQL-Anti-Cheat + Sounds vor dem Deployment; großer D-Umbau D3–D6 bewusst NACH dem Balancing mit echten Spielern, sonst wird die Server-Engine bei jedem Balance-Tweak doppelt angefasst). Migration 0007 wartet auf die Live-DB (`apply_pending.sql`) — bis dahin scheitern Online-Submits still, weil die Insert-Policies clientseitig nicht mehr genutzt werden |
| 2026-07-12 | F6 vom Nutzer bestätigt — Phase F (Freundesgruppen) komplett abgeschlossen. E6 weitgehend durch (zwei Feedback-Runden umgesetzt); offen nur noch das finale Balancing-Urteil zu Pin-Stufen & Labels |
| 2026-07-12 | Lokale Bestenliste → „Meine Rekorde" umgebaut (Nutzer-Feedback: Bestleistungen statt Rundenverlauf): Allzeit-Top-10 je Kategorie im Store (`bests` + `addToBests`, 4 neue Tests), Migration v2 baut Rekorde aus dem Alt-Verlauf, UI zeigt unter „Alle" die Bestmarke je Kategorie bzw. Top 10 pro Kategorie-Chip. Migration + UI im Browser mit geseedetem v0-Stand verifiziert |
| 2026-07-12 | E6-Feedback Runde 1 umgesetzt (Details im Umsetzungs-Log von [DESIGN-ARCADE.md](DESIGN-ARCADE.md)): Startseiten-Texte erklären das Zeitsystem, 3-2-1-GO-Countdown vor jeder Runde (Frage bleibt bis GO verdeckt), Filter-Chips für die lokale Bestenliste. Dev-Server läuft jetzt mit `--host` für Handy-Tests im WLAN |
| 2026-07-12 | Nutzer-Feedback zur Auth-Mail (englisches Standard-Template beim Account-Upgrade): deutsche Retro-Templates in [supabase/email-templates.md](supabase/email-templates.md) vorbereitet, als A4b in Phase A aufgenommen. Nebenbei: Profil-Texte erwähnen Freundesgruppen jetzt als Account-Vorteil (Entdeckbarkeit für Gäste) |
| 2026-07-12 | 0006 auf der Live-DB verifiziert (alle Gruppen- und Leaderboard-RPCs mit `p_group`-Signatur vorhanden, anon korrekt gesperrt) — DB ist damit vollständig auf Code-Stand (0001–0006). `apply_pending.sql` gelöscht. Offen nur noch: E6-Gerätetest + F6-Zwei-Account-Test, danach Phase D |
| 2026-07-12 | 0005 auf der Live-DB verifiziert (RPC-Probe: 3-Parameter-Signatur existiert, anon korrekt gesperrt). `apply_pending.sql` auf nur-0006 umgeschrieben — 0005 darf wegen des `delete`-Blocks nie doppelt laufen. Offen: 0006 einspielen, dann funktionieren Bestenliste (neue `p_group`-Signatur!) und Gruppen |
| 2026-07-12 | Phase F umgesetzt (F1–F5, Code komplett): Migration 0006 (Gruppen-Tabellen, RLS via `is_group_member()`-Helper, RPCs mit Rate-Limit, Leaderboard-RPCs mit `p_group`), `groupApi.ts`, Gruppen-Panel im Profil, Global/Gruppe-Umschalter in der Bestenliste. **Offen: `apply_pending.sql` (0005+0006) auf Live-DB, dann F6-Zwei-Account-Test.** Faktencheck: 0005 war zum Zeitpunkt noch nicht angewendet (RPC-Probe: PGRST202) |
| 2026-07-12 | E5 umgesetzt (Code komplett): Migration 0005 (Alt-Einträge löschen, Rohpunkte-Checks, Leaderboard-RPCs mit Bestleistung/Spieler + Zeitfilter Woche/Monat/Jahr/Alle), Frontend auf RPCs + Filter-UI umgestellt. **Offen: 0005 auf Live-DB anwenden** (SQL-Editor oder CLI) — dann E6-Gerätetest |
| 2026-07-12 | E4 umgesetzt: Cup läuft mit 30-s-Arcade-Legs (`CupScreen` auf `ArcadeQuizView`), Cup-Total = Rohsumme. Browser-verifiziert über zwei Legs. Bekannt bis E5: Server lehnt Cup-Summen > 100 ab (alter DB-Check), Submit scheitert still |
| 2026-07-12 | E3 umgesetzt: Einzelmodi laufen jetzt zeitbasiert im Browser (`useArcadeSession` + `ArcadeQuizView`, PlayScreen umgestellt, Key-Bugfix bei Mode-Wechsel). E2E im Dev-Server verifiziert (Multiplikator, Tier-Feedback, Uhr-Pause, Zeitablauf→Ergebnis). Training + Cup weiter auf altem Pfad bis E4 |
| 2026-07-12 | E2 umgesetzt: Session-Engine `arcadeSession.ts` (framework-freie Klasse, Wanduhr-Zeitbudget mit Pausen-Regeln, No-Repeat-Quelle) + 12 Tests, Suite 72/72 grün. API-Vertrag für E3 im Umsetzungs-Log von [DESIGN-ARCADE.md](DESIGN-ARCADE.md) |
| 2026-07-12 | E1 umgesetzt: neue Scoring-Engine `arcadeScoring.ts` mit 21 Unit-Tests (Suite 60/60 grün). Läuft parallel zum alten `scoring.ts`, bis E2/E3 die Aufrufer umstellen. API-Details im Umsetzungs-Log von [DESIGN-ARCADE.md](DESIGN-ARCADE.md) |
| 2026-07-12 | Phase F „Freundesgruppen" geplant und durchentschieden ([DESIGN-SOCIAL.md](DESIGN-SOCIAL.md)): Gruppen mit Beitrittscode statt 1:1-Freundescodes, Bestenlisten überall als Bestleistung pro Spieler (auch global), Verwaltung minimal. Reihenfolge: E → F → D. Bestenlisten-Modus-Filter als Pflichtteil in E5 übernommen |
| 2026-07-12 | Phase E „Arcade-Umbau" geplant und vollständig durchentschieden (Design-Chat, Details + Begründungen in [DESIGN-ARCADE.md](DESIGN-ARCADE.md)): zeitbasierte Modi (60 s / Cup 30 s), 100 Pkt × unbegrenzte Streak (+10 %/Punkt), Pin-Distanzstufen mit Bruchteil-Streaks, +5 s je 10 volle Streak-Punkte. Reihenfolge festgelegt: E vor D, damit die neue Engine direkt serverfähig portiert wird |
| 2026-07-12 | Phase D „Anti-Cheat" geplant: Scores sollen künftig serverseitig entstehen (Edge Function als Spielleiter, D3–D6), mit Server-Zeitstempel-RPC (D1) als eigenständig nützlichem Zwischenschritt. Entscheidung nach Analyse: Client-berechnete Scores sind mit Anon-Key + RLS zwar datensicher, aber frei erfindbar — nur die Plausibilitätsprüfung (400 ms/Frage) hält aktuell dagegen |
| 2026-07-11 | Mobile-UX-Umbau Pin-Modi nach Emulator-Feedback: Auf Touch/kleinen Screens füllt die Karte jetzt den ganzen Viewport (fixed, kein Seiten-Scroll mehr — Karte kann nicht mehr „wegscrollen"), HUD/Timer/Frage/Foto als halbtransparente Top-Bar, Buttons schweben unten, Leaflet-Zoom nach unten-links, `ResizeObserver`-invalidateSize für Rotation. Portrait + Landscape verifiziert; Desktop-Layout unverändert |
| 2026-07-11 | B4/B5-Verifikation im Emulator: App geht ONLINE (neuer `sb_publishable`-Key in `.env.local`), anonyme Session überlebt force-stop + Neustart. AVD `geoquiz_pixel7` als Test-Setup etabliert |
| 2026-07-11 | Phase B (B1–B4) erledigt: Android-Toolchain CLI-only aufgesetzt (JDK 21 + SDK-Kommandozeilentools, kein Android Studio), Capacitor + `android/`-Projekt eingerichtet, Debug-Build erfolgreich, Supabase-Session auf `@capacitor/preferences` umgestellt |
| 2026-07-10 | Roadmap angelegt; Phasen A–C definiert. Vorleistung für B1 identifiziert: Android Studio fehlt auf der Maschine |
| 2026-07-10 | ← davor: Phasen 0–4 abgeschlossen (siehe [STATUS.md](STATUS.md)) — spielbares Spiel mit 8 Modi, Supabase-Backend, Account-System, gegatete Leaderboards, Repo auf GitHub |
