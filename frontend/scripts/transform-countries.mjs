// Transforms data/raw/countries-full.json (mledoze/countries, ODbL) into the
// slim bundled dataset the quiz engine consumes. Run: node scripts/transform-countries.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const rawPath = join(here, '..', 'src', 'data', 'raw', 'countries-full.json')
const outPath = join(here, '..', 'src', 'data', 'countries.json')

const raw = JSON.parse(readFileSync(rawPath, 'utf8'))

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
