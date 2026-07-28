import { memo, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { geoStereographic, geoDistance, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import topo from '../data/world-atlas-110m.json'
import { countryByIso2 } from '../data'

interface Props {
  iso2: string
}

const WIDTH = 800
const HEIGHT = 420
const PAD = 34
// Polygonteile weiter als das vom Landesschwerpunkt entfernt gelten als Exklave
// (Guyana bei FR, Alaska/Hawaii bei US, Kanaren bei ES …) und dürfen den
// fitExtent-Zoom nicht aufblähen — sonst wird das Kernland winzig gerahmt.
const EXCLAVE_MAX_RAD = (35 * Math.PI) / 180

// FeatureCollection einmalig aus dem TopoJSON ableiten (Modul-Scope).
const world = feature(
  topo as never,
  (topo as never as { objects: { countries: unknown } }).objects.countries as never,
) as unknown as FeatureCollection

const featureByCcn3 = new Map<string, Feature>()
for (const f of world.features) featureByCcn3.set(String(f.id), f)

/** Grober Schwerpunkt eines äußeren Rings (Mittel der Stützpunkte). */
function ringCentroid(ring: Position[]): [number, number] {
  let x = 0
  let y = 0
  for (const [a, b] of ring) {
    x += a
    y += b
  }
  return [x / ring.length, y / ring.length]
}

/**
 * Entfernt Polygonteile, die weiter als `EXCLAVE_MAX_RAD` vom Landesschwerpunkt
 * liegen — nur fürs `fitExtent`. Gezeichnet wird weiter die volle Geometrie
 * (via Geographies); das Clipping steuert nur den Zoom.
 */
function clipExclaves(geo: Feature, center: [number, number]): Feature {
  const g = geo.geometry as Geometry
  if (g.type !== 'MultiPolygon') return geo
  const kept = g.coordinates.filter(
    (poly) => geoDistance(ringCentroid(poly[0]), center) < EXCLAVE_MAX_RAD,
  )
  return {
    ...geo,
    geometry: {
      type: 'MultiPolygon',
      coordinates: kept.length ? kept : g.coordinates,
    },
  }
}

/**
 * Baut pro Land eine auf dessen Schwerpunkt rotierte, winkeltreue
 * `geoStereographic` und passt sie per `fitExtent` in den Rahmen ein
 * (DESIGN-MAP-FIXES.md #2): winkeltreu → keine Formverzerrung; zentriert →
 * breitengradunabhängig; `rotate([-lng, …])` → Länder über der Datumsgrenze
 * (Russland, Fidschi) werden nicht zerrissen; `fitExtent` rahmt automatisch
 * korrekt (ersetzt die alte grobe Flächen-Zoom-Heuristik).
 */
function buildProjection(
  lng: number,
  lat: number,
  ccn3: string | null,
): GeoProjection {
  const proj = geoStereographic().rotate([-lng, -lat, 0]).clipAngle(90)
  const target = ccn3 ? featureByCcn3.get(ccn3) : undefined
  if (target) {
    proj.fitExtent(
      [
        [PAD, PAD],
        [WIDTH - PAD, HEIGHT - PAD],
      ],
      clipExclaves(target, [lng, lat]) as never,
    )
  } else {
    // Fallback: kein Umriss im 110m-Datensatz (z. B. VA, MC) → feste Skala.
    proj.scale(1600).translate([WIDTH / 2, HEIGHT / 2])
  }
  return proj
}

export const CountryOutline = memo(function CountryOutline({ iso2 }: Props) {
  const country = countryByIso2(iso2)
  const projection = useMemo(() => {
    if (!country) return null
    const [lat, lng] = country.latlng
    return buildProjection(lng, lat, country.ccn3)
  }, [country])

  if (!country || !projection) return null

  return (
    <div className="map-frame" style={{ background: '#0e1a2e' }}>
      <ComposableMap
        width={WIDTH}
        height={HEIGHT}
        // react-simple-maps akzeptiert eine vorkonfigurierte d3-Projektion als
        // Funktion; deren Typ (GeoProjection) ist enger als der lockere
        // ProjectionFunction-Prop-Typ → bewusster Cast.
        projection={projection as never}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <Geographies geography={topo} className="outline-map">
          {({ geographies }) =>
            geographies.map((geo) => {
              const isTarget = String(geo.id) === country.ccn3
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isTarget ? '#ffec27' : '#1b1935'}
                  stroke={isTarget ? '#ff004d' : '#3a3565'}
                  // Ohne ZoomableGroup skaliert nichts mehr die Striche hoch
                  // (früher × Zoom 1,6–12) → in Roh-viewBox-Einheiten kräftiger
                  // setzen, damit die Ränder sichtbar bleiben.
                  strokeWidth={isTarget ? 1.6 : 0.6}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  )
})
