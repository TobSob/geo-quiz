# 🗺️ Design-Notizen — Umriss-Modus schärfen & verorten

**Status:** umgesetzt · 2026-07-30
**Auslöser:** App-Feedback (2026-07-30): „Die Umrisse sind ziemlich ungenau —
der Fix war, dass sie nicht mehr verzerrt werden. Ich hätte gerne, dass es
genauer ist oder dass man besser sieht, wo der Umriss liegt; man erkennt kaum
das drumherum."

Zwei getrennte Probleme in einem Satz:

1. **Genauigkeit** — die Silhouette selbst ist grob (110m-Topojson).
2. **Verortung** — das Land schwebt im Nichts, Nachbarn und Küstenlinien sind
   praktisch unsichtbar.

[DESIGN-MAP-FIXES.md](DESIGN-MAP-FIXES.md) #2 hat die *Verzerrung* behoben
(winkeltreue, zentrierte Projektion) — an der Auflösung und am Kontrast hat es
nichts geändert. Genau da setzt diese Runde an.

---

## 1 · Genauigkeit — 110m → 50m

### Befund

`world-atlas countries-110m` ist auf Weltkarten-Zoom ausgelegt. Der Umriss-Modus
zoomt aber auf **ein** Land — dabei bleiben pro Land lächerlich wenige
Stützpunkte übrig:

| Land | 110m | 50m |
|---|---:|---:|
| Niederlande | 16 | 264 |
| Dänemark | 25 | 298 |
| Kroatien | 47 | 380 |
| Deutschland | 68 | 572 |
| Griechenland | 58 | 927 |
| Japan | 65 | 1 097 |
| Norwegen | 91 | 1 988 |
| Chile | 117 | 2 010 |

Deutschland mit 68 Punkten heißt: die halbe Nordseeküste sind drei gerade
Strecken. Das ist der „ungenau"-Eindruck — kein Projektions-, sondern ein
Datenproblem.

Nebeneffekt: 110m kennt **61 Länder gar nicht**. Der Umriss-Pool war deshalb
per `outlineRenderableIso2` auf 165 der 194 Quiz-Länder eingeschränkt — Malta,
Singapur, Monaco, Malediven, Nauru & Co. kamen im Modus nie dran.

### Entscheidung

Wechsel auf `countries-50m` (756 KB roh, ~236 KB gzip; 110m: 108/39 KB).
Umriss-Pool wächst dadurch von **165 auf 193** Länder (bewusst so entschieden —
die 28 Kleinstaaten sind mit dem neuen Kontext drumherum lösbar).

Die Datei geht **nicht** in den Hauptbundle, sondern wird per `import()` als
eigener Chunk geladen (`world-atlas-50m-*.js`, 756 KB / 243 KB gzip), angestoßen
schon beim Öffnen des Hauptmenüs. Damit kostet die höhere Auflösung nichts beim
App-Start — die alte Sorge aus `docs/DEVELOPMENT.md` („bremst den First Paint")
ist damit erledigt, nicht ignoriert.

---

## 2 · Zeichenkosten — Sichtbarkeits-Pruning

10× mehr Stützpunkte heißt auch 10× mehr Projektionsarbeit. Gemessen (Node,
Desktop, Mittel über 20 Länder, komplette Kartengenerierung):

| | ø | max |
|---|---:|---:|
| 110m, alle 177 Länder | 21 ms | — |
| 50m, alle 241 Länder | **154 ms** | 195 ms |
| 50m + Pruning | **24 ms** | 70 ms |

Ohne Gegenmaßnahme wäre jede Umriss-Frage auf dem Handy ein sichtbarer Ruckler.

**Pruning:** Zu jedem Land wird zur Bauzeit ein sphärischer **Umkreis**
(Schwerpunkt + Radius) berechnet und in `src/data/outline-index.json` abgelegt.
Zur Laufzeit ergibt die Projektionsskala den sichtbaren Kappenradius
(stereographisch: `θ = 2·atan(r_px / 2k)`, `r_px` = halbe Rahmendiagonale);
gezeichnet wird nur, wessen Umkreis diese Kappe schneidet. Das Zielland ist
immer dabei.

Die Umkreis-Berechnung selbst kostet über den 50m-Datensatz ~126 ms — deshalb
zur **Bauzeit** (`scripts/build-outline-atlas.mjs`), nicht beim Start.

Der Index ersetzt zugleich den alten Trick, das komplette 110m-Topojson nur für
die Liste der zeichenbaren Länder in `src/data/index.ts` zu importieren — dort
fällt der Hauptbundle um ~108 KB.

**`react-simple-maps` entfällt.** Es war die einzige Nutzung im Projekt, hat
aber alle Geographien gerendert (kein Pruning) und `geoPath` mit voller
Float-Präzision — bei 50m sind das ~150 KB Pfad-Text pro Karte. Der Umriss
wird jetzt direkt als SVG gezeichnet, mit `geoPath().digits(1)`.

---

## 3 · Verortung — Kontext sichtbar machen

Vier Änderungen, die zusammen das „man erkennt kaum das drumherum" beheben:

| | vorher | nachher |
|---|---|---|
| Rand ums Land (`fitExtent`-Pad) | 4 % | **19 %** |
| Meer | `#0e1a2e` | `#071a3a` |
| Nachbarländer | `#1b1935` (Δ zum Meer kaum sichtbar) | `#39538a` |
| Küsten/Grenzen der Nachbarn | `#3a3565`, 0,6 | `#8fb2e8`, 1,1 |
| Zielland | gelb, rot 1,6 | gelb, rot 2,4 + dunkler Trennsaum 7 |

- **Padding 19 %** — das Land füllte den Rahmen bis auf 4 % Rand aus; für
  Kontext war schlicht kein Platz. Der Rand ist ein *Anteil* der Landgröße,
  skaliert also von Monaco bis Russland gleich mit.
- **Land/Meer-Kontrast** — vorher lagen Meer und Land 3 Helligkeitsstufen
  auseinander, auf einem Handy im Hellen nicht unterscheidbar.
- **Zeichenreihenfolge** — das Zielland wird jetzt **zuletzt** gezeichnet.
  Vorher lag es in Datensatz-Reihenfolge, ein größerer Nachbar konnte seinen
  Rand überdecken.
- **Trennsaum** — ein dunkler, breiter Stroke unter dem Zielland trennt es
  sauber vom Nachbarland, auch wo beide direkt aneinandergrenzen.

Optik-Variante vom Nutzer aus einem 3-Wege-Vergleich gewählt (dezent / kräftig /
nur schärfer) → **kräftig**.

---

## Gegenprobe in der App

Trainingsmodus, Kategorie „Umrisse", 10 Fragen in Folge (Chrome, Desktop):

- Jede Frage rendert Zielland + 3–14 Nachbarn (Pruning greift, nichts fehlt).
- `PerformanceObserver('longtask')`: **keine einzige Aufgabe > 50 ms** über alle
  10 Fragen — vor dem Pruning wäre allein die Projektion bei ~154 ms gelegen.
- Farben im DOM geprüft: Meer `rgb(7,26,58)`, Nachbarn `#39538a`, Ziel `#ffec27`.
- Produktionsbuild: Atlas landet als eigener Chunk, Hauptbundle 840 KB / 239 KB
  gzip (ohne Topojson und ohne `react-simple-maps`).

---

## Bewusst nicht gemacht

- **Keine Ländernamen/Labels im Kontext** — das würde die Frage beantworten.
- **Keine Vereinfachung (topojson-simplify)** der 50m-Daten. Das Pruning bringt
  den Ausschlag; eine zusätzliche Simplifizierung würde genau die Details
  wegnehmen, um die es hier geht.
- **Kein Gradnetz** — bei diesem Zoom nur Bildrauschen.
- **Kein 10m-Datensatz** — 8,6 MB, ohne erkennbaren Gewinn bei 300 px Kartenbreite.
