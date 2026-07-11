import { readFileSync } from 'node:fs'
import { LANDMARK_MANIFEST } from './landmarks-manifest.mjs'

const countries = JSON.parse(readFileSync(new URL('../src/data/countries.json', import.meta.url)))
const isoSet = new Set(countries.map((c) => c.iso2))
const ids = new Set()
const wikiSeen = new Set()
let dupId = 0, dupWiki = 0, badIso = 0

for (const e of LANDMARK_MANIFEST) {
  if (ids.has(e.id)) { console.log('DUP ID', e.id); dupId++ }
  ids.add(e.id)
  if (wikiSeen.has(e.wikiTitle)) { console.log('DUP WIKI', e.wikiTitle); dupWiki++ }
  wikiSeen.add(e.wikiTitle)
  if (!isoSet.has(e.countryIso2)) { console.log('BAD ISO', e.id, e.countryIso2); badIso++ }
}
console.log('total entries:', LANDMARK_MANIFEST.length, 'dupId:', dupId, 'dupWiki:', dupWiki, 'badIso:', badIso)
