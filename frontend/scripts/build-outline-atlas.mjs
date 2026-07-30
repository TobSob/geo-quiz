// Baut die Datengrundlage des Umriss-Modus (DESIGN-OUTLINE-DETAIL.md):
//
//   src/data/world-atlas-50m.json  — world-atlas countries-50m, unverändert
//   src/data/outline-index.json    — pro Land ein sphärischer Umkreis
//                                    [lng, lat, radiusRad] für das Pruning
//
// Der Umkreis kostet über den 50m-Datensatz ~126 ms — deshalb hier zur Bauzeit
// statt beim App-Start. `outline-index.json` ist zugleich die Quelle für
// `outlineRenderableIso2` (welche Länder überhaupt einen Umriss haben), damit
// src/data/index.ts das Topojson nicht mehr in den Hauptbundle ziehen muss.
//
// Lauf: node scripts/build-outline-atlas.mjs [--from <datei>]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { feature } from 'topojson-client'
import { geoDistance } from 'd3-geo'

const SOURCE_URL = 'https://unpkg.com/world-atlas@2/countries-50m.json'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')

const fromArg = process.argv.indexOf('--from')
const topo =
  fromArg >= 0
    ? JSON.parse(readFileSync(process.argv[fromArg + 1], 'utf8'))
    : await (await fetch(SOURCE_URL)).json()

const fc = feature(topo, topo.objects.countries)

/**
 * Sphärischer Umkreis eines Landes: Schwerpunkt über die kartesisch gemittelten
 * Stützpunkte (polsicher, im Gegensatz zum Mittel der Grad-Werte), Radius =
 * größter Winkelabstand vom Schwerpunkt. Deckt Exklaven mit ab — ein Land wird
 * beim Pruning also nie zu früh weggelassen.
 */
function boundingCircle(geometry) {
  let x = 0
  let y = 0
  let z = 0
  const accumulate = (coords) => {
    if (typeof coords[0] === 'number') {
      const lng = (coords[0] * Math.PI) / 180
      const lat = (coords[1] * Math.PI) / 180
      const cosLat = Math.cos(lat)
      x += cosLat * Math.cos(lng)
      y += cosLat * Math.sin(lng)
      z += Math.sin(lat)
    } else coords.forEach(accumulate)
  }
  accumulate(geometry.coordinates)
  const len = Math.hypot(x, y, z) || 1
  const center = [
    (Math.atan2(y / len, x / len) * 180) / Math.PI,
    (Math.asin(Math.max(-1, Math.min(1, z / len))) * 180) / Math.PI,
  ]
  let radius = 0
  const widen = (coords) => {
    if (typeof coords[0] === 'number') radius = Math.max(radius, geoDistance(center, coords))
    else coords.forEach(widen)
  }
  widen(geometry.coordinates)
  return [center[0], center[1], radius]
}

const round = (n, digits) => Number(n.toFixed(digits))

const index = {}
for (const f of fc.features) {
  if (f.id === undefined || f.id === null) continue
  const [lng, lat, radius] = boundingCircle(f.geometry)
  index[String(f.id)] = [round(lng, 3), round(lat, 3), round(radius, 5)]
}

writeFileSync(join(dataDir, 'world-atlas-50m.json'), JSON.stringify(topo))
writeFileSync(join(dataDir, 'outline-index.json'), `${JSON.stringify(index, null, 0)}\n`)

console.log(`world-atlas-50m.json  ${fc.features.length} Länder`)
console.log(`outline-index.json    ${Object.keys(index).length} Umkreise`)
