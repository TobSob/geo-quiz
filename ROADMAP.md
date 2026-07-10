# 🗺️ Roadmap — GeoQuiz

> Die nächsten Phasen als abhakbarer Plan. Bei jedem erledigten Schritt: Status hier umstellen **und** einen Eintrag im [Verlauf](#verlauf) ergänzen.
> Abgeschlossene Phasen 0–4 sind in [STATUS.md](STATUS.md) dokumentiert.

Legende: ⬜ offen · 🔄 in Arbeit · ✅ fertig · ⚠️ blockiert (Grund in Notiz) · ⏭️ übersprungen

---

## Phase A — Web-Deployment 🚀

*Ziel: Das Spiel ist unter einer öffentlichen URL vom Handy aus spielbar. Geringster Aufwand, sofortiger Nutzen — und ein realer Mobile-Test vor dem Android-Aufwand.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| A1 | Hosting-Entscheidung (Cloudflare Pages / GitHub Pages / Netlify) | ⬜ | Empfehlung: Cloudflare Pages (Git-Integration, Build-Env-Vars, schnelles CDN, kein Traffic-Limit im Free Tier) |
| A2 | Build-Env am Host konfigurieren (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | ⬜ | Werden zur Buildzeit eingebacken — Anon-Key ist öffentlich, darf ins Build-Env |
| A3 | Deploy einrichten (Git-Push → Auto-Build aus `frontend/`) | ⬜ | Build-Command `npm run build`, Output `frontend/dist` |
| A4 | Supabase-Auth-Konfiguration: Site-URL + Redirect-URLs auf die neue Domain | ⬜ | Wichtig für die Bestätigungs-Mail des Account-Upgrades |
| A5 | Smoke-Test Desktop: alle 8 Modi einmal anspielen, Anmeldung, Leaderboard | ⬜ | |
| A6 | Smoke-Test Handy (echtes Gerät): Touch auf Leaflet-Pins, Umriss-Karte, Lesbarkeit der Pixel-Fonts | ⬜ | Erster echter Mobile-Praxistest — Erkenntnisse fließen in Phase B |
| A7 | Live-URL in README + GitHub-About eintragen | ⬜ | |

**Fertig-Kriterium:** Eine fremde Person kann die URL öffnen, sofort spielen und sich optional registrieren.

---

## Phase B — Android-App (Capacitor) 🤖

*Ziel: Installierbare Android-App mit zuverlässiger Session-Persistenz. Voraussetzung: Phase A abgeschlossen (Mobile-Erkenntnisse) und Android Studio installiert.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| B1 | **Voraussetzung (manuell):** Android Studio + SDK installieren | ⚠️ | Aktuell kein SDK auf der Maschine (kein `ANDROID_HOME`, kein adb) — einzige manuelle Vorleistung |
| B2 | Capacitor einrichten: `@capacitor/core` + `cap init` (App-ID z. B. `de.tobsob.geoquiz`) | ⬜ | |
| B3 | `npx cap add android` — Android-Projekt generieren | ⬜ | `android/` kommt ins Repo |
| B4 | Supabase-Session auf Capacitor-Storage-Adapter umstellen (Preferences-Plugin statt localStorage) | ⬜ | Kernpunkt aus dem Plan: sonst überlebt die anonyme Identität App-Neustarts nicht zuverlässig |
| B5 | Emulator-Test: alle Modi, Fokus Karten (Pan/Zoom/Tap-Präzision, Stress-Test kleine Länder wie Luxemburg) | ⬜ | |
| B6 | Test auf echtem Gerät (`npx cap run android`) | ⬜ | braucht USB-Debugging |
| B7 | App-Icon + Splash-Screen im 8-Bit-Look | ⬜ | `@capacitor/assets` generiert alle Größen aus einer Vorlage |
| B8 | Signierter Release-Build (`.aab`/`.apk`) | ⬜ | Keystore anlegen und **sicher verwahren** — Play-Store-Upload optional/später |

**Fertig-Kriterium:** App startet auf einem echten Gerät, anonyme Session überlebt Neustart, Karten sind präzise bedienbar.

---

## Phase C — Polish ✨

*Ziel: Das „richtig gut"-Finish. Reihenfolge nach Impact sortiert, Punkte sind unabhängig voneinander abhakbar.*

| # | Schritt | Status | Notiz |
|---|---|---|---|
| C1 | 8-Bit-Sound-Effekte via WebAudio (richtig/falsch/Streak/Bullseye/Cup-Fanfare) + Mute-Toggle | ⬜ | Chiptune-Bleeps direkt per Oszillator synthetisieren — keine Audio-Assets nötig |
| C2 | Code-Splitting: Leaflet + Topojson lazy laden (`React.lazy` pro Route) | ⬜ | Bundle aktuell ~700 KB JS; Ziel: < 300 KB initial |
| C3 | Haptics auf Android (`@capacitor/haptics` bei richtig/falsch) | ⬜ | erst nach Phase B sinnvoll |
| C4 | Screen-Übergänge + Feedback-Animationen verfeinern (steps()-Transitions, Konfetti-Pixel bei Rang S) | ⬜ | |
| C5 | PWA-Manifest + Service Worker (installierbar am Handy, echtes Offline-Caching) | ⬜ | günstige Alternative/Ergänzung zur Android-App |
| C6 | Cup-Ergebnis: Balken-Breakdown pro Disziplin statt nur Tabelle | ⬜ | |
| C7 | `npm audit`-Findings prüfen (5 high, transitiv) | ⬜ | vermutlich Dev-Dependencies — prüfen, ob Runtime betroffen |

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
| 2026-07-10 | Roadmap angelegt; Phasen A–C definiert. Vorleistung für B1 identifiziert: Android Studio fehlt auf der Maschine |
| 2026-07-10 | ← davor: Phasen 0–4 abgeschlossen (siehe [STATUS.md](STATUS.md)) — spielbares Spiel mit 8 Modi, Supabase-Backend, Account-System, gegatete Leaderboards, Repo auf GitHub |
