import { describe, expect, it } from 'vitest'
import type { SessionSummary } from './types'
import {
  completeLeg,
  CUP_MODES,
  cupScore,
  currentCupMode,
  isCupFinished,
  newCup,
} from './cupSession'

function leg(mode: SessionSummary['mode'], score: number): SessionSummary {
  return {
    mode,
    score,
    maxPossible: Math.max(score, 1),
    questionCount: 5,
    correctCount: 4,
    bestStreak: 3,
    durationMs: 30_000,
    answers: [],
  }
}

describe('cupSession (Arcade: Rohsumme, 30-s-Legs)', () => {
  it('durchläuft alle 6 Disziplinen und summiert die Rohpunkte', () => {
    let cup = newCup()
    expect(currentCupMode(cup)).toBe('flags')

    const scores = [900, 700, 650, 500, 320, 210]
    for (const [i, mode] of CUP_MODES.entries()) {
      expect(currentCupMode(cup)).toBe(mode)
      cup = completeLeg(cup, leg(mode, scores[i]))
    }

    expect(isCupFinished(cup)).toBe(true)
    expect(currentCupMode(cup)).toBeNull()
    expect(cupScore(cup)).toBe(3280) // Summe, kein 0–100-Prozentwert mehr
  })

  it('leerer Cup hat Score 0', () => {
    expect(cupScore(newCup())).toBe(0)
  })
})
