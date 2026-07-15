# geo-quiz — Projekt-Status

> Zentrale Fortschrittsübersicht. Wird bei jedem Meilenstein aktualisiert.
> Detailplan: [docs/PLAN.md](docs/PLAN.md) · aktueller Abhak-Plan: [ROADMAP.md](ROADMAP.md) · Stand: 2026-07-15

## Gesamtfortschritt

| Phase | Beschreibung | Status |
|---|---|---|
| 0 | Scaffold (Vite + React 18 + TS, Deps, Fonts, Rohdaten) | ✅ Fertig |
| 1a | Daten: countries.json, cities.json, landmarks.json | ✅ Fertig |
| 1b | Quiz-Engine (pure TS) + Vitest-Tests | ✅ Fertig |
| 1c | 8-Bit-Design-System + Home-Screen | ✅ Fertig |
| 1d | MC-Modi: Flags, Countries, Capitals | ✅ Fertig (im Browser durchgespielt) |
| 2 | Karten-Modi: Outline, City-Pin, Landmark-Pin | ✅ Fertig |
| 3 | Cup-Modus + Training-Modus + lokale Persistenz | ✅ Fertig (localStorage via zustand/persist) |
| 4 | Supabase: Leaderboard + Sync + Account-Upgrade | ✅ Fertig (E2E verifiziert 2026-07-10) |
| A | Web-Deployment (Cloudflare Pages) | ✅ Live: [geo-quiz-a6s.pages.dev](https://geo-quiz-a6s.pages.dev) (`npm run deploy`) |
| E | Arcade-Umbau: zeitbasierte Modi + neues Scoring ([DESIGN-ARCADE.md](DESIGN-ARCADE.md)) | ✅ Fertig inkl. 3 Playtest-Balancing-Runden (2026-07-14/15) |
| F | Freundesgruppen ([DESIGN-SOCIAL.md](DESIGN-SOCIAL.md)) | ✅ Fertig (Zwei-Account-E2E 2026-07-12) |
| G | Gamification: Abzeichen, Pokale Top 3, XP/Level ([DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md)) | ✅ Fertig (Live-DB 0007–0009, E2E 2026-07-14) |
| H | Avatare & Spielerkarten ([DESIGN-AVATARS.md](DESIGN-AVATARS.md)) | 🔄 Client fertig (21 Avatare, Karte, Bestenlisten-Avatare) — **Migration 0010 noch auf Live-DB** |
| B | Capacitor Android-Packaging | 🔄 Läuft (Toolchain + Projekt-Setup fertig, Geräte-Test offen) |
| C | Polish (Sounds ✅, Code-Splitting/PWA/Haptics offen) | 🔄 |
| D | Anti-Cheat (Stufe 1 ✅: Session-Guard 0007; Stufe 2 server-autoritativ offen) | 🔄 |

**Training seit R3 (2026-07-15):** eigenständig ohne Arcade — Setup-Screen mit
Kategorien-Filter und Länge (Endlos/10/25), ohne Zeitdruck, adaptiver Sampler
bevorzugt Ungesehenes & oft Falsches.

## Bereichs-Status

### 📦 Daten
| Artefakt | Status | Notiz |
|---|---|---|
| `data/raw/countries-full.json` | ✅ | mledoze/countries, 250 Einträge, 770 KB |
| `data/world-atlas-110m.json` | ✅ | Topojson für Outline-Modus |
| `data/countries.json` (schlank) | ✅ | 245 Länder (194 UN), 84 KB, via `scripts/transform-countries.mjs` |
| `data/cities.json` | ✅ | 141 Städte, alle Kontinente, Population + isCapital |
| `data/landmarks.json` | ✅ | 129 Einträge (Bauwerke, Monumente, Naturwunder, bekannte Plätze), Kategorie + Difficulty 1–3 + Foto je Eintrag, generiert via `scripts/fetch-landmark-images.mjs` |

### 🧠 Quiz-Engine (`src/features/quiz-engine/`, pure TS)
| Modul | Status | Notiz |
|---|---|---|
| `types.ts` | ✅ | Question/Progress/Summary-Typen |
| `arcadeScoring.ts` + `arcadeSession.ts` | ✅ | Zeitbudget-Engine (60 s / Cup 30 s), Streak ohne Deckel, Pin-Distanzstufen, Mindestzeit 0,5 s/Frage — Regelwerk: [DESIGN-ARCADE.md](DESIGN-ARCADE.md) |
| `scoring.ts` (alt) | ✅ | nur noch Trainings-Pfad (ohne Zeitdruck) |
| `questionGenerator.ts` | ✅ | 6 Modi, deterministische IDs, Same-Region-Distraktoren, `questionFromId`-Roundtrip |
| `adaptiveSampler.ts` | ✅ | Weighted-random, 30 % Flat-Mix, 5er-Ring-Buffer |
| `cupSession.ts` | ✅ | 6 Legs à 30 s, Cup-Total = Rohsumme |
| `geo/distance.ts` (Haversine) | ✅ | Berlin↔Paris-Test |
| Vitest-Tests | ✅ | 103 Tests, 9 Dateien |

### 🎨 UI / Design
| Baustein | Status | Notiz |
|---|---|---|
| 8-Bit-Theme (Press Start 2P + VT323, Pixel-Borders, CRT) | ✅ | `index.css`: Scanlines, Vignette, Starfield, Neon-Glow, Pixel-Buttons |
| Router + Home-Screen | ✅ | HashRouter (Capacitor-tauglich), Modus-Karten-Grid |
| Quiz-Screen (Timer, Streak, Score-Bar, MC-Optionen) | ✅ | `QuizView` wird von allen Modi geteilt; Tasten 1–4 als Shortcuts |
| Ergebnis-Summary | ✅ | Rang S/A/B/C/D, % von perfekt, beste Serie |
| Karten-Komponenten (CountryOutline, MapPicker) | ✅ | Auto-Zoom nach Landesfläche; Carto-dark-nolabels-Tiles (keine OSM-Direktnutzung, keine Label-Spoiler) |

### 🎮 Spielmodi
| Modus | Status | Notiz |
|---|---|---|
| Flags | ✅ | flag-icons SVGs, Same-Region-Distraktoren |
| Countries (Hauptstadt→Land) | ✅ | |
| Capitals (Land→Hauptstadt) | ✅ | |
| Outline (markiertes Land erkennen) | ✅ | react-simple-maps @ React 18, MC-Antworten |
| City-Pin | ✅ | Leaflet + Haversine, Feedback mit Ziel-Marker + Distanzlinie |
| Landmark-Pin | ✅ | steilerer Falloff (R=90), zeigt Foto der Sehenswürdigkeit/des Ortes |
| Cup (alle 6 Modi rotierend) | ✅ | 30-s-Legs, Interstitials, End-Breakdown-Tabelle, Punkte-Hover je Disziplin in „Meine Rekorde" |
| Training (adaptiv, eigenständig) | ✅ | Setup: Kategorien + Endlos/10/25, ohne Zeitdruck, zählt nicht in Bestenliste |
| Bestenliste | ✅ | Lokal „Meine Rekorde" (Allzeit-Top-10 je Kategorie) · Global/Cups/Level mit Zeitfilter, Gruppen-Umschalter und Avataren |
| Avatare & Spielerkarte | 🔄 | 21 Pixel-Avatare, Picker, Karte, Header-Status-Punkt — fremde Avatare erst nach Migration 0010 ([DESIGN-AVATARS.md](DESIGN-AVATARS.md)) |
| Erfolge (Abzeichen/Pokale/Level) | ✅ | `/achievements`, Unlock-Panel am Rundenende, Level-Chip im Header |

### ☁️ Backend (Supabase) — Phase 4
Projekt: `dpueqnhhwcdbhihiudyg` · Doku: [supabase/README.md](supabase/README.md)

| Baustein | Status | Notiz |
|---|---|---|
| Supabase-Projekt | ✅ | „Geo Quiz", eu-north-1, ACTIVE_HEALTHY |
| Migrations geschrieben (Tabellen, RLS, RPC, Views, Anti-Cheat-Trigger) | ✅ | `supabase/migrations/0001–0003`, kombiniert in `apply_all.sql` |
| Migrations **angewendet** | ✅ | via Management-API (2026-07-10); Leaderboard-View antwortet mit 200 |
| Anonymous sign-ins aktiviert | ✅ | via Management-API nach expliziter User-Freigabe |
| Account-Upgrade (anonym → E-Mail/Passwort) + Profil-Screen | ✅ | `/profile`: Name ändern, Upgrade, Login (2. Gerät), Logout; `updateUser()` behält User-ID → Fortschritt wandert mit |
| Leaderboard-Gate: globale Listen nur mit Account | ✅ | Migration `0004`: Insert-Policies + Views prüfen `is_anonymous`-JWT-Claim; Gäste spielen frei, sehen aber CTA statt Rangliste. Progress-Sync bleibt auch für Gäste aktiv |
| Client (`api/`: supabaseClient, authApi, scoreApi, leaderboardApi) | ✅ | Offline-Fallback wenn Env fehlt (verifiziert) |
| Anonyme Auth + Retro-Spielername (PIXEL_FOX_42) | ✅ | Profil-Editor in der Bestenliste |
| Progress-Sync (Delta-Queue + `sync_progress`-RPC) | ✅ | Offline-Queue in localStorage, Flush bei App-Start + Session-Ende |
| Score-/Cup-Submit + Global-Leaderboard-Tabs | ✅ | Bestenliste: Lokal / Global / Cups |
| `VITE_SUPABASE_ANON_KEY` in `frontend/.env.local` | ✅ | via Management-API geholt und eingetragen |

### 🤖 Android (Capacitor) — Phase 5
| Baustein | Status | Notiz |
|---|---|---|
| Toolchain (JDK 21 + SDK CLI-only, `C:\Android\sdk`) | ✅ | Ohne Android Studio; `JAVA_HOME`/`ANDROID_HOME` persistent |
| `npx cap add android` | ✅ | App-ID `de.tobsob.geoquiz`; Debug-APK baut (`gradlew assembleDebug`) |
| Storage-Adapter für Auth-Session | ✅ | `@capacitor/preferences`; E2E: anonyme Identität überlebt force-stop |
| Emulator-Test (AVD `geoquiz_pixel7`) | 🔄 | Flaggen + Profil + Online-Login OK; Karten-Modi (Pin-Präzision) offen |
| On-Device-Test (Touch auf SVG-Karten) | ⬜ | |

## Verifikation (Stand 2026-07-10)
- ✅ `npm run test` — 32 Tests grün (Scoring-Beispiele aus dem Plan, Distanztabelle, Sampler-Statistik, Daten-Integrität)
- ✅ `npm run build` — TypeScript + Vite production build fehlerfrei
- ✅ `npm run lint` — nur 3 unkritische Warnungen (bewusste `runKey`-Re-Roll-Dependencies)
- ✅ Im Browser durchgespielt: Flaggen-Runde 10/10 (Rang A, 1812 Pkt.), City-Pin Amsterdam (197 km → +34, deckt sich mit Plan-Tabelle), Umriss-Modus (Katar markiert), Cup Leg 1 → Interstitial (Zwischenstand 72/100), Bestenliste + localStorage-Persistenz bestätigt
- 🐛 Gefixt dabei: Race-Condition Timeout-vs-Klick in `useQuizSession` (Ref-Lock), unreiner setState-Updater (StrictMode)

## Phase-4-E2E-Testprotokoll (2026-07-10)
- ✅ Anonyme Anmeldung beim App-Start → `● ONLINE`, Retro-Name `RETRO_LYNX_10` generiert
- ✅ Flaggen-Runde gespielt → Score erscheint auf dem globalen Leaderboard
- ✅ Zwei-Sessions-Test aus dem Plan: zweiter anonymer User per REST erzeugt, beide auf dem geteilten Leaderboard (Testdaten danach entfernt)
- ✅ Anti-Cheat-Trigger: Score mit 500 ms für 10 Fragen → `400 implausible duration for question count`
- ✅ `sync_progress`-RPC: 26 Fragen-Fortschritte serverseitig angekommen
- ✅ Profil-Screen: Gast-Status, Upgrade-Formular, Login-Panel gerendert
- ⚠️ Nicht automatisiert testbar: der E-Mail-Bestätigungslink des Account-Upgrades (braucht echtes Postfach) — Formular + `updateUser()`-Flow sind Supabase-nativ

## Leaderboard-Gate-Testprotokoll (2026-07-10)
- ✅ Gast: Global-Tab zeigt „Account sichern"-CTA statt Liste
- ✅ Gast: direkter REST-Insert in `score_entries` → `403 row-level security` (Server erzwingt das Gate, nicht nur die UI)
- ✅ Gast: `leaderboard_scores`-View liefert 0 Zeilen
- ✅ Registrierter User (bestätigt, `is_anonymous:false` im JWT): Score-Insert OK, View liefert Einträge
- ✅ Alle Testdaten (Test-User + Vorab-Scores) entfernt — Leaderboard startet leer

## Nächste Schritte
→ Als abhakbarer Plan mit Verlaufs-Historie in **[ROADMAP.md](ROADMAP.md)** (Phase A: Web-Deployment, Phase B: Android/Capacitor, Phase C: Polish).

Hygiene-Merker: Supabase-Access-Token nach Abschluss löschen (account/tokens).

## Entscheidungs-Log
- **React 18 gepinnt** (statt 19) → `react-simple-maps@3` läuft ohne Fork/Overrides.
- **Supabase statt FastAPI** — kein eigener Backend-Code, nur SQL-Migrations.
- **Fonts:** Press Start 2P (Headlines) + VT323 (Fließtext) via @fontsource.
- **Statische Daten als Bundled JSON** — Quiz läuft komplett offline, Backend nur für Leaderboard/Sync.

Legende: ✅ fertig · 🔄 in Arbeit · ⬜ offen · ⚠️ blockiert
