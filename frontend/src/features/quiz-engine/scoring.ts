export const BASE_POINTS = 100
export const MAX_TIME_BONUS = 50
export const MAX_STREAK_MULT_STREAK = 10
export const STREAK_STEP = 0.05
/** Max per simple question: (100 + 50) * 1.5 */
export const MAX_CHOICE_SCORE = 225
export const MAX_PIN_SCORE = 100
export const BULLSEYE_KM = 5

/**
 * Simple modes (flags, countries, capitals, outline):
 * base 100 + up to 50 time bonus, streak multiplier caps at 1.5x after a 10-streak.
 * Wrong answer scores 0 (streak resets — caller's responsibility).
 */
export function scoreChoice(
  correct: boolean,
  elapsedMs: number,
  timeLimitMs: number,
  streak: number,
): number {
  if (!correct) return 0
  const timeBonus = Math.round(
    Math.max(0, MAX_TIME_BONUS * (1 - elapsedMs / timeLimitMs)),
  )
  const streakMult = 1 + Math.min(streak, MAX_STREAK_MULT_STREAK) * STREAK_STEP
  return Math.round((BASE_POINTS + timeBonus) * streakMult)
}

/** Exponential distance falloff: 100 * e^(-d/R), bullseye <5km forces 100. */
export function distanceScore(distanceKm: number, falloffKm: number): number {
  if (distanceKm < BULLSEYE_KM) return MAX_PIN_SCORE
  const raw = Math.round(MAX_PIN_SCORE * Math.exp(-distanceKm / falloffKm))
  return Math.min(MAX_PIN_SCORE, Math.max(0, raw))
}

/**
 * Pin modes: precision dominates (90 % weight), small additive time bonus (max 10).
 */
export function scorePin(
  distanceKm: number,
  falloffKm: number,
  elapsedMs: number,
  timeLimitMs: number,
): number {
  const dScore = distanceScore(distanceKm, falloffKm)
  const timeBonus = Math.min(10, Math.max(0, 10 * (1 - elapsedMs / timeLimitMs)))
  return Math.min(MAX_PIN_SCORE, Math.round(dScore * 0.9 + timeBonus))
}

/** Cup total: percentage of perfect play across legs, 0-100. */
export function cupTotalScore(
  legs: Array<{ score: number; maxPossible: number }>,
): number {
  const max = legs.reduce((s, l) => s + l.maxPossible, 0)
  if (max === 0) return 0
  const scored = legs.reduce((s, l) => s + l.score, 0)
  return Math.round((100 * scored) / max)
}
