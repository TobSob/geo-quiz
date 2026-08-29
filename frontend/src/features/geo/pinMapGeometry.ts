/**
 * Geometrie des Pin-Auflösens — bewusst frei von MapLibre-Typen, damit sie
 * ohne DOM testbar ist (DESIGN-BASEMAP.md §6).
 */

/** Mercator endet hier — jenseits davon rechnet `fitBounds` ins Leere. */
export const MAX_LAT = 85

/** Luft um Tipp und Ziel beim Auflösen, wie Leaflets altes `.pad(0.4)`. */
export const REVEAL_PAD_RATIO = 0.4

/**
 * Verschiebt `lng` um Vielfache von 360°, sodass es der Referenz-Longitude
 * am nächsten liegt (max. 180° Abstand). Ohne das zeichnet die Karte Linie
 * und fitBounds beim Auflösen den *langen* Weg quer über die ganze Karte,
 * wenn Tipp und Ziel zwar geografisch nah, aber diesseits/jenseits der
 * ±180°-Naht liegen (z. B. Australien-Klick → Bora Bora): sah aus wie
 * „einmal um die Welt", obwohl der kurze Weg über die Datumsgrenze gemeint
 * ist. Die Haversine-Distanz war immer korrekt — nur die Darstellung nicht.
 */
export const nearestLng = (lng: number, ref: number) =>
  lng + 360 * Math.round((ref - lng) / 360)

/**
 * Bringt Tipp- und Ziel-Longitude auf dieselbe Weltkopie (kurzer Weg über die
 * Datumsgrenze) UND verschiebt beide gemeinsam so, dass ihr Mittelpunkt in
 * (−180°, 180°] liegt. Die Linienlänge hängt nur von der Differenz ab — der
 * gemeinsame Offset ändert die Darstellung also nicht, hält aber beide Enden
 * beieinander im Kartenausschnitt (siehe DESIGN-MAP-FIXES.md #1).
 */
export const revealLngs = (guessLng: number, targetLng: number) => {
  const near = nearestLng(targetLng, guessLng)
  const shift = -360 * Math.round((guessLng + near) / 2 / 360)
  return { guessLng: guessLng + shift, targetLng: near + shift }
}

export interface RevealBounds {
  /** Südwest-Ecke [lng, lat]. */
  sw: [number, number]
  /** Nordost-Ecke [lng, lat]. */
  ne: [number, number]
}

/**
 * Rahmen um Tipp und Ziel für `fitBounds`.
 *
 * Zwei Fallen stecken hier drin, beide schon einmal live aufgeschlagen:
 *
 * 1. MapLibres `LngLatBounds(sw, ne)` erwartet **Südwest- und Nordost-Ecke**
 *    und sortiert nichts. Tipp und Ziel unverändert durchzureichen ergibt eine
 *    invertierte Box, sobald der Tipp nördlich oder östlich vom Ziel liegt —
 *    `fitBounds` springt dann an eine andere Stelle und zoomt raus. Leaflets
 *    `latLngBounds` hatte das still übernommen, MapLibre nicht.
 * 2. Leaflet vergrößerte den Rahmen um 40 % seiner eigenen Größe
 *    (`.pad(0.4)`), nicht um eine feste Pixelzahl. Bei weit auseinander
 *    liegenden Punkten ist das ein spürbarer Unterschied — der Auflöse-Zoom
 *    war so austariert (DESIGN-MAP-FIXES.md #3), also wird er nachgebildet.
 */
export function revealBounds(
  a: [number, number],
  b: [number, number],
): RevealBounds {
  const west = Math.min(a[0], b[0])
  const east = Math.max(a[0], b[0])
  const south = Math.min(a[1], b[1])
  const north = Math.max(a[1], b[1])
  const padLng = (east - west) * REVEAL_PAD_RATIO
  const padLat = (north - south) * REVEAL_PAD_RATIO
  return {
    sw: [west - padLng, Math.max(-MAX_LAT, south - padLat)],
    ne: [east + padLng, Math.min(MAX_LAT, north + padLat)],
  }
}
