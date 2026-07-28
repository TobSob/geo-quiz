# 🛠️ Design-Notizen — Karten-Fixes (Pin-Auflösen & Umrisse)

**Status:** umgesetzt · 2026-07-27
**Auslöser:** App-Feedback (2026-07-27), drei Kartenprobleme:

1. **Everest-Fall:** Ziel wird „links vom Tipp" angezeigt, aber der grüne Punkt
   ist nicht erreichbar — nach links wischen lässt Linie **und** Punkt
   verschwinden.
2. **Umrisse:** Die Skalierung wirkt verzerrt.
3. **Pin:** Das automatische Reinzoomen nach dem Pinsetzen wirkt komisch.

---

## 1 · Grüner Ziel-Punkt jenseits der `maxBounds` (`MapPicker.tsx`)

### Befund

`nearestLng(target, guess)` holt das Ziel auf die Weltkopie **neben dem Tipp**,
damit die Linie den kurzen Weg über die Datumsgrenze nimmt (Fix vom 2026-07-26,
[DESIGN-PIN-UX.md](DESIGN-PIN-UX.md)). Ankerpunkt ist aber die **Roh-Longitude
des Tipps** — und die kann das Ziel aus dem pannbaren Bereich schieben.

Rechnerisch reproduziert für Everest (lng 86,9°): bei einem „komplett daneben"-
Tipp in Amerika/Ostpazifik (lng ≈ −100° … −175°) landet der grüne Marker bei
**lng −273,1°**. Die `maxBounds` gehen nur bis **−270°**, und
`maxBoundsViscosity: 1.0` lässt nicht weiter nach links pannen → Marker und Linie
liegen hinter der unsichtbaren Wand, der grüne Punkt ist unerreichbar. Exakt das
gemeldete Symptom.

### Fix

Nicht das Ziel an den Roh-Tipp ankern, sondern **beide Enden gemeinsam** um
360°-Vielfache verschieben, sodass ihr Mittelpunkt in (−180°, 180°] liegt. Die
Linienlänge hängt nur von der Differenz ab → Darstellung identisch, aber beide
Enden bleiben garantiert innerhalb ±270°.

Neuer Helper `revealLngs(guessLng, targetLng)` → `{ guessLng, targetLng }`,
genutzt von Marker, Polyline und `RevealView.fitBounds`. Verifiziert:

| Fall | Tipp → Ziel (vorher) | Tipp → Ziel (nachher) | in Bounds |
|---|---|---|---|
| Everest, Tipp @ −100° | −100 → **−273,1** ❌ | 260 → 86,9 | ✅ |
| Everest, Tipp @ −160° | −160 → **−273,1** ❌ | 200 → 86,9 | ✅ |
| Bora Bora, Tipp @ 150° | 150 → 208,3 | 150 → 208,3 | ✅ (unverändert) |

---

## 2 · Umrisse verzerrt — Projektionswechsel (`CountryOutline.tsx`)

### Befund

`ComposableMap` nutzte die Default-Projektion `geoEqualEarth` — **flächentreu,
nicht winkeltreu**. Beim Reinzoomen auf ein Land verzerrt das die lokale Form
(Scherung abseits des 0°-Meridians, Stauchung Richtung Pol). Dazu die grobe
`zoomForArea`-Heuristik (6 Flächen-Stufen), die längliche Länder (Chile, Norwegen)
oben/unten aus dem Rahmen laufen ließ.

Naiver Wechsel auf `geoMercator` scheitert: Mercator streckt vertikal mit der
Breite (1/cos φ) → Norwegen/Kanada laufen über (numerisch geprüft: NO hFrac 2,0).

### Fix — selbstrahmende, zentrierte, winkeltreue Projektion

Pro Land eine **auf den Landesschwerpunkt rotierte, winkeltreue
`geoStereographic`** bauen und per `fitExtent` in den Rahmen einpassen:

```
geoStereographic().rotate([-lng, -lat]).clipAngle(90)
  .fitExtent([[PAD,PAD],[W-PAD,H-PAD]], clippedFeature)
```

- **Winkeltreu + zentriert** → keine Form­verzerrung, breitengrad­unabhängig.
- **`fitExtent`** rahmt jedes Land automatisch korrekt — die `zoomForArea`-
  Heuristik entfällt komplett.
- **`rotate([-lng, …])`** legt den Mittelmeridian aufs Land → Länder über der
  Datumsgrenze (Russland, Fidschi) werden nicht mehr zerrissen.
- **Exklaven-Clipping:** Polygonteile > 35° vom Schwerpunkt entfernt (Guyana bei
  FR, Alaska/Hawaii bei US, Kanaren bei ES, Azoren bei PT …) fließen **nicht** in
  `fitExtent` ein — sonst würde das Kernland winzig gerahmt. Sie werden weiter
  gezeichnet, treiben aber den Zoom nicht. Bleibt geometrie-robust (kein Land
  läuft über), weil gefittet statt geschätzt wird.

Numerisch über 23 Länder (Mikrostaaten bis Russland, inkl. Exklaven- und
Datumsgrenzen-Fälle) geprüft: alle füllen den Rahmen (hFrac ≈ 0,84 bzw. wFrac
≤ 0,92), keins läuft über.

**Fallback:** Länder ohne Geometrie im 110m-Datensatz (z. B. VA, MC) → zentrierte
`geoStereographic` mit fester Skala, kein `fitExtent`.

---

## 3 · Pin-Auflöse-Zoom deckeln (`MapPicker.tsx`)

### Befund

`RevealView` macht `fitBounds(...).pad(0.4)` **ohne `maxZoom`**. Sitzt der Pin nah
am Ziel (guter Tipp), ist der Bereich winzig → Leaflet zoomt bis `maxZoom: 10`
(Straßenebene). Nach jedem guten Treffer also ein harter „Reinschieß"-Zoom.

### Fix

`maxZoom` in den `fitBounds`-Optionen kappen (`{ animate: true, maxZoom: 5 }`).
Auflöse-Zoom bleibt sanft und gleichmäßig, unabhängig von der Tipp-Güte.

---

## Bewusst nicht gemacht

- Kein `fitExtent` fürs Pin-Auflösen — dort ist `fitBounds` auf zwei Punkte
  richtig; nur der fehlende `maxZoom`-Deckel war das Problem.
- Kein per-Land-Tuning der Umriss-Rahmung — `fitExtent` + Exklaven-Clipping
  erledigt das generisch.
