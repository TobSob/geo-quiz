import type { GameMode, SessionSummary } from './types'

/** Cup rotation: every mode once, fixed order easy → hard. */
export const CUP_MODES: GameMode[] = [
  'flags',
  'capitals',
  'countries',
  'outline',
  'city-pin',
  'landmark-pin',
]

export interface CupState {
  legIndex: number
  legs: SessionSummary[]
}

export function newCup(): CupState {
  return { legIndex: 0, legs: [] }
}

export function currentCupMode(cup: CupState): GameMode | null {
  return cup.legIndex < CUP_MODES.length ? CUP_MODES[cup.legIndex] : null
}

export function completeLeg(cup: CupState, leg: SessionSummary): CupState {
  return { legIndex: cup.legIndex + 1, legs: [...cup.legs, leg] }
}

export function isCupFinished(cup: CupState): boolean {
  return cup.legIndex >= CUP_MODES.length
}

/**
 * Cup-Gesamtwertung seit dem Arcade-Umbau (Phase E): Rohsumme aller
 * Leg-Scores. Der alte 0–100-„Prozent von perfekt"-Wert ist ohne feste
 * Fragenzahl nicht mehr definierbar.
 */
export function cupScore(cup: CupState): number {
  return cup.legs.reduce((sum, leg) => sum + leg.score, 0)
}
