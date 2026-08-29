# 🗺️ Design-Notizen — Basemap-Wechsel: CARTO → MapLibre + OpenFreeMap

**Status:** umgesetzt · 2026-08-29
**Auslöser:** CARTO brennt seit kurzem ein Wasserzeichen
„API KEY REQUIRED — carto.com/basemaps/apikey" in die anonym abgerufenen
Raster-Kacheln. Betroffen ist der Pin-Modus (`MapPicker.tsx`), der
`dark_nolabels` nutzt.

---

## 1 · Befund

Die Kachel `https://a.basemaps.cartocdn.com/dark_nolabels/4/8/5@2x.png` liefert
weiterhin HTTP 200 — aber mit diagonalem Wasserzeichen. Es ist also kein
Ausfall, den man aussitzen kann, sondern eine bewusste Umstellung: CARTO
verlangt ab sofort einen (kostenlosen) API-Key.

### Geprüfte schlüsselfreie Ersatz-Raster

Jede Kandidaten-Kachel wurde real abgerufen und angesehen:

| Quelle | HTTP | Befund |
|---|---|---|
| `basemaps.cartocdn.com/dark_nolabels` | 200 | Wasserzeichen eingebrannt |
| Esri `Canvas/World_Dark_Gray_Base` | 200 | **Länderlabels eingebrannt** — verrät im Quiz die Antwort |
| Esri `Elevation/World_Hillshade_Dark` | 200 | kein Land/Meer-Kontrast, allein unbrauchbar |
| Stadia `alidade_smooth_dark` | 401 | Key zwingend |

Ergebnis: **es gibt keinen schlüsselfreien dunklen Raster-Basemap ohne
Beschriftung mehr**, der sich 1:1 einsetzen ließe. Der Modus braucht zwingend
„ohne Labels" — Ortsnamen auf der Karte verraten die Antwort.

---

## 2 · Entscheidung

Drei Wege standen zur Wahl:

| Weg | Kosten |
|---|---|
| **A** CARTO-Key eintragen | Kleinster Eingriff, Optik identisch. Aber: Key liegt im APK, Free-Tier ist „intended for non-commercial use", 5 Mio. Kacheln/Monat — und der Welt-Prefetch verbraucht **1360 Kacheln pro Seitenaufruf**, das Kontingent wäre nach ~3600 Aufrufen leer. Und CARTO kann die Regeln erneut ändern. |
| **B** Lokale Basemap aus `world-atlas-50m.json` | Kein Anbieter, kein Netz. Aber ab Zoom ~7 grobe Umrisse (50m-Daten ≈ 10–20 km Auflösung), und der Pin-Modus braucht gerade dort Präzision. |
| **C** MapLibre GL + OpenFreeMap | Keyless, in jedem Zoom scharf, eigener Style ohne Labels. |

**Gewählt: C.** Ausschlaggebend war, dass der Pin-Modus seine Punktgenauigkeit
über den ganzen Zoom-Bereich behält und dass kein Schlüssel in ein
veröffentlichtes APK wandert.

### Warum kompletter Umbau statt Leaflet-Brücke

`@maplibre/maplibre-gl-leaflet` würde den `<TileLayer>` an Ort und Stelle
ersetzen, ließe aber **zwei Render-Engines gleichzeitig laufen** (Leaflets
DOM-Panes + MapLibres WebGL-Canvas, bei jeder Zoom-Animation synchronisiert).
Das widerspricht direkt den Befunden aus [DESIGN-PERF-MOBILE.md](DESIGN-PERF-MOBILE.md).
Eine reine MapLibre-Implementierung ist auf dem Handy **leichter** als die
Brücke — deshalb fliegt Leaflet aus dem Pin-Modus komplett raus.

Leaflet wird nirgendwo sonst benutzt (der Umriss-Modus rendert eigenes SVG über
`d3-geo`), also verschwinden `leaflet`, `react-leaflet` und `@types/leaflet`
aus den Abhängigkeiten.

---

## 3 · Der Style: `basemap-dark-nolabels.json`

OpenFreeMap liefert unter `tiles.openfreemap.org/styles/dark` einen
Dark-Matter-Port — praktisch derselbe Look wie CARTOs `dark_nolabels`, aber
**mit** 15 Symbol-Layern (Labels). Der Style wird deshalb zur Bauzeit
umgeschrieben und **lokal mitgeliefert** (`scripts/build-basemap-style.mjs` →
`src/data/basemap-dark-nolabels.json`).

Lokal statt per URL aus zwei Gründen: eine Netzwerk-Runde weniger vor dem ersten
Frame, und — wichtiger — der Style kann sich nicht unter uns ändern. Würde
OpenFreeMap seinen Dark-Style anpassen, könnten sonst über Nacht wieder Labels
auf der Karte stehen und Antworten verraten.

### Regeln des Umschreibens

1. **Alle `type: "symbol"`-Layer raus.** Das sind ausnahmslos Beschriftungen und
   Icons (`place_country_*`, `place_city`, `water_name`, `road_oneway`, …).
2. **`glyphs` und `sprite` raus.** Ohne Symbol-Layer hat nur noch
   `landcover_wood` eine Sprite-Abhängigkeit (`fill-pattern: wood-pattern`) —
   dort wird bloß das `fill-pattern` entfernt, die Füllfarbe bleibt. Spart zwei
   Requests und die Glyph-Downloads.
3. **Quelle `ne2_shaded` raus** — im Dark-Style referenziert sie kein Layer.
4. **Layer oberhalb unseres Zoom-Fensters raus** (die Karte endet bei Zoom 10):
   `building`, `landuse_residential`, `aeroway-*`, `road_area_pier`,
   `road_pier`, `highway_path`, `highway_minor`, `railway*` erscheinen erst ab
   Zoom 13–16 und kosten sonst nur Parse- und Render-Zeit pro Kachel.
5. **Bleiben** Hintergrund, Wasser, Gletscher/Schelfeis, Wald/Park, Wasserläufe,
   Autobahnen/Fernstraßen und die Grenz-Layer — genau das Bild, das
   `dark_nolabels` gezeigt hat.

Die Vektorquelle bleibt als TileJSON-Verweis (`url: ".../planet"`) stehen, **nicht**
als fest verdrahtete Kachel-URL: OpenFreeMap versioniert die Kachel-Pfade nach
Datum (`/planet/20260823_080002_pt/…`), ein hartkodierter Pfad würde veralten.

---

## 4 · Der Umbau: `MapPicker` wird Hülle, `PinMap` wird Motor

Die Props (`resetKey`, `guess`, `revealTarget`, `disabled`, `onPick`) bleiben
unverändert — `QuizView` und `ArcadeQuizView` sind nicht angefasst.

Aufgeteilt wird trotzdem, und zwar wegen der Bundle-Größe: `maplibre-gl` ist mit
Abstand die größte Abhängigkeit der App (253 KB gzip) und wird von einem von
acht Modi gebraucht. `MapPicker.tsx` behält deshalb nur Rahmen, Attribution und
ein `Suspense`; der eigentliche Kartenmotor liegt in `PinMap.tsx` hinter
`lazy()` in einem eigenen Chunk. Das Hauptmenü stößt ihn über `prefetchPinMap()`
im Voraus an — dieselbe Mechanik wie beim 50m-Topojson
([DESIGN-OUTLINE-DETAIL.md](DESIGN-OUTLINE-DETAIL.md) #1), damit die erste
Pin-Frage nicht auf den Download wartet.

| Bisher (Leaflet) | Neu (MapLibre) |
|---|---|
| `<TileLayer url=carto>` | Style-Objekt aus `basemap-dark-nolabels.json` |
| `worldCopyJump` | `renderWorldCopies` (nativ, kein Sprung nötig) |
| `maxBounds` ±270° + `maxBoundsViscosity` | `maxBounds` ist bei aktiven World-Copies nicht nötig; die Pol-Begrenzung übernimmt MapLibres Mercator-Grenze |
| `L.divIcon`-Marker | `maplibregl.Marker` mit demselben HTML |
| `<Polyline>` | GeoJSON-Quelle + `line`-Layer mit `line-dasharray` |
| `useMapEvents({click})` | `map.on('click')` |
| `ZoomControl` | `NavigationControl` (weiterhin nur Desktop) |
| `InvalidateOnResize` | `ResizeObserver` → `map.resize()` |
| `prefetchWorldTiles()` (1360 Kacheln) | **entfällt** |

`nearestLng` / `revealLngs` bleiben unverändert bestehen: Die Datumsgrenzen-
Logik aus [DESIGN-MAP-FIXES.md](DESIGN-MAP-FIXES.md) #1 gilt für eine
GeoJSON-`LineString` genauso wie für Leaflets Polyline — beide Enden müssen auf
derselben Weltkopie liegen, sonst zeichnet MapLibre den langen Weg um die Welt.

### Prefetch entfällt — bewusst

Der Raster-Prefetch existierte, weil beim Pannen sichtbar Kacheln nachgeladen
wurden ([DESIGN-PIN-UX.md](DESIGN-PIN-UX.md)). Vektorkacheln lösen das anders:
MapLibre rendert beim Zoomen die schon geladene Geometrie weiter (kein
Unschärfe-/Lade-Effekt), und der Kachelbedarf ist um Größenordnungen kleiner.
Damit fällt auch die CPU-Spitze weg, die den Prefetch überhaupt erst in eine
Warteschlange gezwungen hat ([DESIGN-PERF-MOBILE.md](DESIGN-PERF-MOBILE.md),
Befund 4).

### Zoomstufen sind nicht dieselben Zahlen

MapLibre rechnet Zoomstufen auf **512-px-Kacheln**, Leaflet auf 256er — dieselbe
Darstellungsgröße liegt bei MapLibre also eine Stufe niedriger. Übernommen wird
deshalb nicht die Zahl, sondern der Maßstab:

| | Leaflet | MapLibre |
|---|---|---|
| Startansicht / `minZoom` | 2 | **1** |
| `maxZoom` | 10 | **9** |
| Deckel beim Auflösen (`fitBounds`) | 5 | **4** |
| Auflösen ohne Tipp | 4 | **3** |

Ohne diese Umrechnung wäre die Karte doppelt so nah gestartet.

### Kachelgröße: der eine Punkt, wo Vektor teurer ist

Gemessen an `tiles.openfreemap.org/planet` (gzip, über die Leitung):

| Zoom | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| KB/Kachel | 47 | 107 | 705 | 515 | 397 | 269 |

Der Sprung bei Zoom 2 sieht schlimmer aus, als er ist: Die Startansicht liegt
bei MapLibre-Zoom **1**, holt also z1-Kacheln — 2–4 Stück à 107 KB, zusammen
rund **0,2–0,4 MB** für die ganze Weltansicht. Das ist eher weniger als die
sichtbaren Raster-Kacheln vorher, und die 1360 vorgeladenen entfallen komplett.
Teurer wird es erst beim Heranzoomen auf eine Region (z4: ~0,4 MB/Kachel).
`Cache-Control: max-age=315360000` sorgt dafür, dass das pro Gerät einmal
anfällt.

Gegengeprüft, dass die Kacheln liefern, was der Style braucht: eine echte
z2-Kachel enthält `boundary`, `landcover`, `water` (dazu `place`/`water_name`,
die mangels Symbol-Layern nie gezeichnet werden). `landuse`, `waterway` und
`transportation` tauchen erst bei höheren Zoomstufen auf — ihre Layer zeichnen
in der Weltansicht schlicht nichts.

---

## 5 · Attribution

OpenFreeMap verlangt (TileJSON-Feld `attribution`): OpenFreeMap,
© OpenMapTiles, Daten von OpenStreetMap. Umgestellt sind `MapCredits`, der
Credits-Screen (dort auch Leaflet/react-leaflet → MapLibre GL JS) und README.

Mitgezogen wurde die **Datenschutzerklärung** (`public/datenschutz/`): Sie
nennt namentlich, an wen die IP-Adresse beim Kartenabruf geht — das ist jetzt
OpenFreeMap statt CARTO. Ohne diese Änderung wäre der Text schlicht falsch.

---

## 6 · Stolperstein: MapLibres Worker fehlt im Vite-Bundle

Erster Testlauf: **komplett schwarze Karte**, kein Konsolenfehler.

Ursache: MapLibre lädt seinen Worker über
``new URL(`./${name}`, import.meta.url)``. Der Pfad ist zusammengesetzt und
damit für Vite nicht statisch analysierbar — die Datei landet **weder** im
Dev-Prebundle (`.vite/deps/`) **noch** im Produktions-Build. Nachgewiesen mit
`curl`: HTTP **404** auf `/node_modules/.vite/deps/maplibre-gl-worker.mjs`, und
`dist/assets/` enthielt keine einzige Worker-Datei. Ohne Worker wird keine
Vektorkachel geparst; sichtbar bleibt nur die `background`-Farbe des Styles —
`rgb(12,12,12)`, also Schwarz. Das betraf **beide** Umgebungen, der Fehler wäre
also auch im Release aufgeschlagen.

Fix in `PinMap.tsx`:

```ts
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
maplibreConfig.WORKER_URL = maplibreWorkerUrl
```

`?worker&url` (nicht bloß `?url`) ist nötig, weil der Worker seinerseits
`./maplibre-gl-shared.mjs` importiert — bei einem reinen Asset-Kopiervorgang
liefe dieser Import ins Leere. Vite baut den Worker damit als eigenen Eintrag
inklusive seiner Abhängigkeiten: **478 KB roh / 128 KB gzip**, geladen erst mit
dem Kartenmotor. Preis dafür ist, dass der geteilte MapLibre-Kern zweimal im
Bundle liegt (einmal im Chunk, einmal im Worker) — die Alternative wäre, die
Dateien mit ihrer relativen Nachbarschaft von Hand nach `public/` zu kopieren
und bei jedem Update händisch nachzuziehen.

---

## 7 · Stolperstein: `LngLatBounds` sortiert nicht

Zweiter Testlauf, Nutzer-Report: beim Auflösen wird „wo anders hingezoomt /
rausgezoomt", Marker und Linie wirken irreführend.

Ursache: `new LngLatBounds(sw, ne)` erwartet ausdrücklich **Südwest- und
Nordost-Ecke** und normalisiert nichts. Übergeben wurden aber Tipp und Ziel in
der Reihenfolge, in der sie anfielen. Sobald der Tipp nördlich **oder** östlich
vom Ziel lag — also in den meisten Runden —, war die Box invertiert und
`fitBounds` rechnete auf einer Box mit negativer Ausdehnung: Kamera an der
falschen Stelle, Zoom viel zu weit draußen. Die Marker standen dann irgendwo am
Rand oder außerhalb, was den Eindruck „irreführend" erklärt.

Leaflets `latLngBounds(a, b)` hatte die Ecken still einsortiert — beim Portieren
fiel das deshalb nicht auf, und im Code sieht die Zeile völlig unauffällig aus.

Zweiter Unterschied, im selben Zug korrigiert: Leaflet vergrößerte den Rahmen um
**40 % seiner eigenen Größe** (`.pad(0.4)`), die erste MapLibre-Fassung nahm
stattdessen feste 48 px. Bei weit auseinanderliegenden Punkten ist das ein
deutlich anderer Auflöse-Zoom — und der war über eine Feedback-Runde austariert
([DESIGN-MAP-FIXES.md](DESIGN-MAP-FIXES.md) #3), also wird jetzt wieder
proportional gepolstert.

Beides steckt in `revealBounds()`. Die Auflöse-Geometrie ist dafür aus der
Komponente heraus nach `features/geo/pinMapGeometry.ts` gewandert — ohne
MapLibre-Typen und damit ohne DOM testbar. **10 neue Unit-Tests** halten die
Invarianten fest, allen voran „Ecken sind sortiert, egal in welcher Reihenfolge
die Punkte kommen".

---

## 8 · Zwei Funde aus dem gemeinsamen Testlauf

**Marker unter der HUD-Leiste.** Im Handy-Vollbild liegen Kopf- und
Aktionsleiste *über* der Karte (`index.css`, `@media (max-width: 900px),
(pointer: coarse)`). `fitBounds` kennt aber nur den Container und zentriert in
die volle Fläche — der blaue Tipp-Marker landete beim Auflösen unter der
Kopfleiste und war schlicht nicht zu sehen. Behoben mit `overlayPadding()`:
Die Leisten werden **gemessen** statt geschätzt (sie sind je nach Modus
verschieden hoch — der Landmark-Modus hat ein Foto in der Kopfzeile) und als
asymmetrisches `padding` an `fitBounds` gereicht, gedeckelt auf 35 % der
Kartenfläche. Auf dem Desktop überlappt nichts, dort fallen beide Werte auf 0
zurück und der austarierte Auflöse-Zoom bleibt unverändert.

**Weiße Zoom-Buttons.** MapLibres eigenes Stylesheet wird über den lazy
geladenen `PinMap`-Chunk eingehängt und landet damit **nach** `index.css` im
Dokument. Bei gleicher Spezifität (`.maplibregl-ctrl-group` gegen
`.maplibregl-ctrl-group`) gewinnt das später geladene — die Buttons blieben in
MapLibres Weiß statt im 8-Bit-Look. Alle eigenen Karten-Regeln stehen jetzt mit
`.map-frame` davor. Das ist die generelle Falle bei lazy geladenem
Bibliotheks-CSS und gilt für jede künftige Regel an der Karte.

---

## 9 · Optische Abstimmung: die Rangfolge der Linien

Nutzer-Rückmeldung nach dem Umstieg: „die Landesgrenzen sind nicht mehr so gut
erkennbar".

Das lag nicht an MapLibre, sondern am geerbten Style. OpenFreeMaps Dark ist —
wie CARTOs Dark Matter — als **Hintergrund für farbige Daten-Overlays**
entworfen und hält sich deshalb absichtlich zurück. Im Quiz ist die Karte aber
der Hauptdarsteller: Küstenlinien und Ländergrenzen sind das Einzige, woran man
sich orientieren kann. Drei Dinge kamen zusammen:

| | Geerbt | Wirkung |
|---|---|---|
| Land ↔ Wasser | `rgb(12,12,12)` ↔ `rgb(27,27,29)` | 15 Helligkeitsstufen Unterschied — auf einem Handy bei Tageslicht praktisch keine Küstenlinie |
| Ländergrenze | `hsl(0,0%,23%)` + `line-blur` | dunkelgrau **und** weichgezeichnet |
| Breiten-Kurve | erster Stützpunkt bei Zoom 3 | darunter — also in **unserer Startansicht** — klemmt sie auf der schmalsten Stufe |

Der Style wird jetzt im Build-Skript nachjustiert (Block `TWEAKS`), mit einer
klaren Rangfolge als Leitgedanke:

> **Küstenlinie > Ländergrenze > Bundesland-/Provinzgrenze**

- **Wasser** auf `rgb(38,38,45)` — die Küste ist der wichtigste Anker.
- **Ländergrenzen** auf `rgb(112,112,118)`, ohne Blur, Breiten-Kurve ab Zoom 1
  statt 3. Damit tragen sie schon in der Weltansicht.
- **Innere Grenzen** sind in der Weltansicht **gar nicht da**: `minzoom` 3,5 und
  eine Deckkraft-Rampe von 0 (Zoom 3,5) auf 0,65 (Zoom 5), dazu ein dunklerer
  Ton. Ein Land soll beim Herauszoomen nicht optisch in Einzelteile zerfallen —
  erst wer hineinzoomt, bekommt den Kontext dazu.

Nachgeprüft im Browser über den ganzen Zoom-Bereich: Weltansicht nur
Ländergrenzen, ab ~Zoom 6 blenden sich die inneren Grenzen als sichtbar
schwächere gestrichelte Linien ein.

Alle Werte stehen als benannte Konstanten im Skript. Nachjustieren heißt:
Zahl ändern, `node scripts/build-basemap-style.mjs`, Seite neu laden.

---

## 10 · Verifikation

- `validateStyleMin` auf dem erzeugten Style: **0 Fehler**, 0 Symbol-Layer.
- Vektorkachel z2 dekodiert, enthält die vom Style referenzierten
  Source-Layer (siehe §4).
- Build: Kartenmotor liegt als eigener Chunk (`PinMap`, 253 KB gzip JS +
  11 KB gzip CSS) plus Worker (128 KB gzip), Hauptbundle **194 KB gzip**.
- Worker im Dev-Server erreichbar (HTTP 200, 129 KB) und im Build als
  `assets/maplibre-gl-worker-*.js` emittiert, vom Chunk referenziert.
- Tests **148/148** (inkl. 10 Tests auf die Auflöse-Geometrie), `tsc -b` und `oxlint` sauber.
- Im Dev-Server läuft der Pin-Modus: Chunk wird geladen, Canvas hängt im
  Container (1040×440), Zoom-Control da, Attribution zeigt die neue Quelle.
  **Offen:** optische Abnahme am Gerät bzw. im sichtbaren Browser-Fenster —
  die Vorschau war während der Umsetzung nicht eingeblendet und rendert ohne
  Compositing kein WebGL.
