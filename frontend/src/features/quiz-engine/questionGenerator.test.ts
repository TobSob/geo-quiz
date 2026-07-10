import { describe, expect, it } from 'vitest'
import countriesRaw from '../../data/countries.json'
import citiesRaw from '../../data/cities.json'
import landmarksRaw from '../../data/landmarks.json'
import type { City, Country, Landmark } from './types'
import {
  generateChoiceQuestion,
  generateSession,
  questionFromId,
  quizPool,
} from './questionGenerator'
import { haversineKm } from '../geo/distance'

const countries = countriesRaw as Country[]
const cities = citiesRaw as City[]
const landmarks = landmarksRaw as Landmark[]
const data = { countries, cities, landmarks }

describe('data integrity', () => {
  it('bundles 194 UN members with a capital for the quiz pool', () => {
    expect(quizPool(countries).length).toBeGreaterThanOrEqual(190)
  })

  it('every city references an existing country', () => {
    const iso2 = new Set(countries.map((c) => c.iso2))
    for (const city of cities) expect(iso2.has(city.countryIso2)).toBe(true)
  })

  it('every landmark references an existing country', () => {
    const iso2 = new Set(countries.map((c) => c.iso2))
    for (const lm of landmarks) expect(iso2.has(lm.countryIso2)).toBe(true)
  })

  it('city coordinates are plausible (Berlin↔Paris ~878 km)', () => {
    const berlin = cities.find((c) => c.id === 'city_berlin_de')!
    const paris = cities.find((c) => c.id === 'city_paris_fr')!
    const d = haversineKm(berlin.lat, berlin.lng, paris.lat, paris.lng)
    expect(d).toBeGreaterThan(850)
    expect(d).toBeLessThan(910)
  })
})

describe('generateChoiceQuestion', () => {
  it('produces 4 unique options containing the correct answer', () => {
    for (let i = 0; i < 50; i++) {
      const q = generateChoiceQuestion('flags', countries)
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThan(4)
    }
  })

  it('uses deterministic IDs (flag:DE)', () => {
    const q = generateChoiceQuestion('flags', countries, undefined, 'DE')
    expect(q.id).toBe('flag:DE')
    expect(q.promptIso2).toBe('DE')
  })

  it('capitals mode asks for the capital and offers capitals as options', () => {
    const q = generateChoiceQuestion('capitals', countries, undefined, 'DE')
    expect(q.prompt).toContain('Deutschland')
    expect(q.options[q.correctIndex]).toBe('Berlin')
  })
})

describe('generateSession', () => {
  it('produces the requested count without duplicate question IDs', () => {
    for (const mode of ['flags', 'capitals', 'city-pin', 'landmark-pin'] as const) {
      const qs = generateSession(mode, data, 10)
      expect(qs).toHaveLength(10)
      expect(new Set(qs.map((q) => q.id)).size).toBe(10)
    }
  })
})

describe('questionFromId', () => {
  it('round-trips deterministic IDs back into questions', () => {
    expect(questionFromId('flag:JP', data)?.id).toBe('flag:JP')
    expect(questionFromId('city-pin:city_tokyo_jp', data)?.id).toBe(
      'city-pin:city_tokyo_jp',
    )
    expect(questionFromId('landmark-pin:lm_eiffel_tower', data)?.id).toBe(
      'landmark-pin:lm_eiffel_tower',
    )
  })

  it('returns null for unknown IDs', () => {
    expect(questionFromId('flag:XX', data)).toBeNull()
    expect(questionFromId('nonsense', data)).toBeNull()
  })
})
