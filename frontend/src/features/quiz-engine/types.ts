export type GameMode =
  | 'flags'
  | 'countries'
  | 'capitals'
  | 'outline'
  | 'city-pin'
  | 'landmark-pin'

export interface Country {
  iso2: string
  iso3: string
  ccn3: string | null
  name: string
  nameOfficial: string
  nameDe: string
  capital: string | null
  /** German exonym for `capital`, e.g. "Wien" for Vienna — falls back to `capital` when identical. */
  capitalDe: string | null
  capitals: string[]
  region: string
  subregion: string | null
  latlng: [number, number]
  borders: string[]
  area: number
  landlocked: boolean
  independent: boolean
  unMember: boolean
  flagEmoji: string
}

export interface City {
  id: string
  name: string
  countryIso2: string
  lat: number
  lng: number
  population: number
  isCapital: boolean
}

export interface Landmark {
  id: string
  name: string
  countryIso2: string
  lat: number
  lng: number
  category: 'building' | 'monument' | 'nature' | 'place'
  difficulty: 1 | 2 | 3
  /** Public path to a representative photo, e.g. `/landmarks/lm_eiffel_tower.jpg`. */
  image: string
}

/** Multiple-choice question (flags, countries, capitals, outline). */
export interface ChoiceQuestion {
  kind: 'choice'
  /** Deterministic ID, e.g. `flag:DE` — used as progress-tracking key. */
  id: string
  mode: GameMode
  prompt: string
  /** ISO2 code for flag/outline rendering, if the prompt is visual. */
  promptIso2: string | null
  options: string[]
  correctIndex: number
  timeLimitMs: number
}

/** Pin-placement question (city-pin, landmark-pin). */
export interface PinQuestion {
  kind: 'pin'
  id: string
  mode: GameMode
  prompt: string
  target: { lat: number; lng: number }
  targetName: string
  countryIso2: string
  /** Distance falloff constant R in km (see scoring). */
  falloffKm: number
  timeLimitMs: number
  /** Public path to a representative photo (landmark-pin only). */
  image?: string
}

export type Question = ChoiceQuestion | PinQuestion

export interface AnswerResult {
  questionId: string
  correct: boolean
  score: number
  maxScore: number
  elapsedMs: number
  /** Only set for pin questions. */
  distanceKm?: number
}

export interface SessionSummary {
  mode: GameMode | 'training'
  score: number
  maxPossible: number
  questionCount: number
  correctCount: number
  bestStreak: number
  durationMs: number
  answers: AnswerResult[]
}

/** Per-question progress counters, persisted locally (and later synced). */
export interface QuestionProgress {
  questionId: string
  timesShown: number
  timesWrong: number
  timesCorrect: number
  lastSeenAt: number
  lastResult: boolean
}
