# Karte & Basemap

> **Stand:** 2026-08-30 · **Verifiziert:** `src/components/PinMap.tsx`,
> `scripts/build-basemap-style.mjs`, `src/data/basemap-dark-nolabels.json`

## Aufbau

MapLibre GL 6 **ersetzt Leaflet + react-leaflet vollständig** (seit
2026-08-29). Nicht über `maplibre-gl-leaflet` — die Brücke ließe zwei
Render-Engines parallel laufen. `MapPicker` ist nur noch Hülle (Rahmen,
Attribution, `Suspense`), der Motor liegt in `PinMap.tsx` hinter `lazy()` und
wird aus dem Menü vorgeladen.

## Style: lokal, ohne Beschriftungen

Der Style wird **zur Bauzeit** aus OpenFreeMaps Dark-Style erzeugt und lokal
mitgeliefert (5,6 KB statt 21 KB): 15 Symbol-Layer raus (das sind die
Beschriftungen — sie würden im Quiz die Antwort verraten), 16 Layer oberhalb
Zoom 10 raus, `glyphs`/`sprite` entfallen dadurch ganz.

**Lokal statt per URL**, damit OpenFreeMap nicht über Nacht wieder Labels
einblenden kann. Nachjustieren = Zahl in `TWEAKS` ändern und
`build-basemap-style.mjs` laufen lassen; alle Werte sind benannte Konstanten.

Sichtbarkeits-Rangfolge im Style: **Küstenlinie > Ländergrenze >
Bundeslandgrenze**. Innere Grenzen sind in der Weltansicht bewusst ganz aus
(`minzoom` 3,5 + Deckkraftrampe bis Zoom 5), damit ein Land beim Herauszoomen
nicht optisch zerfällt.

## Fallen, die dieses Projekt bezahlt hat

- **Worker-Pfad:** MapLibre lädt seinen Worker über einen zusammengesetzten
  Pfad, den Vite nicht statisch auflöst. Ohne den Fix
  (`maplibre-gl-worker.mjs?worker&url` → `config.WORKER_URL`) wird keine
  Vektorkachel geparst: **schwarzer Bildschirm, kein Konsolenfehler.** Hätte
  genauso im Release zugeschlagen.
- **`LngLatBounds(sw, ne)` normalisiert nicht.** Ecken müssen sortiert
  übergeben werden, sonst ist die Box invertiert und das Auflösen zoomt
  irgendwohin. Leaflet hat das still einsortiert — portierter Code sieht
  deshalb unauffällig aus. Invarianten liegen jetzt in
  `features/geo/pinMapGeometry.ts` mit 10 Unit-Tests fest.
- **Padding:** Leaflet polsterte um 40 % der eigenen Größe (`.pad(0.4)`), nicht
  um feste Pixel. Der Auflöse-Zoom war über eine Feedback-Runde austariert.
- **Überlagernde Leisten:** Im Handy-Vollbild liegen Kopf- und Aktionsleiste
  über der Karte; `overlayPadding()` misst sie und reicht asymmetrisches
  Padding weiter, gedeckelt auf 35 % der Fläche.
- **CSS-Reihenfolge:** MapLibres Stylesheet kommt über den lazy geladenen
  Chunk und wird damit **nach** `index.css` eingehängt. Eigene Kartenregeln
  brauchen `.map-frame` davor, sonst gewinnt MapLibre bei gleicher Spezifität.

## Warum nicht CARTO/Esri/Stadia

CARTO brennt seit 2026-08 „API KEY REQUIRED" in jede Kachel (liefert weiter
HTTP 200 — der Ausfall ist also unsichtbar). Esri `World_Dark_Gray_Base` hat
eingebrannte Länderlabels, `World_Hillshade_Dark` keinen Land/Meer-Kontrast,
Stadia antwortet 401. Alle vier real abgerufen und angesehen.

## Vertiefung

- [../../DESIGN-BASEMAP.md](../../DESIGN-BASEMAP.md) — der komplette Umbau
- [../../DESIGN-MAP-FIXES.md](../../DESIGN-MAP-FIXES.md) — Datumsgrenze, Auflöse-Zoom
- [../../DESIGN-PIN-UX.md](../../DESIGN-PIN-UX.md) — Bedienung der Pin-Modi
