import { describe, expect, it } from 'vitest'
import {
  nextStreakChoice,
  nextStreakPin,
  pinTierFor,
  reclaimedSeconds,
  roundStreak,
  scoreChoiceArcade,
  scorePinArcade,
  streakMultiplier,
} from './arcadeScoring'

describe('streakMultiplier', () => {
  it('Basisfall: Streak 0 → 100 %', () => {
    expect(streakMultiplier(0)).toBe(1)
  })

  it('Beispiel aus dem Design: Streak 7 → 170 %', () => {
    expect(streakMultiplier(7)).toBeCloseTo(1.7)
  })

  it('Bruchteil-Streak aus dem Design: 4,4 → 144 %', () => {
    expect(streakMultiplier(4.4)).toBeCloseTo(1.44)
  })

  it('unbegrenzt: Streak 25 → 350 %', () => {
    expect(streakMultiplier(25)).toBeCloseTo(3.5)
  })
})

describe('scoreChoiceArcade', () => {
  it('falsch → 0', () => {
    expect(scoreChoiceArcade(false, 12)).toBe(0)
  })

  it('richtig ohne Streak → 100', () => {
    expect(scoreChoiceArcade(true, 0)).toBe(100)
  })

  it('richtig bei Streak 7 → 170', () => {
    expect(scoreChoiceArcade(true, 7)).toBe(170)
  })
})

describe('pinTierFor / scorePinArcade', () => {
  it.each([
    [0, 'volltreffer', 100],
    [100, 'volltreffer', 100],
    [100.1, 'stark', 50],
    [350, 'stark', 50],
    [350.1, 'knapp', 10],
    [1000, 'knapp', 10],
    [1000.1, 'naja', 1],
    [2500, 'naja', 1],
    [2500.1, 'verpeilt', 0],
    [19000, 'verpeilt', 0],
  ])('%s km → Stufe %s (%s Punkte)', (km, tierId, points) => {
    const tier = pinTierFor(km)
    expect(tier.id).toBe(tierId)
    expect(scorePinArcade(km, 0)).toBe(points)
  })

  it('Beispiel aus dem Design: STARK! bei Streak 4,4 → 72 Punkte', () => {
    expect(scorePinArcade(150, 4.4)).toBe(72)
  })

  it('Volltreffer trägt +3 s Zeitbonus, andere Stufen 0', () => {
    expect(pinTierFor(50).timeBonusSeconds).toBe(3)
    expect(pinTierFor(300).timeBonusSeconds).toBe(0)
    expect(pinTierFor(9000).timeBonusSeconds).toBe(0)
  })
})

describe('Streak-Übergänge', () => {
  it('Choice: richtig +1, falsch → 0', () => {
    expect(nextStreakChoice(6, true)).toBe(7)
    expect(nextStreakChoice(23, false)).toBe(0)
  })

  it('Pin-Stufen: +1 / +0,5 / +0,1 / hält / bricht', () => {
    expect(nextStreakPin(3, 80)).toBe(4)
    expect(nextStreakPin(3, 180)).toBe(3.5)
    expect(nextStreakPin(3, 450)).toBe(3.1)
    expect(nextStreakPin(3, 1500)).toBe(3) // NAJA… hält die Streak
    expect(nextStreakPin(3, 3000)).toBe(0) // VÖLLIG VERPEILT bricht
  })

  it('keine Float-Drift: zehnmal +0,1 ergibt exakt 1', () => {
    let s = 0
    for (let i = 0; i < 10; i++) s = nextStreakPin(s, 450)
    expect(s).toBe(1)
  })
})

describe('reclaimedSeconds (+5 s je vollem Zehner)', () => {
  it('glatter Übergang: 9 → 10 löst aus', () => {
    expect(reclaimedSeconds(9, 10)).toBe(5)
  })

  it('Bruchteil-Übergang aus dem Design: 9,8 → 10,3 löst aus', () => {
    expect(reclaimedSeconds(9.8, 10.3)).toBe(5)
  })

  it('kein Doppelbonus: 10 → 11 löst nicht erneut aus', () => {
    expect(reclaimedSeconds(10, 11)).toBe(0)
  })

  it('zweiter Zehner: 19,9 → 20,9 löst aus', () => {
    expect(reclaimedSeconds(19.9, 20.9)).toBe(5)
  })

  it('Streak-Verlust gibt nichts zurück', () => {
    expect(reclaimedSeconds(23, 0)).toBe(0)
  })

  it('unterhalb des Zehners passiert nichts', () => {
    expect(reclaimedSeconds(3, 4)).toBe(0)
    expect(reclaimedSeconds(9.1, 9.6)).toBe(0)
  })
})

describe('roundStreak', () => {
  it('rundet auf eine Nachkommastelle', () => {
    expect(roundStreak(0.30000000000000004)).toBe(0.3)
    expect(roundStreak(4.449999)).toBe(4.4)
  })
})
