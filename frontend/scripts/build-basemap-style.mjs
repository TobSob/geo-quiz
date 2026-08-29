// Baut den Basemap-Style des Pin-Modus (DESIGN-BASEMAP.md):
//
//   src/data/basemap-dark-nolabels.json — OpenFreeMaps Dark-Style,
//                                         beschriftungsfrei umgeschrieben
//
// OpenFreeMaps `dark` ist ein Dark-Matter-Port (praktisch der Look, den CARTOs
// `dark_nolabels` hatte) — aber MIT Beschriftungen. Ortsnamen auf der Karte
// verraten im Quiz die Antwort, also fliegen sie hier zur Bauzeit raus.
//
// Lokal mitgeliefert statt zur Laufzeit per URL geladen: eine Netzwerk-Runde
// weniger vor dem ersten Frame — und vor allem kann sich der Style nicht unter
// uns ändern und über Nacht wieder Labels einblenden.
//
// Lauf: node scripts/build-basemap-style.mjs [--from <datei>]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SOURCE_URL = 'https://tiles.openfreemap.org/styles/dark'

/**
 * Layer, die erst ab Zoom 13–16 überhaupt etwas zeichnen. Die Karte endet bei
 * Zoom 10 — sie kosten also nur Parse- und Render-Zeit pro Kachel.
 */
const ABOVE_ZOOM_RANGE = new Set([
  'building',
  'landuse_residential',
  'aeroway-taxiway',
  'aeroway-runway-casing',
  'aeroway-area',
  'aeroway-runway',
  'road_area_pier',
  'road_pier',
  'highway_path',
  'highway_minor',
  'railway_transit',
  'railway_transit_dashline',
  'railway_minor',
  'railway_minor_dashline',
  'railway',
  'railway_dashline',
])

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')

const fromArg = process.argv.indexOf('--from')
const style =
  fromArg >= 0
    ? JSON.parse(readFileSync(process.argv[fromArg + 1], 'utf8'))
    : await (await fetch(SOURCE_URL)).json()

const dropped = { symbol: 0, zoom: 0 }
const layers = style.layers.filter((layer) => {
  if (layer.type === 'symbol') {
    dropped.symbol++
    return false
  }
  if (ABOVE_ZOOM_RANGE.has(layer.id)) {
    dropped.zoom++
    return false
  }
  return true
})

// Ohne Symbol-Layer bleibt `landcover_wood` der einzige Sprite-Nutzer
// (fill-pattern). Nur das Muster entfernen — die Füllfarbe bleibt, der Wald
// wird also weiterhin minimal abgesetzt, aber ohne Sprite-Download.
let patternsDropped = 0
for (const layer of layers) {
  if (layer.paint?.['fill-pattern']) {
    delete layer.paint['fill-pattern']
    patternsDropped++
  }
}

// ---------------------------------------------------------------------------
// Optische Abstimmung
//
// Hier wird die Karte gestaltet. OpenFreeMaps Dark-Style ist als *Hintergrund*
// für farbige Daten-Overlays gedacht und hält sich deshalb bewusst zurück — im
// Quiz ist die Karte aber der Hauptdarsteller: Küstenlinien und Ländergrenzen
// sind das Einzige, woran man sich orientieren kann.
//
// Jeder Wert unten ist ein Regler. Zum Nachjustieren: ändern, Skript laufen
// lassen, Seite neu laden.
// ---------------------------------------------------------------------------
/**
 * Die Karte hat eine klare Rangfolge, und die soll man auch sehen:
 *
 *   Küstenlinie  >  Ländergrenze  >  Bundesland-/Provinzgrenze
 *
 * Beim Welt-Zoom sind **nur Ländergrenzen** da. Erst beim Reinzoomen blenden
 * sich die inneren Grenzen dazu — deutlich schwächer, damit ein Land optisch
 * nicht in Einzelteile zerfällt.
 */
const STATE_FADE_IN = 3.5
const STATE_FULL = 5

const TWEAKS = {
  // Küste = Kontrast zwischen Wasser und Land. Der stärkste Orientierungsanker
  // überhaupt; im Original trennen Land (12,12,12) und Wasser (27,27,29) nur
  // 15 Helligkeitsstufen — auf einem Handy bei Tageslicht praktisch nichts.
  water: { paint: { 'fill-color': 'rgb(38,38,45)' } },

  // Ländergrenzen: heller, schärfer, und schon beim Welt-Zoom sichtbar.
  // Im Original beginnt die Breiten-Kurve erst bei Zoom 3 — darunter (unsere
  // Startansicht!) blieb es bei der schmalsten Stufe, zusätzlich weichgezeichnet.
  boundary_country: {
    paint: {
      'line-color': 'rgb(112,112,118)',
      'line-blur': 0,
      'line-width': ['interpolate', ['exponential', 1.1], ['zoom'], 1, 1.1, 22, 20],
    },
  },

  // Innere Grenzen: unsichtbar in der Weltansicht, ab Zoom 3,5 eingeblendet,
  // ab 5 auf voller (aber gedeckelter) Stärke. `minzoom` spart zusätzlich das
  // Zeichnen, solange sie ohnehin durchsichtig wären.
  boundary_state: {
    layer: { minzoom: STATE_FADE_IN },
    paint: {
      'line-color': 'rgb(76,76,82)',
      'line-blur': 0,
      'line-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        STATE_FADE_IN,
        0,
        STATE_FULL,
        0.65,
      ],
    },
  },
}

/** Grenz-Layer heißen im Original `boundary_country_z0-4` / `_z5-`. */
const tweakKeyFor = (id) =>
  id.startsWith('boundary_country') ? 'boundary_country' : id

let tweaked = 0
for (const layer of layers) {
  const patch = TWEAKS[tweakKeyFor(layer.id)]
  if (!patch) continue
  if (patch.paint) Object.assign(layer.paint, patch.paint)
  if (patch.layer) Object.assign(layer, patch.layer)
  tweaked++
}

// Quellen ausdünnen: was kein Layer mehr referenziert, muss auch nicht geladen
// werden (`ne2_shaded` referenziert schon im Original keiner).
const usedSources = new Set(layers.map((l) => l.source).filter(Boolean))
const sources = Object.fromEntries(
  Object.entries(style.sources).filter(([id]) => usedSources.has(id)),
)

// `glyphs`/`sprite` bewusst nicht übernommen — ohne Beschriftungen und ohne
// fill-pattern braucht der Style weder Schriftschnitte noch Sprite-Atlas.
const out = {
  version: style.version,
  sources,
  layers,
}

writeFileSync(join(dataDir, 'basemap-dark-nolabels.json'), `${JSON.stringify(out)}\n`)

console.log(`basemap-dark-nolabels.json  ${layers.length} Layer, ${Object.keys(sources).length} Quelle(n)`)
console.log(`  entfernt: ${dropped.symbol} Symbol-Layer (Beschriftungen)`)
console.log(`  entfernt: ${dropped.zoom} Layer oberhalb Zoom 10`)
console.log(`  entfernt: ${patternsDropped} fill-pattern (Sprite-Abhängigkeit)`)
console.log(`  angepasst: ${tweaked} Layer (Küste/Grenzen — siehe TWEAKS)`)
