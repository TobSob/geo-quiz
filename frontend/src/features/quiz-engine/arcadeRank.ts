import type { GameMode } from './types'

/**
 * Rang am Ende einer Arcade-Runde (DESIGN-ARCADE.md, Nachtrag „Rang mit
 * Mindestmenge", ROADMAP C8).
 *
 * Nur die Trefferquote zu werten belohnt Abwarten: 3 von 3 richtig und die
 * Zeit laufen lassen ergab A. Deshalb zählen fehlende Fragen bis zu einer
 * Mindestmenge wie falsche.
 */

export type ArcadeRank = 'S' | 'A' | 'B' | 'C' | 'D'

/** Choice: realistisch 25–30 Fragen pro 60-s-Lauf — gut die Hälfte (Nutzer-Entscheid). */
export const RANK_MIN_QUESTIONS_CHOICE = 15
/** Pin: realistisch 10–15 pro Lauf, gleicher Anteil wie bei Choice. */
export const RANK_MIN_QUESTIONS_PIN = 7

export function rankMinQuestions(mode: GameMode): number {
  return mode === 'city-pin' || mode === 'landmark-pin'
    ? RANK_MIN_QUESTIONS_PIN
    : RANK_MIN_QUESTIONS_CHOICE
}

/** Wertung in Prozent (0–100, gerundet): richtig / max(beantwortet, Mindestmenge). */
export function rankScorePercent(
  correctCount: number,
  questionCount: number,
  mode: GameMode,
): number {
  const denominator = Math.max(questionCount, rankMinQuestions(mode))
  return Math.round((100 * correctCount) / denominator)
}

export function arcadeRank(
  correctCount: number,
  questionCount: number,
  mode: GameMode,
): ArcadeRank {
  const pct = rankScorePercent(correctCount, questionCount, mode)
  if (pct >= 90) return 'S'
  if (pct >= 75) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 40) return 'C'
  return 'D'
}
