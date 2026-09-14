import { describe, expect, it } from 'vitest'
import {
  arcadeRank,
  rankMinQuestions,
  rankScorePercent,
  RANK_MIN_QUESTIONS_CHOICE,
  RANK_MIN_QUESTIONS_PIN,
} from './arcadeRank'

describe('rankMinQuestions', () => {
  it('Choice-Modi: 15', () => {
    for (const mode of ['flags', 'countries', 'capitals', 'outline'] as const) {
      expect(rankMinQuestions(mode)).toBe(RANK_MIN_QUESTIONS_CHOICE)
    }
    expect(RANK_MIN_QUESTIONS_CHOICE).toBe(15)
  })

  it('Pin-Modi: 7', () => {
    expect(rankMinQuestions('city-pin')).toBe(RANK_MIN_QUESTIONS_PIN)
    expect(rankMinQuestions('landmark-pin')).toBe(RANK_MIN_QUESTIONS_PIN)
    expect(RANK_MIN_QUESTIONS_PIN).toBe(7)
  })
})

describe('arcadeRank', () => {
  it('Befund aus dem Gerätetest: 3 von 3 richtig ist kein A mehr', () => {
    expect(rankScorePercent(3, 3, 'flags')).toBe(20)
    expect(arcadeRank(3, 3, 'flags')).toBe('D')
  })

  it('Beispiele aus dem Design-Nachtrag', () => {
    expect(arcadeRank(14, 15, 'flags')).toBe('S')
    expect(arcadeRank(7, 7, 'city-pin')).toBe('S')
    expect(arcadeRank(12, 20, 'capitals')).toBe('B')
  })

  it('über der Mindestmenge zählt die echte Quote', () => {
    expect(rankScorePercent(27, 30, 'outline')).toBe(90)
    expect(arcadeRank(27, 30, 'outline')).toBe('S')
    expect(arcadeRank(22, 30, 'outline')).toBe('B')
  })

  it('Pin-Modus ist mit weniger Fragen zu schaffen als Choice', () => {
    expect(arcadeRank(6, 6, 'landmark-pin')).toBe('A')
    expect(arcadeRank(6, 6, 'countries')).toBe('C')
  })

  it('Schwellen: S ≥ 90, A ≥ 75, B ≥ 60, C ≥ 40, sonst D', () => {
    const at = (correct: number) => arcadeRank(correct, 20, 'flags')
    expect(at(18)).toBe('S')
    expect(at(17)).toBe('A')
    expect(at(15)).toBe('A')
    expect(at(14)).toBe('B')
    expect(at(12)).toBe('B')
    expect(at(11)).toBe('C')
    expect(at(8)).toBe('C')
    expect(at(7)).toBe('D')
  })

  it('leere Runde ergibt D, nicht NaN', () => {
    expect(rankScorePercent(0, 0, 'flags')).toBe(0)
    expect(arcadeRank(0, 0, 'flags')).toBe('D')
  })
})
