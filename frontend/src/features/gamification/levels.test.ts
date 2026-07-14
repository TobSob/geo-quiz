import { describe, expect, it } from 'vitest'
import {
  LEVEL_CAP,
  levelForXp,
  levelProgress,
  xpForLevel,
  xpForScore,
} from './levels'

describe('xpForLevel', () => {
  it('Level 1 kostet nichts', () => {
    expect(xpForLevel(1)).toBe(0)
  })

  it('Design-Tabelle: LV 2 = 100, LV 5 = 1.000, LV 10 = 4.500', () => {
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(5)).toBe(1000)
    expect(xpForLevel(10)).toBe(4500)
  })

  it('Design-Tabelle: LV 20 = 19.000, LV 50 = 122.500', () => {
    expect(xpForLevel(20)).toBe(19000)
    expect(xpForLevel(50)).toBe(122500)
  })
})

describe('levelForXp', () => {
  it('Grenzwerte: 0 und 99 XP → Level 1, genau 100 XP → Level 2', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(100)).toBe(2)
  })

  it('ist die Umkehrung von xpForLevel (Schwelle erreicht → Level erreicht)', () => {
    for (let n = 1; n <= LEVEL_CAP; n++) {
      expect(levelForXp(xpForLevel(n))).toBe(n)
      if (n > 1) expect(levelForXp(xpForLevel(n) - 1)).toBe(n - 1)
    }
  })

  it('Cap: absurd viel XP bleibt Level 99', () => {
    expect(levelForXp(1_000_000_000)).toBe(LEVEL_CAP)
  })

  it('negative XP fallen auf Level 1', () => {
    expect(levelForXp(-50)).toBe(1)
  })
})

describe('levelProgress', () => {
  it('mitten in Level 2: 150 XP → 50/200 zum nächsten Level', () => {
    const p = levelProgress(150)
    expect(p.level).toBe(2)
    expect(p.intoLevel).toBe(50)
    expect(p.neededForNext).toBe(200)
    expect(p.ratio).toBeCloseTo(0.25)
  })

  it('am Cap ist der Balken voll', () => {
    const p = levelProgress(xpForLevel(LEVEL_CAP) + 999)
    expect(p.level).toBe(LEVEL_CAP)
    expect(p.ratio).toBe(1)
    expect(p.neededForNext).toBe(0)
  })
})

describe('xpForScore (Spiegel der Serverformel)', () => {
  it('ceil(score/100), min. 1', () => {
    expect(xpForScore(0)).toBe(1)
    expect(xpForScore(1)).toBe(1)
    expect(xpForScore(100)).toBe(1)
    expect(xpForScore(101)).toBe(2)
    expect(xpForScore(3900)).toBe(39)
  })
})
