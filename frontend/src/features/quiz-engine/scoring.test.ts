import { describe, expect, it } from 'vitest'
import { distanceScore, scoreChoice, scorePin } from './scoring'

describe('scoreChoice', () => {
  it('matches the worked example from the plan: 2000ms/8000ms, streak 6 → 179', () => {
    // time_bonus = round(50 * (1 - 0.25)) = 38, streak_mult = 1.30 → round(138 * 1.3) = 179
    expect(scoreChoice(true, 2000, 8000, 6)).toBe(179)
  })

  it('max score is 225 (instant answer, streak >= 10)', () => {
    expect(scoreChoice(true, 0, 8000, 10)).toBe(225)
    expect(scoreChoice(true, 0, 8000, 25)).toBe(225) // multiplier caps
  })

  it('wrong answers score 0', () => {
    expect(scoreChoice(false, 0, 8000, 10)).toBe(0)
  })

  it('no time bonus at/after the limit, base points remain', () => {
    expect(scoreChoice(true, 8000, 8000, 0)).toBe(100)
    expect(scoreChoice(true, 12000, 8000, 0)).toBe(100) // bonus clamps at 0, never negative
  })
})

describe('distanceScore (R=200, table from the plan)', () => {
  const table: Array<[number, number]> = [
    [0, 100], // bullseye
    [50, 78],
    [100, 61],
    [200, 37],
    [500, 8],
  ]
  for (const [km, expected] of table) {
    it(`${km} km → ${expected}`, () => {
      expect(distanceScore(km, 200)).toBe(expected)
    })
  }

  it('forces 100 under the 5 km bullseye radius', () => {
    expect(distanceScore(4.9, 200)).toBe(100)
  })

  it('never goes below 0', () => {
    expect(distanceScore(10_000, 200)).toBe(0)
  })
})

describe('scorePin', () => {
  it('bullseye with instant answer: 90% of 100 + 10 time bonus = 100', () => {
    expect(scorePin(0, 200, 0, 15000)).toBe(100)
  })

  it('bullseye at the time limit still gets 90', () => {
    expect(scorePin(0, 200, 15000, 15000)).toBe(90)
  })

  it('precision dominates: 200km miss answered instantly stays low', () => {
    // dScore 37 → 33.3 + 10 → 43
    expect(scorePin(200, 200, 0, 15000)).toBe(43)
  })
})
