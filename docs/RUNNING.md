# Betrieb & Werkzeuge — GeoQuiz

Praktische Anleitung: **wie starte ich was, und was muss ich dabei wissen.**
Für das *Warum* hinter Architektur und Code siehe
[DEVELOPMENT.md](DEVELOPMENT.md); für den Stand des Projekts
[STATUS.md](../STATUS.md) und [ROADMAP.md](../ROADMAP.md).

---

## 1 · Voraussetzungen

| | |
|---|---|
| **Node.js** | ≥ 20 (entwickelt wird auf 24) |
| **Für den Web-Teil** | sonst nichts — `npm install` reicht |
| **Für Android** | JDK 21 (`JAVA_HOME`), Android SDK (`ANDROID_HOME`), `frontend/android/keystore.properties` |
| **Für den Web-Deploy** | Cloudflare-Zugang (Wrangler fragt beim ersten Mal nach Login) |

Der Code liegt in `frontend/`. Im Repo-Root liegt eine reine
Skript-Durchreiche — `npm run dev` funktioniert also von **beiden** Stellen aus.

---

## 2 · Dev-Server

```bash
cd frontend
npm install
npm run dev
```

→ http://localhost:5173

Ohne weitere Konfiguration läuft das Spiel **komplett offline**: lokale
Bestenliste, lokaler Lernfortschritt, keine Anmeldung. Nur die globalen
Bestenlisten brauchen Supabase (siehe §3).

### Am Handy im selben WLAN testen

```bash
npm run dev -- --host
```

Vite gibt dann eine Adresse im Netz aus (`http://192.168.x.x:5173`). Das ist der
schnellste Weg, echtes Touch-Verhalten zu prüfen, ohne eine APK zu bauen —
Pinch-Zoom auf der Karte, Vollbild-Layout der Pin-Modi, Lesbarkeit der
Pixel-Schriften.

### Produktions-Build lokal ansehen

```bash
npm run build && npm run preview        # http://localhost:4173
```

Nur so sieht man, was wirklich ausgeliefert wird — Chunk-Splitting, minifizierte
Bundles, echte Ladezeiten. Der Dev-Server verhält sich an einigen Stellen
anders (siehe §7).

Und für die *echte* Hosting-Laufzeit inklusive der statischen Seiten
(`/datenschutz/`, `/impressum/`, `/konto-loeschen/`), die ohne SPA-Fallback
ausgeliefert werden:

```bash
npx wrangler pages dev frontend/dist --port 8788
```

### Vorkonfigurierte Preview-Server

`.claude/launch.json` enthält die drei Varianten fertig als benannte
Konfigurationen — `geo-quiz-dev` (5173, mit `--host`), `geo-quiz-prod` (4173)
und `geo-quiz-pages` (8788).

---

## 3 · Online-Features (Supabase)

```bash
cp frontend/.env.example frontend/.env.local
# VITE_SUPABASE_ANON_KEY aus Dashboard → Project Settings → API Keys eintragen
```

Dazu im Supabase-Dashboard **Anonymous sign-ins** aktivieren
(Authentication → Sign In / Up) und die Migrations einspielen
(`supabase/apply_all.sql`, Details in [`supabase/README.md`](../supabase/README.md)).

> **Vite liest Env nur beim Start.** Nach jeder Änderung an `.env.local` den
> Dev-Server neu starten, sonst sucht man den Fehler an der falschen Stelle.

> **`git push` spielt keine Migration ein.** Es gibt weder CI noch
> `supabase/config.toml` — SQL wandert nur ins Repo. Die Live-DB ändert sich
> ausschließlich über den SQL-Editor bzw. die CLI.

---

## 4 · Tests, Typen, Lint

```bash
npm test          # Vitest — Quiz-Engine, Scoring, Geometrie, Daten-Integrität
npm run test:watch
npx tsc -b        # Typecheck (läuft auch als Teil von `npm run build`)
npm run lint      # oxlint
```

Die Testsuite ist bewusst auf **pure Logik** ausgerichtet: Scoring-Formeln,
Session-State-Machine, Datumsgrenzen-Geometrie der Karte, Daten-Konsistenz.
Kein DOM-Rendering — deshalb läuft sie in unter einer Sekunde und man kann sie
bedenkenlos vor jedem Commit laufen lassen.

---

## 5 · Android-App

Alles läuft über ein Skript, das Web und App aus **demselben** `dist/`-Build
erzeugt — so können die beiden nicht auseinanderlaufen:

| Befehl | Was passiert |
|---|---|
| `npm run release:android` | nur die App: Checks → Build → `cap sync` → signierte APK + AAB |
| `npm run release -- --no-deploy` | alles bauen, nichts hochladen (Trockenlauf) |
| `npm run release -- --debug-apk` | zusätzlich die Debug-APK |
| `npm run release` | alles inkl. Cloudflare-Upload |

Artefakte landen in `frontend/release/` (gitignored), aufs Gerät dann mit:

```bash
adb install -r frontend/release/<datei>.apk
```

Zwei Dinge, die man wissen muss:

- **`versionCode` wird automatisch hochgezählt** und in
  `android/app/build.gradle` zurückgeschrieben — taucht also im `git diff` auf.
  Ein verschwendeter Wert durch einen Testbau kostet nichts, eine vergessene
  Erhöhung dagegen einen abgelehnten Play-Upload. `--no-bump` schaltet es ab.
- **Ohne `keystore.properties` baut Gradle unsigniert weiter.** Eine unsignierte
  APK lässt sich weder installieren noch hochladen; das Skript warnt vorher.

Emulator-Setup für Tests: AVD `geoquiz_pixel7` (Pixel 7, Android 14).

---

## 6 · Daten- und Asset-Pipeline

Alle Datensätze im Spiel sind **erzeugt, nicht handgepflegt**. Die Skripte sind
idempotent und laufen aus `frontend/`:

| Skript | Erzeugt |
|---|---|
| `node scripts/transform-countries.mjs` | `src/data/countries.json` aus dem mledoze-Rohdatensatz |
| `node scripts/build-outline-atlas.mjs` | `src/data/world-atlas-50m.json` + `outline-index.json` (Umriss-Modus) |
| `node scripts/build-basemap-style.mjs` | `src/data/basemap-dark-nolabels.json` (Karten-Style der Pin-Modi) |
| `node scripts/fetch-landmark-images.mjs` | Landmark-Fotos + `landmark-credits.json` |
| `node scripts/generate-app-assets.mjs` | App-Icons und Splash-Grafiken |
| `node scripts/validate-manifest.mjs` | prüft das Landmark-Manifest |

Jedes Skript nimmt `--from <datei>`, wo eine externe Quelle im Spiel ist —
praktisch, wenn man ohne Netz oder gegen einen eingefrorenen Stand bauen will.

---

## 7 · Stolpersteine, die Zeit kosten

- **Dev-Server ≠ Produktions-Build.** Vite bündelt Abhängigkeiten im Dev-Modus
  vor (`node_modules/.vite/deps/`). Wenn etwas „nur im Dev" oder „nur im Build"
  kaputt ist, liegt es fast immer daran. Nach dem Hinzufügen einer Abhängigkeit
  hilft ein Neustart des Dev-Servers.
- **Karte bleibt schwarz.** MapLibre lädt seinen Worker über einen
  zusammengesetzten Pfad, den Vite nicht auflösen kann — deshalb setzt
  `PinMap.tsx` `config.WORKER_URL` explizit. Fehlt so etwas, gibt es **keinen
  Konsolenfehler**, die Karte ist einfach schwarz. Diagnose: die Worker-URL mit
  `curl` abrufen, ein 404 ist die Antwort. Hintergrund:
  [DESIGN-BASEMAP.md](../DESIGN-BASEMAP.md) §6.
- **Karten-CSS wird überschrieben.** MapLibres Stylesheet kommt aus dem lazy
  geladenen Chunk und wird damit **nach** `index.css` eingehängt. Bei gleicher
  Spezifität gewinnt MapLibre — eigene Regeln deshalb mit `.map-frame`
  voranstellen.
- **Karte braucht nach dem Laden ein paar Sekunden.** Vektorkacheln kommen bei
  kleinem Zoom in großen Paketen; ein kurz schwarzer Kartenrahmen direkt nach
  dem Öffnen ist normal und kein Fehler.
- **Zustand-Updater müssen pur sein** (StrictMode ruft sie doppelt auf): kein
  `setB()` innerhalb eines `setA(updater)`.
- **Die Arcade-Uhr läuft weiter, während man debuggt.** Wer im Pin-Modus
  Screenshots analysiert, verbraucht echtes Rundenbudget — für ruhige
  Untersuchungen den Training-Modus nehmen, der kennt keinen Zeitdruck.
- **Bestenliste und Pokalregal sind für Gäste serverseitig gesperrt.** Ohne
  Anmeldung sieht man dort nur den Account-Hinweis; das ist Absicht (Row Level
  Security), kein Bug.

---

## 8 · Wo liegt was

```
frontend/src/
  components/     Quiz-Ansichten, Karten (MapPicker + PinMap, CountryOutline)
  routes/         Screens (Home, Play, Cup, Scores, Profil, Credits …)
  features/       Pure Logik: quiz-engine, geo, gamification, leaderboard, audio
  state/          Zustand-Stores (Fortschritt, Einstellungen)
  hooks/          Session-State-Machines
  data/           Erzeugte Datensätze (siehe §6)
  api/            Supabase-Zugriff
frontend/scripts/ Daten-Pipeline + Release-Skript
frontend/public/  Statische Seiten (Datenschutz, Impressum, Konto löschen)
supabase/         Migrations + SQL-Doku
```

Design-Entscheidungen liegen als `DESIGN-*.md` im Repo-Root — jede größere
Umsetzung hat eine, mit Befund, Alternativen und Begründung.
