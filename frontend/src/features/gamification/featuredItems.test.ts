import { describe, expect, it } from 'vitest'
import { parseFeaturedItems } from './featuredItems'

describe('parseFeaturedItems', () => {
  it('fehlender/leerer Schlüssel (Migration 0014 nicht eingespielt) → []', () => {
    expect(parseFeaturedItems(undefined)).toEqual([])
    expect(parseFeaturedItems(null)).toEqual([])
    expect(parseFeaturedItems([])).toEqual([])
    expect(parseFeaturedItems('quatsch')).toEqual([])
  })

  it('parst Badge- und Pokal-Slots und sortiert nach Slot', () => {
    const raw = [
      {
        slot: 4,
        item_type: 'trophy',
        trophy_id: 7,
        period_type: 'month',
        period_start: '2026-06-01',
        rank: 1,
        total_score: 2345,
      },
      { slot: 1, item_type: 'badge', badge_id: 'sniper', tier: 3 },
    ]
    expect(parseFeaturedItems(raw)).toEqual([
      { slot: 1, itemType: 'badge', badgeId: 'sniper', tier: 3 },
      {
        slot: 4,
        itemType: 'trophy',
        trophyId: 7,
        periodType: 'month',
        periodStart: '2026-06-01',
        rank: 1,
        totalScore: 2345,
      },
    ])
  })

  it('verwirft unbrauchbare Einträge statt die Antwort zu kippen', () => {
    const raw = [
      { slot: 0, item_type: 'badge', badge_id: 'x', tier: 1 }, // Slot außerhalb 1–6
      { slot: 7, item_type: 'badge', badge_id: 'x', tier: 1 },
      { slot: 2, item_type: 'badge', badge_id: 'x', tier: 9 }, // Stufe außerhalb 1–5
      { slot: 3, item_type: 'trophy', trophy_id: 1, rank: 4 }, // Rang > 3, keine Periode
      { slot: 5, item_type: 'unbekannt' },
      'kein Objekt',
      { slot: 6, item_type: 'badge', badge_id: 'ok', tier: 5 },
    ]
    expect(parseFeaturedItems(raw)).toEqual([
      { slot: 6, itemType: 'badge', badgeId: 'ok', tier: 5 },
    ])
  })
})
