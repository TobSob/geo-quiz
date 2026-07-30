import { memo, useEffect, useMemo, useState } from 'react'
import { geoStereographic, geoDistance, geoPath, type GeoProjection } from 'd3-geo'
import type { Feature, Geometry, Position } from 'geojson'
import outlineIndex from '../data/outline-index.json'
import { prefetchOutlineAtlas } from '../data/outlineAtlas'
import { countryByIso2 } from '../data'

interface Props {
  iso2: string
}

const WIDTH = 800
const HEIGHT = 420
// Anteil der Rahmenkante, der als Rand ums Zielland frei bleibt. Vorher waren
// es feste 34 px (≈ 4 %) — das Land füllte den Rahmen, für die Umgebung war
// kein Platz (DESIGN-OUTLINE-DETAIL.md #3). Als Anteil skaliert der Rand von
// Monaco bis Russland gleich mit.
const PAD_FRACTION = 0.19
// Polygonteile weiter als das vom Landesschwerpunkt entfernt gelten als Exklave
// (Guyana bei FR, Alaska/Hawaii bei US, Kanaren bei ES …) und dürfen den
// fitExtent-Zoom nicht aufblähen — sonst wird das Kernland winzig gerahmt.
const EXCLAVE_MAX_RAD = (35 * Math.PI) / 180

// Farbwerte bewusst hier statt in der CSS-Palette: sie beschreiben eine Karte
// (Meer/Land/Ziel), nicht das UI-Theme.
const OCEAN = '#071a3a'
const LAND = '#39538a'
const LAND_STROKE = '#8fb2e8'
const TARGET_FILL = '#ffec27'
const TARGET_STROKE = '#ff004d'

/** Sphärische Umkreise [lng, lat, radiusRad] pro ccn3, gebaut von scripts/build-outline-atlas.mjs. */
const circles = outlineIndex as unknown as Record<string, [number, number, number]>

function useOutlineAtlas(): Feature[] | null {
  const [features, setFeatures] = useState<Feature[] | null>(null)
  useEffect(() => {
    let alive = true
    void prefetchOutlineAtlas().then((f) => {
      if (alive) setFeatures(f)
    })
    return () => {
      alive = false
    }
  }, [])
  return features
}

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
 * liegen — nur fürs `fitExtent`. Gezeichnet wird weiter die volle Geometrie;
 * das Clipping steuert nur den Zoom.
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
 * (Russland, Fidschi) werden nicht zerrissen; `fitExtent` rahmt automatisch.
 */
function buildProjection(
  lng: number,
  lat: number,
  target: Feature | undefined,
): GeoProjection {
  const proj = geoStereographic().rotate([-lng, -lat, 0]).clipAngle(90)
  if (target) {
    const padX = WIDTH * PAD_FRACTION
    const padY = HEIGHT * PAD_FRACTION
    proj.fitExtent(
      [
        [padX, padY],
        [WIDTH - padX, HEIGHT - padY],
      ],
      clipExclaves(target, [lng, lat]) as never,
    )
  } else {
    // Fallback: kein Umriss im Datensatz → feste Skala.
    proj.scale(1600).translate([WIDTH / 2, HEIGHT / 2])
  }
  return proj
}

interface Paths {
  neighbours: string[]
  target: string | null
}

/**
 * Projiziert nur, was im Rahmen liegen kann: aus der Skala folgt der sichtbare
 * Kappenradius (stereographisch r = 2k·tan(θ/2), r = halbe Rahmendiagonale als
 * sichere Obergrenze); Länder, deren vorberechneter Umkreis diese Kappe nicht
 * schneidet, werden übersprungen. Ohne das kostet der 50m-Datensatz ~154 ms pro
 * Karte statt ~24 ms (DESIGN-OUTLINE-DETAIL.md #2).
 */
function buildPaths(
  features: Feature[],
  projection: GeoProjection,
  center: [number, number],
  ccn3: string | null,
): Paths {
  const visibleRad = 2 * Math.atan(Math.hypot(WIDTH, HEIGHT) / 2 / (2 * projection.scale()))
  const path = geoPath(projection).digits(1)
  const neighbours: string[] = []
  let target: string | null = null

  for (const f of features) {
    const id = String(f.id)
    const isTarget = id === ccn3
    if (!isTarget) {
      const circle = circles[id]
      if (!circle) continue
      const [cLng, cLat, radius] = circle
      if (geoDistance(center, [cLng, cLat]) - radius > visibleRad) continue
    }
    const d = path(f as never)
    if (!d) continue
    if (isTarget) target = d
    else neighbours.push(d)
  }
  return { neighbours, target }
}

export const CountryOutline = memo(function CountryOutline({ iso2 }: Props) {
  const country = countryByIso2(iso2)
  const features = useOutlineAtlas()

  const paths = useMemo(() => {
    if (!country || !features) return null
    const [lat, lng] = country.latlng
    const target = country.ccn3
      ? features.find((f) => String(f.id) === country.ccn3)
      : undefined
    const projection = buildProjection(lng, lat, target)
    return buildPaths(features, projection, [lng, lat], country.ccn3)
  }, [country, features])

  if (!country) return null

  return (
    <div className="map-frame" style={{ background: OCEAN }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Nachbarn zuerst, das Zielland zuletzt: vorher lag es in
            Datensatz-Reihenfolge und ein größerer Nachbar konnte seinen Rand
            überdecken. */}
        {paths?.neighbours.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={LAND}
            stroke={LAND_STROKE}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        ))}
        {paths?.target && (
          <>
            {/* Dunkler Trennsaum unter dem Zielland — trennt es auch dort sauber
                vom Nachbarn, wo beide direkt aneinandergrenzen. */}
            <path
              d={paths.target}
              fill="none"
              stroke={OCEAN}
              strokeWidth={7}
              strokeLinejoin="round"
            />
            <path
              d={paths.target}
              fill={TARGET_FILL}
              stroke={TARGET_STROKE}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
    </div>
  )
})
