# DESIGN-MOBILE-POLISH — App-Feedback-Runde 1 (2026-07-19)

> Vier Feedback-Punkte aus dem ersten Geräte-Test der Android-App (Capacitor).
> Punkte 2–4 betreffen Web + App gleichermaßen (gleiche Codebasis).
> Verwandte Docs: [DESIGN-PIN-UX.md](DESIGN-PIN-UX.md) (Pin-Layout),
> [DESIGN-AUTH.md](DESIGN-AUTH.md) (Login-Flows),
> [DESIGN-GAMIFICATION.md](DESIGN-GAMIFICATION.md) (XP/Level).

## 1. Android-Zurück-Button → Menü statt App-Exit

**Problem:** Der System-Back-Button (Geste/Navigationsleiste) schließt die App —
mitten in einer Runde besonders ärgerlich.

**Regel:**
- Auf jeder Route außer Home führt der System-Back-Button zurück zum Hauptmenü (`/`).
  Eine laufende Runde wird damit verlassen (wie „Aufgeben" → Menü).
- Auf dem Home-Screen behält er sein Systemverhalten: App beenden (`exitApp`).

**Umsetzung:** `@capacitor/app`-Plugin; sobald ein `backButton`-Listener
registriert ist, übernimmt er das Verhalten komplett. Listener nur auf nativer
Plattform (`Capacitor.isNativePlatform()`) — im Browser bleibt die
Browser-History unangetastet. Registriert in `App.tsx` (einmalig, liest die
Route zur Event-Zeit aus dem Hash, damit der Listener nicht bei jedem
Routenwechsel neu hängt).

## 2. Login lädt Level/XP/Avatar nicht (Web + App)

**Problem:** Nach „Anmelden" mit bestehendem Account erscheint zwar der Name
(Profilzeile), aber Level-Chip, XP, Abzeichen und Pokale bleiben leer und der
Avatar bleibt der Geräte-Avatar. Ursache: `gamificationStore.load()` und
`reconcileAvatar()` liefen nur im App-Start-Effekt (`App.tsx`) — der
E-Mail-Login-Pfad (`LoginPanel`) setzte nur `setOnline()`. Der OAuth-Pfad war
nicht betroffen (voller Page-Reload → Start-Effekt läuft).

**Regel:** Es gibt genau EINEN Ort, der nach jedem Session-Wechsel den
Account-Zustand herstellt: `applyAuthSession(auth)` in
`src/features/auth/applySession.ts`:
1. `userStore.setOnline/setOffline`
2. `flushProgress()` (Offline-Queue dem — ggf. neuen — Account zurechnen)
3. `reconcileAvatar()` (Server-Avatar folgt dem Account)
4. registriert → `gamificationStore.load()`, Gast/offline → `reset()`

Verwendet von: App-Start, E-Mail-Login, E-Mail-Registrierung, Logout.

**Abgrenzung (kein Bug):** „Meine Rekorde" und der Lern-Fortschritt des
adaptiven Samplers sind bewusst gerätelokal (localStorage) — die wandern beim
Login nicht mit; global sichtbare Bestleistungen kommen vom Server-Leaderboard.

## 3. Choice-Modi: Antworten ohne Scrollen (Handy-Hochformat)

**Problem:** Bei Flags/Outline schieben Grafik + 4 Antworten die letzten
Optionen unter die Falz — auf Handys wurde das Grid wegen
`minmax(220px, 1fr)` außerdem einspaltig (4 gestapelte Buttons).

**Regeln (Media ≤ 600 px Breite):**
- Antwort-Grid fest **2-spaltig** (`.choice-grid`), kompakte Buttons
  (Display-Font 9 px, engeres Padding), lange Ländernamen brechen um.
- Grafiken deckeln zusätzlich per **dvh** (dynamische Viewport-Höhe, robust
  gegen einfahrende Browser-Leisten): Flagge ≤ 21 dvh, Outline-Karte ≤ 36 dvh.
- Abstände gestrafft: Screen-/Stack-Gap 8 px, Header-Abstand 14 px statt 28 px,
  `#root`-Padding oben 12 px, Prompt (h2) 12 px.
- Das Grid wandert von Inline-Styles in die Klasse `.choice-grid`
  (QuizView + ArcadeQuizView teilen sie).

**Ziel-Messlatte:** 360 × 640 (kleines Handy) zeigt HUD, Timer, Frage, Grafik
und alle 4 Antworten ohne vertikales Scrollen.

## 4. Pin-Modus: Karten-Overlay unten links aufräumen

**Problem:** Zoom-Control + OSM/CARTO-Attribution (beide bottomleft) verdecken
den Aufgeben-Button bzw. die Feedback-Anzeige der Floating-Action-Bar.

**Regeln:**
- **Zoom-Buttons:** im mobilen Fullscreen-Layout komplett ausgeblendet —
  Pinch-Zoom deckt das ab. Desktop (Fenster > 900 px, feiner Zeiger) behält
  sie unten links.
- **Attribution:** Leaflets `AttributionControl` ersetzt durch eigenes
  `MapCredits`-Element unten **rechts** im Kartenrahmen:
  - Desktop: Text „© OpenStreetMap © CARTO" dauerhaft sichtbar (Lizenzpflicht).
  - Mobil: eingeklappt auf ein ⓘ-Icon, Tap klappt die Links auf/zu — über der
    Action-Bar positioniert, verdeckt nichts. Einklappbare Attribution auf
    kleinen Screens entspricht der gängigen Auslegung der OSM/CARTO-Vorgaben.
  - Liegt als Geschwister des Leaflet-Containers im `.map-frame` — Taps darauf
    setzen keinen Pin.

## Umsetzungs-Log

- 2026-07-19: Alle vier Punkte umgesetzt. Neu: `@capacitor/app`-Dependency,
  `features/auth/applySession.ts`, `.choice-grid`/`.map-credits`-CSS,
  `MapCredits` in `MapPicker.tsx`. Verifikation: Vitest 113/113, tsc/oxlint/
  Build grün, `gradlew assembleDebug` grün, Browser-DOM-Messungen 360×640
  (Antwort-Grid 2×2, letzte Antwort bei y=533 < 640, Seite exakt 640 px hoch,
  Zoom-Control `display:none`, ⓘ bei y=548–576 kollisionsfrei zum
  Aufgeben-Button y=593–630, Toggle klappt Panel bei y=552–572 auf, kein
  Pin-Fehlklick) und Desktop 1280 px (4-spaltiges Grid, Flagge 240×180,
  Zoom sichtbar, Attribution ausgeklappt, Toggle versteckt).
  Offen: Geräte-Bestätigung Back-Button + Login-E2E mit echtem Account.
