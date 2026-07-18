# 🌍 GeoQuiz

**▶ Jetzt spielen: [geo-quiz-a6s.pages.dev](https://geo-quiz-a6s.pages.dev)**

Ein Geographie-Quiz im 8-Bit-Retro-Look — für Web und (geplant) Android. Alle Spielmodi laufen als **Arcade-Sessions**: 60 Sekunden, so viele Fragen wie du schaffst, Streak-Multiplikator ohne Deckel. Dazu Pixel-Avatare, Abzeichen, Pokale, Level, Freundesgruppen — und ein adaptiver Trainingsmodus, der genau die Fragen zurückbringt, die du am häufigsten verhaust.

> 🎮 Sofort spielbar ohne Anmeldung · 🏆 Globale Bestenlisten, Erfolge & Gruppen mit Account · 📴 Läuft komplett offline

## Spielmodi

| Modus | Beschreibung |
|---|---|
| 🚩 **Flaggen** | Welches Land gehört zur Flagge? (60 s, 4 Antworten, Tasten 1–4) |
| 🏛️ **Hauptstädte** | Nenne die Hauptstadt des Landes |
| 🌍 **Länder** | Zu welchem Land gehört die Hauptstadt? |
| 🗺️ **Umrisse** | Erkenne das markierte Land auf der Weltkarte |
| 📍 **Städte-Pin** | Setze den Pin — Punkte nach Distanzstufen (VOLLTREFFER! ≤ 100 km gibt +3 s) |
| 🗿 **Landmark-Pin** | Wo steht das Wahrzeichen? (mit Foto, gleiche Distanzstufen) |
| 🏆 **Geo Cup** | Alle 6 Disziplinen hintereinander à 30 Sekunden, Gesamtwertung = Punktsumme |
| 🎯 **Training** | Ohne Zeitdruck, endlos oder 10/25 Fragen, Kategorien wählbar — adaptiver Sampler bevorzugt Ungesehenes & oft Falsches |

## Meta-Features

- 🎭 **Pixel-Avatare** — 21 handgepixelte 16×16-Sprites (2 Starter, Rest über eine Level-Kurve 3–40 sowie Erfolge/Pokal/Prestige freischaltbar, [Katalog & Regeln](DESIGN-AVATARS.md))
- 🏅 **Erfolge** — 16 Abzeichen in 5 Stufen (Normal→Diamant) mit eigenem Spruch je Stufe, XP + Level (Cap 99)
- 🏆 **Pokale & Hall of Fame** — Wochen-/Monats-/Jahresbeste im Cup (Top 3), blätterbar je Periode; Monats-/Jahrespokale als eigene Pixel-Sprites
- 🗄️ **Pokalregal** — 6 frei bestückbare Plätze (Abzeichen & Pokale gemischt) auf der öffentlichen Spielerkarte
- 👥 **Freundesgruppen** — per Beitrittscode (z. B. `TURBO-YETI-83`), eigene Gruppen-Bestenlisten
- 🥇 **Bestenlisten** — lokal („Meine Rekorde", Allzeit-Top-10 je Kategorie) und global (Bestleistung pro Spieler, Zeitfilter, mit Avataren)

## Tech-Stack

- **Frontend:** React 18 + TypeScript + Vite, Zustand (State), React Router (Hash-Routing, Capacitor-tauglich)
- **Karten:** [react-simple-maps](https://www.react-simple-maps.io/) (Umriss-Modus, world-atlas Topojson) · [Leaflet](https://leafletjs.com/) via react-leaflet (Pin-Modi, Carto-Tiles ohne Labels)
- **Design:** 8-Bit-Theme mit [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) + [VT323](https://fonts.google.com/specimen/VT323), CRT-Scanlines, Pixel-Borders — pures CSS, kein UI-Framework
- **Backend:** [Supabase](https://supabase.com/) (Postgres + Auth + PostgREST) — es gibt **keinen eigenen Server-Code**, das gesamte Backend ist SQL unter [`supabase/migrations/`](supabase/)
- **Tests:** Vitest (Quiz-Engine ist pures, framework-freies TypeScript)

## Projektstruktur

```
geo-quiz/
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── quiz-engine/    # pures TS: Arcade-Scoring & -Session, Fragengenerator, adaptiver Sampler, Cup (+ Tests)
│   │   │   ├── avatars/        # Avatar-Katalog (prozedurale 16×16-Pixel-Sprites) + Unlock-Regeln
│   │   │   ├── gamification/   # Level-Kurve, Badge-Katalog (16 Abzeichen × 5 Stufen)
│   │   │   ├── audio/          # 8-Bit-SFX per WebAudio-Synthese (keine Assets)
│   │   │   ├── geo/            # Haversine-Distanz
│   │   │   └── progress/       # Delta-Sync zur Datenbank (Offline-Queue)
│   │   ├── routes/             # ein Screen pro Datei (Home, Play, Cup, Training, Scores, Achievements, Profile)
│   │   ├── components/         # ArcadeQuizView, QuizView, MapPicker, PixelAvatar, PlayerCard, …
│   │   ├── api/                # Supabase-Client, Auth, Scores, Leaderboard, Gruppen, Avatare
│   │   ├── state/              # Zustand-Stores (Progress, User, Gamification, Avatar, Settings)
│   │   └── data/               # countries.json (245), cities.json (141), landmarks.json (129), Topojson
│   └── scripts/                # Daten-Transformation aus mledoze/countries
├── supabase/
│   ├── migrations/             # das gesamte Backend: Tabellen, RLS, RPCs, Anti-Cheat, Gamification
│   └── apply_all.sql           # alle Migrations kombiniert (für den SQL-Editor)
├── DESIGN-*.md                 # Regelwerke: Arcade, Gamification, Social, Avatare
├── docs/PLAN.md                # Architektur- und Phasenplan
└── STATUS.md                   # Projekt-Status mit Testprotokollen
```

## Loslegen

Voraussetzungen: Node.js ≥ 20

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Ohne weitere Konfiguration läuft das Spiel **komplett offline** (lokale Bestenliste, lokaler Lernfortschritt).

### Online-Features aktivieren (globale Bestenlisten)

1. Supabase-Projekt anlegen und die Migrations ausführen — am einfachsten [`supabase/apply_all.sql`](supabase/apply_all.sql) im SQL-Editor, Details in [`supabase/README.md`](supabase/README.md)
2. Im Dashboard **Anonymous sign-ins** aktivieren (Authentication → Sign In / Up)
3. Env-Datei anlegen:

```bash
cp frontend/.env.example frontend/.env.local
# VITE_SUPABASE_ANON_KEY aus Dashboard → Settings → API eintragen
```

### Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit HMR |
| `npm run test` | Vitest (Quiz-Engine, Scoring-Formeln, Daten-Integrität) |
| `npm run build` | Typecheck + Production-Build |
| `npm run lint` | oxlint |

## Auth-Modell

**Spielen geht immer** — beim ersten Start wird unsichtbar eine anonyme Supabase-Session mit Retro-Namen (z. B. `PIXEL_FOX_42`) erzeugt, die den Lernfortschritt geräteübergreifend sichert. **Globale Bestenlisten** (eintragen *und* einsehen) erfordern einen registrierten Account: im Profil E-Mail + Passwort hinterlegen, die User-ID bleibt dieselbe und aller Fortschritt wandert mit. Das Gate ist serverseitig per Row Level Security erzwungen (Views und Insert-Policies prüfen den `is_anonymous`-JWT-Claim), nicht nur in der UI.

## Scoring (Kurzfassung — Arcade-Regelwerk)

- **Zeitbudget:** 60 s pro Runde (Cup-Legs 30 s); die Uhr läuft nur, während eine Frage aktiv ist. Jede Antwort kostet mindestens 0,5 s (Anti-Spam).
- **Multiple Choice:** `100 × Streak-Multiplikator` — +10 % pro Streak-Punkt, ohne Deckel (Streak 7 → 170 Punkte); falsch = 0 und Streak weg.
- **Pin-Modi:** Distanzstufen statt Kurve: ≤ 100 km VOLLTREFFER! (100 Pkt, Streak +1, **+3 s Zeit**), ≤ 350 km STARK! (50, +0,5), ≤ 1000 km KNAPP VORBEI (10, +0,1), ≤ 2500 km NAJA… (1, hält), darüber VÖLLIG VERPEILT (0, Streak weg).
- **Zeit-Rückholung:** alle 10 vollen Streak-Punkte automatisch **+5 s**.
- **Cup:** Gesamtwertung = Rohsumme aller sechs 30-s-Legs.
- **Training:** ohne Zeitdruck, zählt nicht in Bestenlisten (eigener Pfad über `scoring.ts`).

Regelwerk mit Begründungen: [DESIGN-ARCADE.md](DESIGN-ARCADE.md) · implementiert in [`arcadeScoring.ts`](frontend/src/features/quiz-engine/arcadeScoring.ts), festgeschrieben in [`arcadeScoring.test.ts`](frontend/src/features/quiz-engine/arcadeScoring.test.ts).

## Datenquellen & Lizenzen

- Länderdaten: [mledoze/countries](https://github.com/mledoze/countries) (ODbL) — transformiert via `frontend/scripts/transform-countries.mjs`
- Flaggen: [flag-icons](https://github.com/lipis/flag-icons) (MIT)
- Weltkarten-Topojson: [world-atlas](https://github.com/topojson/world-atlas) `countries-110m`
- Kartentiles: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, © [CARTO](https://carto.com/attributions)
- Städte- und Landmark-Datensätze: eigene Kuratierung

## Roadmap

- [x] Phase 1–3: Alle Spielmodi, 8-Bit-Design, lokale Persistenz
- [x] Phase 4: Supabase (anonyme Auth, Account-Upgrade, Progress-Sync, gegatete Leaderboards)
- [x] Phase A: Web-Deployment ([geo-quiz-a6s.pages.dev](https://geo-quiz-a6s.pages.dev), `npm run deploy`)
- [x] Phase E: Arcade-Umbau (zeitbasierte Modi, neues Scoring) + Playtest-Balancing
- [x] Phase F: Freundesgruppen · Phase G: Gamification (Abzeichen, Pokale, Level)
- [x] Phase H: Avatare & Spielerkarten (Client fertig; Migration 0010 fürs Avatar-Sync noch einspielen)
- [x] Phase I: Pokal-Ausbau — Perioden-Navigation, Pixel-Pokale, Pokalregal (Client fertig; Migration 0014 noch einspielen)
- [ ] Phase J: Social Login Google/GitHub (Code fertig; OAuth-Apps + Supabase-Provider-Setup offen)
- [ ] Phase B: Android-App mit Capacitor (Toolchain steht, Gerätetest offen)
- [ ] Phase C: Polish (Code-Splitting, PWA, Haptics — Sounds ✅)
- [ ] Phase D: Anti-Cheat Stufe 2 (server-autoritatives Scoring; Stufe 1 ✅)

Detaillierter Plan zum Abhaken: **[ROADMAP.md](ROADMAP.md)** · Stand & Testprotokolle: [STATUS.md](STATUS.md)

## Weiterführende Doku

- 🛠️ **[Developer-Doku](docs/DEVELOPMENT.md)** — der komplette Stack erklärt: Architekturprinzipien, Quiz-Engine, Delta-Sync, Supabase-Schema & Sicherheitsmodell, Design-System, Erweiterungs-Kochbuch
- 🎨 **Design-Dokumente** (Regelwerke mit Begründungen und Umsetzungs-Log): [Arcade-Scoring](DESIGN-ARCADE.md) · [Gamification](DESIGN-GAMIFICATION.md) · [Freundesgruppen](DESIGN-SOCIAL.md) · [Avatare & Spielerkarten](DESIGN-AVATARS.md)
- 📋 [Architekturplan](docs/PLAN.md) — die ursprüngliche Planung (Tech-Entscheidungen, Datenmodell, Phasen)
- ☁️ [Backend-Setup](supabase/README.md) — Migrations anwenden, Dashboard-Einstellungen

