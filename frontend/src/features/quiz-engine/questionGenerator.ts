import type {
  ChoiceQuestion,
  City,
  Country,
  GameMode,
  Landmark,
  PinQuestion,
  Question,
} from './types'

export const CHOICE_TIME_LIMIT_MS = 8000
export const PIN_TIME_LIMIT_MS = 15000
export const CITY_FALLOFF_KM = 200
export const LANDMARK_FALLOFF_KM = 90

export interface Rng {
  /** Float in [0, 1). */
  next(): number
}

export const defaultRng: Rng = { next: () => Math.random() }

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng.next() * arr.length)]
}

/** Prefer same-region wrong answers so options aren't giveaways. */
function pickDistractors(
  correct: Country,
  pool: Country[],
  count: number,
  rng: Rng,
): Country[] {
  const others = pool.filter((c) => c.iso2 !== correct.iso2)
  const sameRegion = others.filter((c) => c.region === correct.region)
  const source = sameRegion.length >= count ? sameRegion : others
  return shuffle(source, rng).slice(0, count)
}

export function deterministicId(mode: GameMode, key: string): string {
  switch (mode) {
    case 'flags':
      return `flag:${key}`
    case 'countries':
      return `country:${key}`
    case 'capitals':
      return `capital:${key}`
    case 'outline':
      return `outline:${key}`
    case 'city-pin':
      return `city-pin:${key}`
    case 'landmark-pin':
      return `landmark-pin:${key}`
  }
}

/** Countries usable for MC modes: UN members with a capital keep it recognizable. */
export function quizPool(countries: Country[]): Country[] {
  return countries.filter((c) => c.unMember && c.capital)
}

function buildChoice(
  mode: GameMode,
  correct: Country,
  pool: Country[],
  rng: Rng,
): ChoiceQuestion {
  const distractors = pickDistractors(correct, pool, 3, rng)
  let prompt: string
  let promptIso2: string | null = null
  let optionOf: (c: Country) => string

  switch (mode) {
    case 'flags':
      prompt = 'Welches Land gehört zu dieser Flagge?'
      promptIso2 = correct.iso2
      optionOf = (c) => c.nameDe
      break
    case 'countries':
      prompt = `${correct.capitalDe} ist die Hauptstadt von …?`
      optionOf = (c) => c.nameDe
      break
    case 'capitals':
      prompt = `Was ist die Hauptstadt von ${correct.nameDe}?`
      optionOf = (c) => c.capitalDe ?? '?'
      break
    case 'outline':
      prompt = 'Welches Land ist markiert?'
      promptIso2 = correct.iso2
      optionOf = (c) => c.nameDe
      break
    default:
      throw new Error(`not a choice mode: ${mode}`)
  }

  const options = shuffle([correct, ...distractors], rng).map(optionOf)
  const correctIndex = options.indexOf(optionOf(correct))
  return {
    kind: 'choice',
    id: deterministicId(mode, correct.iso2),
    mode,
    prompt,
    promptIso2,
    options,
    correctIndex,
    timeLimitMs: CHOICE_TIME_LIMIT_MS,
  }
}

export function generateChoiceQuestion(
  mode: 'flags' | 'countries' | 'capitals' | 'outline',
  countries: Country[],
  rng: Rng = defaultRng,
  forcedIso2?: string,
): ChoiceQuestion {
  const pool = quizPool(countries)
  const correct = forcedIso2
    ? pool.find((c) => c.iso2 === forcedIso2) ?? pick(pool, rng)
    : pick(pool, rng)
  return buildChoice(mode, correct, pool, rng)
}

export function generateCityPinQuestion(
  cities: City[],
  countries: Country[],
  rng: Rng = defaultRng,
  forcedId?: string,
): PinQuestion {
  const city = forcedId
    ? cities.find((c) => c.id === forcedId) ?? pick(cities, rng)
    : pick(cities, rng)
  const country = countries.find((c) => c.iso2 === city.countryIso2)
  return {
    kind: 'pin',
    id: deterministicId('city-pin', city.id),
    mode: 'city-pin',
    prompt: `Wo liegt ${city.name}${country ? ` (${country.nameDe})` : ''}?`,
    target: { lat: city.lat, lng: city.lng },
    targetName: city.name,
    countryIso2: city.countryIso2,
    falloffKm: CITY_FALLOFF_KM,
    timeLimitMs: PIN_TIME_LIMIT_MS,
  }
}

export function generateLandmarkPinQuestion(
  landmarks: Landmark[],
  rng: Rng = defaultRng,
  forcedId?: string,
): PinQuestion {
  const lm = forcedId
    ? landmarks.find((l) => l.id === forcedId) ?? pick(landmarks, rng)
    : pick(landmarks, rng)
  return {
    kind: 'pin',
    id: deterministicId('landmark-pin', lm.id),
    mode: 'landmark-pin',
    prompt: `Wo befindet sich: ${lm.name}?`,
    target: { lat: lm.lat, lng: lm.lng },
    targetName: lm.name,
    countryIso2: lm.countryIso2,
    falloffKm: LANDMARK_FALLOFF_KM,
    timeLimitMs: PIN_TIME_LIMIT_MS,
    image: lm.image,
  }
}

export interface DataBundle {
  countries: Country[]
  cities: City[]
  landmarks: Landmark[]
}

/** Generate a session's questions for a mode, without immediate repeats. */
export function generateSession(
  mode: GameMode,
  data: DataBundle,
  count: number,
  rng: Rng = defaultRng,
): Question[] {
  const questions: Question[] = []
  const used = new Set<string>()
  let guard = 0
  while (questions.length < count && guard < count * 30) {
    guard++
    const q = generateQuestion(mode, data, rng)
    if (used.has(q.id)) continue
    used.add(q.id)
    questions.push(q)
  }
  return questions
}

export function generateQuestion(
  mode: GameMode,
  data: DataBundle,
  rng: Rng = defaultRng,
  forcedKey?: string,
): Question {
  switch (mode) {
    case 'flags':
    case 'countries':
    case 'capitals':
    case 'outline':
      return generateChoiceQuestion(mode, data.countries, rng, forcedKey)
    case 'city-pin':
      return generateCityPinQuestion(data.cities, data.countries, rng, forcedKey)
    case 'landmark-pin':
      return generateLandmarkPinQuestion(data.landmarks, rng, forcedKey)
  }
}

/** Reconstruct a question from its deterministic progress-tracking ID. */
export function questionFromId(
  id: string,
  data: DataBundle,
  rng: Rng = defaultRng,
): Question | null {
  const sep = id.indexOf(':')
  if (sep === -1) return null
  const prefix = id.slice(0, sep)
  const key = id.slice(sep + 1)
  const modeByPrefix: Record<string, GameMode> = {
    flag: 'flags',
    country: 'countries',
    capital: 'capitals',
    outline: 'outline',
    'city-pin': 'city-pin',
    'landmark-pin': 'landmark-pin',
  }
  const mode = modeByPrefix[prefix]
  if (!mode) return null
  const q = generateQuestion(mode, data, rng, key)
  return q.id === id ? q : null
}
