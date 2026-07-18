import { describe, expect, it } from 'vitest'
import { listPeriodStarts } from './trophyPeriods'
import type { PeriodEntry } from './trophyPeriods'

const entries: PeriodEntry[] = [
  { periodType: 'week', periodStart: '2026-07-06' },
  { periodType: 'week', periodStart: '2026-06-29' },
  // Top 3 derselben Woche → nur EINE Periode in der Navigation:
  { periodType: 'week', periodStart: '2026-07-06' },
  { periodType: 'week', periodStart: '2026-07-06' },
  { periodType: 'month', periodStart: '2026-06-01' },
  { periodType: 'year', periodStart: '2025-01-01' },
]

describe('listPeriodStarts', () => {
  it('liefert eindeutige Perioden des Typs, neueste zuerst', () => {
    expect(listPeriodStarts(entries, 'week')).toEqual([
      '2026-07-06',
      '2026-06-29',
    ])
  })

  it('trennt die Periodentypen sauber', () => {
    expect(listPeriodStarts(entries, 'month')).toEqual(['2026-06-01'])
    expect(listPeriodStarts(entries, 'year')).toEqual(['2025-01-01'])
  })

  it('leere Eingabe → leere Liste', () => {
    expect(listPeriodStarts([], 'week')).toEqual([])
  })
})
