import countriesRaw from './countries.json'
import citiesRaw from './cities.json'
import landmarksRaw from './landmarks.json'
import worldAtlas from './world-atlas-110m.json'
import type { City, Country, Landmark } from '../features/quiz-engine/types'
import type { DataBundle } from '../features/quiz-engine/questionGenerator'

export const countries = countriesRaw as Country[]
export const cities = citiesRaw as City[]
export const landmarks = landmarksRaw as Landmark[]

export const dataBundle: DataBundle = { countries, cities, landmarks }

const byIso2 = new Map(countries.map((c) => [c.iso2, c]))

export function countryByIso2(iso2: string): Country | undefined {
  return byIso2.get(iso2)
}

/**
 * world-atlas-110m is a low-resolution topojson chosen for bundle size (see
 * docs/DEVELOPMENT.md) — many microstates (Malta, Singapore, Monaco, ...)
 * have no shape in it at all, so the outline mode must not pick them or the
 * map renders empty. Restrict outline questions to countries the topojson
 * can actually draw.
 */
const topoObjectKey = Object.keys(worldAtlas.objects)[0]
const topoObjects = worldAtlas.objects as unknown as Record<
  string,
  { geometries: { id?: string }[] }
>
const renderableCcn3 = new Set(
  topoObjects[topoObjectKey].geometries
    .filter((g) => g.id !== undefined)
    .map((g) => String(g.id)),
)

export const outlineRenderableIso2 = new Set(
  countries.filter((c) => c.ccn3 && renderableCcn3.has(c.ccn3)).map((c) => c.iso2),
)

export const outlineDataBundle: DataBundle = {
  ...dataBundle,
  countries: countries.filter((c) => outlineRenderableIso2.has(c.iso2)),
}
