import { describe, expect, it } from 'vitest'
import {
  BADGE_BY_ID,
  BADGE_TIER_XP,
  BADGES,
  badgeMetricValue,
  type BadgeMetricStats,
  formatTrophyPeriod,
  tierForValue,
  TROPHY_XP,
} from './badgeCatalog'

/**
 * Pinnt den Katalog gegen den SQL-Seed in
 * supabase/migrations/0008_gamification.sql — bei Rebalancing beide Seiten
 * (und DESIGN-GAMIFICATION.md) anfassen, sonst schlägt dieser Test an.
 */
const SEED: Record<string, { metric: string; thresholds: number[] }> = {
  globetrotter: { metric: 'questions_answered', thresholds: [50, 250, 1000, 5000, 20000] },
  besserwisser: { metric: 'questions_correct', thresholds: [25, 150, 750, 3000, 12000] },
  punktesauger: { metric: 'total_points', thresholds: [10000, 50000, 250000, 1000000, 5000000] },
  dauerzocker: { metric: 'rounds_played', thresholds: [10, 50, 200, 1000, 5000] },
  highscorer: { metric: 'solo_best_score', thresholds: [1500, 2500, 3500, 4500, 6000] },
  serientaeter: { metric: 'best_streak', thresholds: [5, 10, 15, 20, 30] },
  sniper: { metric: 'volltreffer_count', thresholds: [10, 50, 250, 1000, 5000] },
  cupkaempfer: { metric: 'cup_count', thresholds: [1, 10, 50, 250, 1000] },
  stammgast: { metric: 'play_days', thresholds: [3, 14, 60, 180, 365] },
  pokalregal: { metric: 'trophy_count', thresholds: [1, 3, 10, 25, 60] },
  flaggen_fan: { metric: 'mode_correct:flags', thresholds: [25, 100, 500, 2000, 10000] },
  kontinental: { metric: 'mode_correct:countries', thresholds: [25, 100, 500, 2000, 10000] },
  hauptstadt_held: { metric: 'mode_correct:capitals', thresholds: [25, 100, 500, 2000, 10000] },
  silhouetten: { metric: 'mode_correct:outline', thresholds: [25, 100, 500, 2000, 10000] },
  staedte_sniper: { metric: 'mode_correct:city-pin', thresholds: [15, 75, 300, 1200, 6000] },
  landmark_magier: { metric: 'mode_correct:landmark-pin', thresholds: [15, 75, 300, 1200, 6000] },
}

describe('Badge-Katalog', () => {
  it('deckt exakt die geseedeten Badges ab', () => {
    expect(BADGES.map((b) => b.id).sort()).toEqual(Object.keys(SEED).sort())
  })

  it('Metriken und Schwellen stimmen mit dem SQL-Seed überein', () => {
    for (const b of BADGES) {
      expect(b.metric, b.id).toBe(SEED[b.id].metric)
      expect([...b.thresholds], b.id).toEqual(SEED[b.id].thresholds)
    }
  })

  it('Schwellen steigen streng an', () => {
    for (const b of BADGES) {
      for (let t = 1; t < b.thresholds.length; t++) {
        expect(b.thresholds[t], `${b.id} Stufe ${t + 1}`).toBeGreaterThan(
          b.thresholds[t - 1],
        )
      }
    }
  })

  it('jede Stufe hat einen eigenen, nichtleeren Spruch', () => {
    for (const b of BADGES) {
      expect(b.subtitles).toHaveLength(5)
      expect(new Set(b.subtitles).size, b.id).toBe(5)
      for (const s of b.subtitles) expect(s.trim().length).toBeGreaterThan(0)
    }
  })

  it('XP-Konstanten spiegeln den Server (0008/0009)', () => {
    expect([...BADGE_TIER_XP]).toEqual([25, 50, 100, 250, 500])
    expect(TROPHY_XP).toEqual({
      week: [200, 100, 50],
      month: [500, 250, 125],
      year: [1500, 750, 375],
    })
  })
})

describe('badgeMetricValue / tierForValue', () => {
  const stats: BadgeMetricStats = {
    rounds_played: 12,
    solo_best_score: 2600,
    cup_count: 0,
    questions_answered: 300,
    questions_correct: 260,
    total_points: 52000,
    best_streak: 14,
    volltreffer_count: 9,
    trophy_count: 0,
    play_days: 2,
    mode_correct: { flags: 120, 'city-pin': 15 },
  }

  it('löst Spalten-Metriken auf', () => {
    expect(badgeMetricValue(BADGE_BY_ID.get('dauerzocker')!, stats)).toBe(12)
    expect(badgeMetricValue(BADGE_BY_ID.get('serientaeter')!, stats)).toBe(14)
  })

  it('löst mode_correct-Metriken auf (fehlender Modus → 0)', () => {
    expect(badgeMetricValue(BADGE_BY_ID.get('flaggen_fan')!, stats)).toBe(120)
    expect(badgeMetricValue(BADGE_BY_ID.get('staedte_sniper')!, stats)).toBe(15)
    expect(badgeMetricValue(BADGE_BY_ID.get('silhouetten')!, stats)).toBe(0)
  })

  it('tierForValue: unterhalb, exakt auf und über den Schwellen', () => {
    const serientaeter = BADGE_BY_ID.get('serientaeter')!
    expect(tierForValue(serientaeter, 0)).toBe(0)
    expect(tierForValue(serientaeter, 4)).toBe(0)
    expect(tierForValue(serientaeter, 5)).toBe(1)
    expect(tierForValue(serientaeter, 14)).toBe(2)
    expect(tierForValue(serientaeter, 15)).toBe(3)
    expect(tierForValue(serientaeter, 99)).toBe(5)
  })
})

describe('formatTrophyPeriod', () => {
  it('Jahr → „2026"', () => {
    expect(formatTrophyPeriod('year', '2026-01-01')).toBe('2026')
  })

  it('Monat → „Juli 2026"', () => {
    expect(formatTrophyPeriod('month', '2026-07-01')).toBe('Juli 2026')
  })

  it('Woche → ISO-KW („KW 28 2026" für Mo, 6. Juli 2026)', () => {
    expect(formatTrophyPeriod('week', '2026-07-06')).toBe('KW 28 2026')
  })

  it('Jahreswechsel: 29. Dez 2025 gehört zu KW 1 2026', () => {
    expect(formatTrophyPeriod('week', '2025-12-29')).toBe('KW 1 2026')
  })
})
