# geo-quiz — Projekt-Status

> Zentrale Fortschrittsübersicht. Wird bei jedem Meilenstein aktualisiert.
> Detailplan: [docs/PLAN.md](docs/PLAN.md) · aktueller Abhak-Plan: [ROADMAP.md](ROADMAP.md) · Stand: 2026-08-03

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
| A | Web-Deployment (Cloudflare Pages) | ✅ Live: [geo-quiz-a6s.pages.dev](https://geo-quiz-a6s.pages.dev) — Web **und** App in einem Lauf: `npm run release` |
| E | Arcade-Umbau: zeitbasierte Modi + neues Scoring ([DESIGN-ARCADE.md](DESIGN-ARCADE.md)) | ✅ Fertig inkl. 3 Playtest-Balancing-Runden (2026-07-14/15) |
| F | Freundesgruppen ([DESIGN-SOCIAL.md](DESIGN-SOCIAL.md)) | ✅ Fertig (Zwei-Account-E2E 2026-07-12) |
| G | Gamification: Abzeichen, Pokale Top 3, XP/Level ([DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md)) | ✅ Fertig (Live-DB 0007–0009, E2E 2026-07-14) |
| H | Avatare & Spielerkarten ([DESIGN-AVATARS.md](DESIGN-AVATARS.md)) | 🔄 Client fertig (21 Avatare, Karte für jeden Spieler, Bestenlisten-Avatare, Cup-Punkte-Aufklappen) — **0010–0012 live, 0013 (Reihenfolge-Fix) noch auf Live-DB** |
| I | Pokal-Ausbau: Perioden-Navigation, Pixel-Pokale, Pokalregal ([DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md)) | 🔄 Client + Migration 0014 fertig (Tests 109/109) — **`apply_pending.sql` (0013+0014) noch auf Live-DB, dann Account-E2E** |
| J | Social Login Google/GitHub ([DESIGN-AUTH.md](DESIGN-AUTH.md)) | 🔄 Code fertig (linkIdentity/signInWithOAuth, Buttons in beiden Auth-Panels) — **OAuth-Apps + Supabase-Provider-Setup (manuell) + Redirect-Test offen** |
| B | Capacitor Android-Packaging | 🔄 Läuft (Toolchain + Setup fertig; Feedback-Runde 1 umgesetzt: [DESIGN-MOBILE-POLISH.md](DESIGN-MOBILE-POLISH.md); Geräte-Bestätigung offen) |
| C | Polish (Sounds ✅, Handy-Performance ✅ [DESIGN-PERF-MOBILE.md](DESIGN-PERF-MOBILE.md); Code-Splitting/PWA/Haptics offen) | 🔄 |
| D | Anti-Cheat (Stufe 1 ✅: Session-Guard 0007; Stufe 2 server-autoritativ offen) | 🔄 |
| K | Play-Store-Reife ([DESIGN-PLAYSTORE.md](DESIGN-PLAYSTORE.md)) | 🔄 Technisch fertig: Konto-Löschung (0017 **live + E2E bestätigt**), Rechtstexte live, `versionCode`-Automatik, Backup-Regeln, Feature-Grafik, Bildnachweise. Listing-Material liegt bereit: Texte in [docs/STORE-LISTING.md](docs/STORE-LISTING.md), 7 Telefon-Screenshots in `frontend/assets/store-screenshots/` (Bestenliste + Pokalregal brauchen eine Anmeldung im Emulator). **Offen sind nur noch Play-Console-Schritte:** App anlegen + App Signing, Data Safety, Altersfreigabe, Listing, Closed Testing |

**Training seit R3 (2026-07-15):** eigenständig ohne Arcade — Setup-Screen mit
Kategorien-Filter und Länge (Endlos/10/25), ohne Zeitdruck, adaptiver Sampler
bevorzugt Ungesehenes & oft Falsches.

## Bereichs-Status

### 📦 Daten
| Artefakt | Status | Notiz |
|---|---|---|
| `data/raw/countries-full.json` | ✅ | mledoze/countries, 250 Einträge, 770 KB |
| `data/world-atlas-50m.json` | ✅ | Topojson für Outline-Modus, 756 KB, per `import()` nachgeladen |
| `data/outline-index.json` | ✅ | Umkreis je Land (~7 KB) für Pruning + Outline-Pool, via `scripts/build-outline-atlas.mjs` |
| `data/countries.json` (schlank) | ✅ | 245 Länder (194 UN), 84 KB, via `scripts/transform-countries.mjs` |
| `data/cities.json` | ✅ | 141 Städte, alle Kontinente, Population + isCapital |
| `data/landmarks.json` | ✅ | 129 Einträge (Bauwerke, Monumente, Naturwunder, bekannte Plätze), Kategorie + Difficulty 1–3 + Foto je Eintrag, generiert via `scripts/fetch-landmark-images.mjs` |
| `data/landmark-credits.json` | ✅ | Urheber + Lizenz je Foto (38 KB, eigener Chunk — nur der Nachweis-Screen lädt ihn), aus demselben Skript-Lauf |

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
| Outline (markiertes Land erkennen) | ✅ | 50m-Geometrie mit sichtbarer Umgebung, direkt per d3-geo gezeichnet, MC-Antworten; Pool 193 Länder |
| City-Pin | ✅ | Leaflet + Haversine, Feedback mit Ziel-Marker + Distanzlinie |
| Landmark-Pin | ✅ | steilerer Falloff (R=90), zeigt Foto der Sehenswürdigkeit/des Ortes |
| Cup (alle 6 Modi rotierend) | ✅ | 30-s-Legs, Interstitials, End-Breakdown-Tabelle, Punkte je Disziplin einsehbar in „Meine Rekorde" (Hover) und globaler Cup-Bestenliste (Klick, live); Reihenfolge-Fix (Migration 0013) noch ausstehend |
| Training (adaptiv, eigenständig) | ✅ | Setup: Kategorien + Endlos/10/25, ohne Zeitdruck, zählt nicht in Bestenliste |
| Bestenliste | ✅ | **Geo Cup ist der Hauptpunkt** (großer Button oben; für Accounts vorausgewählt, Gäste starten weiter bei „Meine Rekorde"), darunter als Unterpunkte Level / Global / „Meine Rekorde" (Allzeit-Top-10 je Kategorie, lokal) — alle drei mit Gruppen-Umschalter und Avataren; Zeitfilter sind **Kalenderperioden** (Woche Mo–So / Monat / Jahr, Europe/Berlin — wie die Pokale) und mit ◀/▶ blätterbar ([DESIGN-LEADERBOARD-PERIODS.md](DESIGN-LEADERBOARD-PERIODS.md)); Migration 0016 live seit 2026-07-22 |
| Avatare & Spielerkarte | ✅ | 21 Pixel-Avatare, Picker, Karte für jede angeklickte Bestenlisten-Zeile (Migrationen 0010–0012 live) ([DESIGN-AVATARS.md](DESIGN-AVATARS.md)) |
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
| System-Back-Button → Menü statt App-Exit | ✅ | `@capacitor/app`-Listener in `App.tsx` (Home beendet weiter); Geräte-Test offen ([DESIGN-MOBILE-POLISH.md](DESIGN-MOBILE-POLISH.md)) |
| Mobile-Feedback-Runde 1 (Login-Sync, Choice-Skalierung, Pin-Overlay) | ✅ | Login lädt jetzt Level/XP/Avatar sofort (`applyAuthSession()`), Choice-Modi passen auf 360×640 ohne Scrollen, Pin-Karte ohne Zoom-Buttons + einklappbare Attribution — wirkt auch im Web |
| Emulator-Test (AVD `geoquiz_pixel7`) | 🔄 | Flaggen + Profil + Online-Login OK; Karten-Modi (Pin-Präzision) offen |
| On-Device-Test (Touch auf SVG-Karten) | ✅ | vom Nutzer durchgeführt (2026-08-03) |
| Vollbild (Immersive Mode) | ✅ | Systemleisten aus, Inhalt bis in die Kamera-Aussparung, Tastatur-Inset selbst angewendet ([DESIGN-MOBILE-POLISH.md §5](DESIGN-MOBILE-POLISH.md)) |
| `versionCode` je Release automatisch | ✅ | `release.mjs` zählt vor jedem Android-Release hoch (`--no-bump` schaltet ab) — Play nimmt nur höhere Werte an |
| Auth-Token nicht im Google-Auto-Backup | ✅ | `backup_rules.xml` + `data_extraction_rules.xml` schließen `CapacitorStorage.xml` aus |
| Feature-Grafik 1024×500 fürs Store-Listing | ✅ | `assets/feature-graphic.png`, prozedural aus `generate-app-assets.mjs` |

## Verifikation (Stand 2026-07-10)
- ✅ `npm run test` — 32 Tests grün (Scoring-Beispiele aus dem Plan, Distanztabelle, Sampler-Statistik, Daten-Integrität)
- ✅ `npm run build` — TypeScript + Vite production build fehlerfrei
- ✅ `npm run lint` — nur 3 unkritische Warnungen (bewusste `runKey`-Re-Roll-Dependencies)
- ✅ Im Browser durchgespielt: Flaggen-Runde 10/10 (Rang A, 1812 Pkt.), City-Pin Amsterdam (197 km → +34, deckt sich mit Plan-Tabelle), Umriss-Modus (Katar markiert), Cup Leg 1 → Interstitial (Zwischenstand 72/100), Bestenliste + localStorage-Persistenz bestätigt
- 🐛 Gefixt dabei: Race-Condition Timeout-vs-Klick in `useQuizSession` (Ref-Lock), unreiner setState-Updater (StrictMode)

## Pin-Datumsgrenze + Dev-Runde (2026-07-26)
- 🐛 Gefixt: Beim Auflösen einer Pin-Frage nahm die Verbindungslinie (und der
  fitBounds-Zoom) den langen Weg quer über die Weltkarte, wenn Tipp und Ziel
  diesseits/jenseits der ±180°-Naht lagen (Bora Bora ↔ Australien). Ursache
  `worldCopyJump` + Roh-Longituden; die Haversine-Distanz war stets korrekt.
  Fix: Ziel-Longitude beim Auflösen auf die Weltkopie neben dem Tipp
  normalisieren ([DESIGN-PIN-UX.md](DESIGN-PIN-UX.md)). Live verifiziert:
  Ziel-Marker landet auf 208°-Kopie, Linie kurz, Distanz 6155 km.
- 🛠️ Neu (nur Dev-Build): Dev-Runde unter `/dev` — Fragen aus selbst gewählten
  Items zusammenstellen und als echte Arcade-Runde spielen, um Grenzfälle
  reproduzierbar zu testen ([DESIGN-DEV-ROUND.md](DESIGN-DEV-ROUND.md)). Route
  + Menü-Link hängen an `import.meta.env.DEV`, im Production-Bundle nicht
  enthalten (Lazy-Import).

## Bildnachweise der Landmark-Fotos (2026-08-03)
Letzte offene Rechtsposition vor der Veröffentlichung: CC-BY(-SA) verlangt
Urheber **und** Lizenz, `docs/IMAGE_CREDITS.md` nannte bisher nur den Artikel.
- 📸 `fetch-landmark-images.mjs` zieht beides über die `extmetadata` der
  Wikipedia-/Commons-API nach. Vier alte Uploads ohne `Artist`-Feld bekommen
  den **Erst-Uploader** aus der Versionshistorie — „unbekannt" wäre bei CC-BY
  keine zulässige Namensnennung. **129/129 mit benanntem Urheber.**
- ✅ Beim Lauf hat sich **keine einzige Bilddatei geändert** — die Nachweise
  beschreiben nachweislich genau die ausgelieferten Fotos.
- 🧩 Ablage in einer eigenen `landmark-credits.json` (eigener Chunk, 9,2 KB
  gzip, per `import()`), damit die 33 KB nicht im Startbundle landen.
- 🖥️ Neuer Screen `/credits` (lazy) mit allen Foto-Nachweisen plus Länderdaten,
  Flaggen, Umriss-Topojson und Kartenkacheln; verlinkt im Profil neben der
  Datenschutzerklärung.

## Vollbild auf dem Handy (2026-08-03)
App-Feedback: „vom Handy werden die obere und untere Zeile angezeigt, deswegen
ist die App nicht im Vollbild." Fünf aufeinander aufbauende Schritte, Herleitung
in [DESIGN-MOBILE-POLISH.md §5](DESIGN-MOBILE-POLISH.md):
Systemleisten ausblenden → Kamera-Aussparung freigeben → WebView bis unter die
Aussparung ziehen → deren Höhe nativ als CSS-Variable durchreichen (die
Android-WebView meldet `env(safe-area-inset-top)` als 0) → das Tastatur-Inset
selbst anwenden, weil `setDecorFitsSystemWindows(false)` das automatische
Verkleinern abschaltet.
- ⚠️ Dabei per A/B gegen die Vorgänger-APK eine **Regression gefunden und
  behoben**: das fokussierte Passwortfeld lag zwischenzeitlich unter der
  Tastatur.
- Web bleibt unverändert (`#root`-Padding 24/48 px, auf Handybreite 12/24 px).

## Store-Listing: Texte + Screenshots (2026-08-05)
Alles Listing-Material liegt versioniert im Repo statt nur in einem
Console-Formular: [docs/STORE-LISTING.md](docs/STORE-LISTING.md).
- ✍️ **Texte**: Titel 14/30, Kurzbeschreibung 75/80 (plus 3 Alternativen),
  Vollbeschreibung 2458/4000 Zeichen — Zeichenzahlen gezählt, nicht geschätzt.
  Dazu die Antworten fürs Data-Safety-Formular (deckungsgleich mit der
  Datenschutzerklärung) und den IARC-Fragebogen.
- 📸 **7 Telefon-Screenshots** (1080×2400) in `frontend/assets/store-screenshots/`,
  aufgenommen aus einer eigens gebauten Release-APK — die letzte vom 04.08.
  war **älter als der Cup-Umbau der Bestenliste** und hätte einen überholten
  Screen gezeigt.
- ⚠️ **Zwei Motive bleiben offen**: globale Bestenliste und Pokalregal sind für
  Gäste serverseitig gesperrt, sie brauchen eine Anmeldung im Emulator durch
  den Nutzer. Play verlangt mindestens 2 Screenshots — die Pflicht ist erfüllt.
- 🐛 Nebenbefund, noch am selben Tag behoben: `lm_alhambra.jpg` war ein
  **Grundriss** von 1889, kein Foto (Wikipedia-`pageimage` der Alhambra ist
  eine Planzeichnung). Ersetzt per `MANUAL_OVERRIDES` durch „Alhambra from
  Generalife" (Martinvl, CC BY-SA 4.0); beim erneuten Skriptlauf hat sich **nur
  diese eine Datei** geändert. Scan über alle 129 Nachweise fand keinen zweiten
  Fall. Tests 138/138.

## Play-Store-Reife: Code-Teil (2026-08-03)
Details und Begründungen in [DESIGN-PLAYSTORE.md](DESIGN-PLAYSTORE.md), Abhak-Plan
in [ROADMAP Phase K](ROADMAP.md).
- 🔐 **Konto-Löschung** (Play-Pflicht seit 2023) — seit 2026-08-04 auf der
  Live-DB und E2E bestätigt (Wegwerf-Gastkonto: Profil angelegt → gelöscht →
  `user_not_found`, Profil per Cascade weg, 6/6). Migration `0017` mit
  `delete_own_account()` — parameterlos, arbeitet nur auf `auth.uid()`; alle 12
  Nutzertabellen hängen per `on delete cascade` an `auth.users`, eine
  `delete`-Anweisung räumt alles ab. In der App unter **Profil → ⚠ Konto
  löschen** mit Zwei-Stufen-Bestätigung; Reihenfolge Server → lokal, damit ein
  Serverfehler nicht den lokalen Fortschritt kostet.
- 📄 **Datenschutzerklärung** (`/datenschutz/`) und **Lösch-Anleitung**
  (`/konto-loeschen/`) als statisches HTML — ohne App und ohne JS erreichbar,
  gegen die echte Cloudflare-Pages-Laufzeit geprüft (200 mit und ohne
  Schrägstrich). Verlinkt im Profil.
- 🔢 **`versionCode`** wird vor jedem Android-Release automatisch hochgezählt.
- 🛡️ **Auth-Token** ist aus Googles Auto-Backup ausgenommen.
- ✅ **Anbieterangaben eingetragen** (2026-08-04), Kontakt `geoquizsupport@gmail.com`;
  beide Seiten sind live und auf `noindex` gesetzt — erreichbar, wie Play es
  verlangt, aber die Privatanschrift landet nicht in Suchmaschinen. Die
  Platzhalter-Sperre in `release.mjs` bleibt als Netz für künftige Textänderungen.

## Umriss-Modus: schärfer & verortet (2026-07-30)
App-Feedback (2026-07-30): „Umrisse ziemlich ungenau … man erkennt kaum das
drumherum." Details in [DESIGN-OUTLINE-DETAIL.md](DESIGN-OUTLINE-DETAIL.md).
- 🎨 **Genauigkeit:** Topojson 110m → **50m**. Deutschland hatte 68 Stützpunkte,
  jetzt 572; Niederlande 16 → 264. Der Umriss-Pool wächst von 165 auf 193 der
  194 UN-Länder — Malta, Singapur, Monaco, Malediven & Co. kamen vorher nie dran,
  weil 110m sie gar nicht kennt.
- 🎨 **Verortung:** 19 % statt 4 % Rand ums Land, Nachbarn (`#39538a`) klar vom
  Meer (`#071a3a`) abgesetzt, Zielland zuletzt gezeichnet + dunkler Trennsaum.
- ⚡ **Kosten aufgefangen:** Atlas als eigener Chunk (nicht im Startbundle,
  Prefetch im Menü) und Sichtbarkeits-Pruning über einen vorberechneten
  Umkreis-Index — sonst 154 ms statt 24 ms pro Karte. In der App über 10 Fragen
  gemessen: **keine einzige Longtask > 50 ms**.
- 🧹 `react-simple-maps` entfällt (einzige Nutzung; kein Pruning, volle
  Float-Präzision). React 18 ist damit nicht mehr an eine Peer-Dep gebunden.

## Karten-Fixes: Everest-Punkt, Umrisse, Pin-Zoom (2026-07-27)
App-Feedback (2026-07-27), drei Punkte — Details in [DESIGN-MAP-FIXES.md](DESIGN-MAP-FIXES.md).
- 🐛 Gefixt: Bei einem „komplett daneben"-Pin auf der Gegenseite (z. B. Everest,
  Tipp in Amerika) landete der grüne Ziel-Marker jenseits der ±270°-`maxBounds`
  bei lng −273° → unerreichbar, Linie lief in die Wand. Fix: Tipp **und** Ziel
  gemeinsam auf eine im pannbaren Bereich liegende Weltkopie schieben
  (`revealLngs`). Live verifiziert (Mount Rushmore, Tipp Südamerika): beide
  Marker im sichtbaren Bereich, grüner Punkt links sichtbar.
- 🐛 Gefixt: Umrisse wirkten verzerrt (flächentreue `geoEqualEarth` + grobe
  Flächen-Zoom-Heuristik). Neu: pro Land eine auf den Schwerpunkt rotierte,
  **winkeltreue `geoStereographic`** per `fitExtent` in den Rahmen gepasst —
  keine Formverzerrung, selbstrahmend, Exklaven (Guyana/Alaska/Kanaren)
  ausgeklammert, Datumsgrenze (Russland/Fidschi) sauber. Live an 2 Ländern
  geprüft: Rahmen exakt gefüllt, keine Konsolenfehler.
- 🐛 Gefixt: Pin-Auflöse-Zoom schoss bei gutem Treffer bis auf Straßenebene
  (`fitBounds` ohne `maxZoom`). Fix: `maxZoom: 5` gedeckelt.

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
