// Transforms data/raw/countries-full.json (mledoze/countries, ODbL) into the
// slim bundled dataset the quiz engine consumes. Run: node scripts/transform-countries.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const rawPath = join(here, '..', 'src', 'data', 'raw', 'countries-full.json')
const citiesPath = join(here, '..', 'src', 'data', 'cities.json')
const outPath = join(here, '..', 'src', 'data', 'countries.json')

const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
const cities = JSON.parse(readFileSync(citiesPath, 'utf8'))

// mledoze's `capital` is English/local spelling only (no German translation,
// unlike `name`) — e.g. "Vienna", "Prague", "Cairo". cities.json already
// carries hand-curated German exonyms for capitals that double as city-pin
// targets; reuse those, and fill in the rest here (verified against the
// current German Wikipedia article title for each).
// Bolivia and South Africa have multiple constitutional capitals; the city
// curated in cities.json (La Paz / Cape Town) for city-pin gameplay isn't
// the same city as mledoze's `capital` (Sucre / Pretoria) — don't let the
// city-pin pick silently swap in a different city here.
const MULTI_CAPITAL_MISMATCH = new Set(['BO', 'ZA'])
const capitalDeFromCities = new Map(
  cities
    .filter((c) => c.isCapital && !MULTI_CAPITAL_MISMATCH.has(c.countryIso2))
    .map((c) => [c.countryIso2, c.name]),
)
const CAPITAL_DE_EXTRA = {
  DZ: 'Algier',
  AM: 'Jerewan',
  CY: 'Nikosia',
  DJ: 'Dschibuti',
  GE: 'Tiflis',
  GT: 'Guatemala-Stadt',
  KW: 'Kuwait-Stadt',
  LY: 'Tripolis',
  LU: 'Luxemburg',
  OM: 'Maskat',
  SM: 'San Marino',
  SO: 'Mogadischu',
  SD: 'Khartum',
  SY: 'Damaskus',
  TJ: 'Duschanbe',
  TM: 'Aşgabat',
  VA: 'Vatikanstadt',
  YE: 'Sanaa',
}

const countries = raw
  // Antarctica and a few uninhabited territories have no capital — useless for quiz modes
  .filter((c) => c.capital?.length > 0 || c.unMember)
  .map((c) => ({
    iso2: c.cca2,
    iso3: c.cca3,
    ccn3: c.ccn3 || null,
    name: c.name.common,
    nameOfficial: c.name.official,
    nameDe: c.translations?.deu?.common ?? c.name.common,
    capital: c.capital?.[0] ?? null,
    capitalDe:
      capitalDeFromCities.get(c.cca2) ?? CAPITAL_DE_EXTRA[c.cca2] ?? c.capital?.[0] ?? null,
    capitals: c.capital ?? [],
    region: c.region,
    subregion: c.subregion || null,
    latlng: c.latlng,
    borders: c.borders ?? [],
    area: c.area,
    landlocked: c.landlocked,
    independent: c.independent === true,
    unMember: c.unMember === true,
    flagEmoji: c.flag,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(outPath, JSON.stringify(countries))
const un = countries.filter((c) => c.unMember).length
console.log(`wrote ${countries.length} countries (${un} UN members) -> ${outPath}`)
