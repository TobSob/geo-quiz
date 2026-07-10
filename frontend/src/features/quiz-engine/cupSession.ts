import type { GameMode, SessionSummary } from './types'
import { cupTotalScore } from './scoring'

/** Cup rotation: every mode once, fixed order easy → hard. */
export const CUP_MODES: GameMode[] = [
  'flags',
  'capitals',
  'countries',
  'outline',
  'city-pin',
  'landmark-pin',
]

export const CUP_QUESTIONS_PER_LEG = 5

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

/** Normalized 0-100 "percentage of perfect play" across all completed legs. */
export function cupScore(cup: CupState): number {
  return cupTotalScore(cup.legs)
}
