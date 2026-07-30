import countriesRaw from './countries.json'
import citiesRaw from './cities.json'
import landmarksRaw from './landmarks.json'
import outlineIndex from './outline-index.json'
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
 * Nicht jedes Land hat eine Geometrie im Umriss-Topojson (Übersee-Gebiete wie
 * GF, RE, YT, SJ, TV …) — für die bliebe die Karte leer. Der Umriss-Modus wird
 * deshalb auf die zeichenbaren Länder eingeschränkt. Quelle ist der von
 * scripts/build-outline-atlas.mjs gebaute Umkreis-Index (~7 KB); das Topojson
 * selbst (~756 KB) lädt erst der Umriss-Modus selbst nach
 * (DESIGN-OUTLINE-DETAIL.md).
 */
const renderableCcn3 = new Set(Object.keys(outlineIndex))

export const outlineRenderableIso2 = new Set(
  countries.filter((c) => c.ccn3 && renderableCcn3.has(c.ccn3)).map((c) => c.iso2),
)

export const outlineDataBundle: DataBundle = {
  ...dataBundle,
  countries: countries.filter((c) => outlineRenderableIso2.has(c.iso2)),
}
