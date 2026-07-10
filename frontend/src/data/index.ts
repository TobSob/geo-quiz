import countriesRaw from './countries.json'
import citiesRaw from './cities.json'
import landmarksRaw from './landmarks.json'
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
