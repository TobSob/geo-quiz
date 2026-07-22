import { describe, expect, it } from 'vitest'
import { formatTrophyPeriod } from '../gamification/badgeCatalog'
import {
  berlinMidnight,
  berlinToday,
  maxPeriodOffset,
  periodRange,
  periodStart,
  periodsBetween,
  toIsoDate,
  truncateToPeriod,
} from './periods'

/** Mittwoch, 22.07.2026, 10:00 Berlin (= 08:00 UTC, Sommerzeit). */
const WED = new Date('2026-07-22T08:00:00Z')

describe('berlinToday', () => {
  it('nimmt den Berliner Kalendertag, nicht den UTC-Tag', () => {
    // 23:30 UTC am 21.07. ist in Berlin bereits der 22.07. (01:30 MESZ)
    expect(toIsoDate(berlinToday(new Date('2026-07-21T23:30:00Z')))).toBe('2026-07-22')
  })
})

describe('truncateToPeriod', () => {
  it('schneidet die Woche auf Montag zurück (wie date_trunc)', () => {
    expect(toIsoDate(truncateToPeriod('week', berlinToday(WED)))).toBe('2026-07-20')
  })

  it('lässt einen Montag unverändert', () => {
    expect(
      toIsoDate(truncateToPeriod('week', new Date('2026-07-20T00:00:00Z'))),
    ).toBe('2026-07-20')
  })

  it('springt über den Monatswechsel zurück', () => {
    // Mittwoch 01.07.2026 → Montag 29.06.2026
    expect(
      toIsoDate(truncateToPeriod('week', new Date('2026-07-01T00:00:00Z'))),
    ).toBe('2026-06-29')
  })

  it('schneidet Monat und Jahr auf den Ersten zurück', () => {
    expect(toIsoDate(truncateToPeriod('month', berlinToday(WED)))).toBe('2026-07-01')
    expect(toIsoDate(truncateToPeriod('year', berlinToday(WED)))).toBe('2026-01-01')
  })
})

describe('periodStart', () => {
  it('blättert wochenweise zurück', () => {
    expect(toIsoDate(periodStart('week', 0, WED))).toBe('2026-07-20')
    expect(toIsoDate(periodStart('week', 1, WED))).toBe('2026-07-13')
    expect(toIsoDate(periodStart('week', 30, WED))).toBe('2025-12-22')
  })

  it('blättert monats- und jahresweise zurück', () => {
    expect(toIsoDate(periodStart('month', 7, WED))).toBe('2025-12-01')
    expect(toIsoDate(periodStart('year', 2, WED))).toBe('2024-01-01')
  })
})

describe('berlinMidnight', () => {
  it('trifft Mitternacht in der Sommerzeit (UTC+2)', () => {
    expect(berlinMidnight(new Date('2026-07-20T00:00:00Z')).toISOString()).toBe(
      '2026-07-19T22:00:00.000Z',
    )
  })

  it('trifft Mitternacht in der Winterzeit (UTC+1)', () => {
    expect(berlinMidnight(new Date('2026-01-05T00:00:00Z')).toISOString()).toBe(
      '2026-01-04T23:00:00.000Z',
    )
  })

  it('stimmt auch am Tag der Umstellung (März: +1 → +2)', () => {
    // Umstellung am 29.03.2026 um 02:00 MEZ; Mitternacht liegt noch bei UTC+1.
    expect(berlinMidnight(new Date('2026-03-29T00:00:00Z')).toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    )
    expect(berlinMidnight(new Date('2026-03-30T00:00:00Z')).toISOString()).toBe(
      '2026-03-29T22:00:00.000Z',
    )
  })

  it('stimmt auch am Tag der Umstellung (Oktober: +2 → +1)', () => {
    // Umstellung am 25.10.2026 um 03:00 MESZ; Mitternacht liegt noch bei UTC+2.
    expect(berlinMidnight(new Date('2026-10-25T00:00:00Z')).toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    )
    expect(berlinMidnight(new Date('2026-10-26T00:00:00Z')).toISOString()).toBe(
      '2026-10-25T23:00:00.000Z',
    )
  })
})

describe('periodRange', () => {
  it('liefert ein halboffenes Wochenfenster Mo 00:00 – Mo 00:00 (Berlin)', () => {
    expect(periodRange('week', 0, WED)).toEqual({
      since: '2026-07-19T22:00:00.000Z',
      until: '2026-07-26T22:00:00.000Z',
    })
  })

  it('liefert für „Alle" kein Fenster', () => {
    expect(periodRange('all', 0, WED)).toEqual({ since: null, until: null })
  })

  it('schließt an die Vorperiode lückenlos an', () => {
    expect(periodRange('month', 1, WED).until).toBe(periodRange('month', 0, WED).since)
  })
})

describe('periodsBetween', () => {
  it('zählt Wochen, Monate und Jahre', () => {
    const a = new Date('2025-12-22T00:00:00Z')
    expect(periodsBetween('week', a, new Date('2026-07-20T00:00:00Z'))).toBe(30)
    expect(
      periodsBetween(
        'month',
        new Date('2025-12-01T00:00:00Z'),
        new Date('2026-07-01T00:00:00Z'),
      ),
    ).toBe(7)
    expect(
      periodsBetween(
        'year',
        new Date('2024-01-01T00:00:00Z'),
        new Date('2026-01-01T00:00:00Z'),
      ),
    ).toBe(2)
  })
})

describe('maxPeriodOffset', () => {
  it('erlaubt genau so viele Schritte, wie es Perioden mit Daten gibt', () => {
    expect(maxPeriodOffset('week', '2026-07-01T12:00:00Z', WED)).toBe(3)
    expect(maxPeriodOffset('month', '2026-07-01T12:00:00Z', WED)).toBe(0)
    expect(maxPeriodOffset('year', '2025-11-30T12:00:00Z', WED)).toBe(1)
  })

  it('sperrt das Blättern ohne Daten, bei „Alle" und bei Müll-Eingaben', () => {
    expect(maxPeriodOffset('week', null, WED)).toBe(0)
    expect(maxPeriodOffset('all', '2020-01-01T00:00:00Z', WED)).toBe(0)
    expect(maxPeriodOffset('week', 'kaputt', WED)).toBe(0)
  })

  it('wird nie negativ, wenn der erste Eintrag in der Zukunft läge', () => {
    expect(maxPeriodOffset('week', '2027-01-01T00:00:00Z', WED)).toBe(0)
  })
})

describe('Beschriftung', () => {
  it('nutzt dieselben Labels wie die Pokal-Perioden', () => {
    expect(formatTrophyPeriod('week', toIsoDate(periodStart('week', 0, WED)))).toBe(
      'KW 30 2026',
    )
    expect(formatTrophyPeriod('month', toIsoDate(periodStart('month', 0, WED)))).toBe(
      'Juli 2026',
    )
    expect(formatTrophyPeriod('year', toIsoDate(periodStart('year', 0, WED)))).toBe(
      '2026',
    )
  })
})
