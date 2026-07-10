# 🌍 GeoQuiz

Ein Geographie-Quiz im 8-Bit-Retro-Look — für Web und (geplant) Android. Flaggen raten, Hauptstädte kennen, Städte auf der Karte pinnen und im **Geo Cup** alle Disziplinen hintereinander spielen. Ein adaptiver Trainingsmodus bringt genau die Fragen zurück, die du am häufigsten verhaust.

> 🎮 Sofort spielbar ohne Anmeldung · 🏆 Globale Bestenlisten mit Account · 📴 Läuft komplett offline

## Spielmodi

| Modus | Beschreibung |
|---|---|
| 🚩 **Flaggen** | Welches Land gehört zur Flagge? (4 Antworten, Zeitbonus, Streak-Multiplikator) |
| 🏛️ **Hauptstädte** | Nenne die Hauptstadt des Landes |
| 🌍 **Länder** | Zu welchem Land gehört die Hauptstadt? |
| 🗺️ **Umrisse** | Erkenne das markierte Land auf der Weltkarte |
| 📍 **Städte-Pin** | Setze den Pin — Punkte nach Distanz (Haversine, exponentieller Falloff) |
| 🗿 **Landmark-Pin** | Wo steht das Wahrzeichen? (steilerer Falloff, Präzision zählt) |
| 🏆 **Geo Cup** | Alle 6 Disziplinen à 5 Fragen, normalisierte Gesamtwertung 0–100 |
| 🎯 **Training** | Adaptiver Sampler: oft falsch beantwortete & lange nicht gesehene Fragen kommen öfter |

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
│   │   │   ├── quiz-engine/    # pures TS: Scoring, Fragengenerator, adaptiver Sampler, Cup (+ Tests)
│   │   │   ├── geo/            # Haversine-Distanz
│   │   │   └── progress/       # Delta-Sync zur Datenbank (Offline-Queue)
│   │   ├── routes/             # ein Screen pro Datei (Home, Play, Cup, Training, Scores, Profile)
│   │   ├── components/         # QuizView, MapPicker, CountryOutline, Timer, StreakBadge
│   │   ├── api/                # Supabase-Client, Auth, Scores, Leaderboard
│   │   ├── state/              # Zustand-Stores (Progress mit localStorage-Persistenz, User)
│   │   └── data/               # countries.json (245), cities.json (141), landmarks.json (64), Topojson
│   └── scripts/                # Daten-Transformation aus mledoze/countries
├── supabase/
│   ├── migrations/             # das gesamte Backend: Tabellen, RLS, RPCs, Views, Anti-Cheat-Trigger
│   └── apply_all.sql           # alle Migrations kombiniert (für den SQL-Editor)
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

## Scoring (Kurzfassung)

- **Multiple Choice:** `round((100 + Zeitbonus_max50) × Streak-Multiplikator_max1.5)` → max. 225/Frage
- **Pin-Modi:** `100 × e^(−Distanz/R)` (R = 200 km Städte, 90 km Landmarks), < 5 km = Bullseye 100, kleiner additiver Zeitbonus
- **Cup:** `100 × erreicht / maximal` über alle Legs — fair trotz unterschiedlicher Maximalpunkte pro Modus

Die Formeln sind in [`scoring.ts`](frontend/src/features/quiz-engine/scoring.ts) implementiert und in [`scoring.test.ts`](frontend/src/features/quiz-engine/scoring.test.ts) gegen durchgerechnete Beispiele festgeschrieben.

## Datenquellen & Lizenzen

- Länderdaten: [mledoze/countries](https://github.com/mledoze/countries) (ODbL) — transformiert via `frontend/scripts/transform-countries.mjs`
- Flaggen: [flag-icons](https://github.com/lipis/flag-icons) (MIT)
- Weltkarten-Topojson: [world-atlas](https://github.com/topojson/world-atlas) `countries-110m`
- Kartentiles: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, © [CARTO](https://carto.com/attributions)
- Städte- und Landmark-Datensätze: eigene Kuratierung

## Roadmap

- [x] Phase 1–3: Alle Spielmodi, 8-Bit-Design, lokale Persistenz
- [x] Phase 4: Supabase (anonyme Auth, Account-Upgrade, Progress-Sync, gegatete Leaderboards)
- [ ] Phase 5: Android-Packaging mit Capacitor
- [ ] Phase 6: Polish (8-Bit-Sounds, Haptics, Code-Splitting)

Aktueller Stand inkl. Testprotokollen: [STATUS.md](STATUS.md)

## Weiterführende Doku

- 🛠️ **[Developer-Doku](docs/DEVELOPMENT.md)** — der komplette Stack erklärt: Architekturprinzipien, Quiz-Engine, Delta-Sync, Supabase-Schema & Sicherheitsmodell, Design-System, Erweiterungs-Kochbuch
- 📋 [Architekturplan](docs/PLAN.md) — die ursprüngliche Planung (Tech-Entscheidungen, Datenmodell, Phasen)
- ☁️ [Backend-Setup](supabase/README.md) — Migrations anwenden, Dashboard-Einstellungen

