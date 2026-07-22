import type { TrophyPeriod } from '../gamification/badgeCatalog'

/**
 * Kalender-Zeiträume der Bestenliste (DESIGN-LEADERBOARD-PERIODS.md).
 *
 * Bis Migration 0016 filterte die Bestenliste rollierend („letzte 7 Tage"),
 * die Pokale dagegen nach Kalenderperioden in Europe/Berlin — „Woche" hieß an
 * beiden Stellen etwas anderes. Hier liegt die gemeinsame Rechnung: Woche =
 * Montag–Sonntag wie `date_trunc('week', … at time zone 'Europe/Berlin')`.
 *
 * Rein und ohne Server-Abhängigkeit; die RPCs bekommen nur zwei Zeitstempel.
 */

/** Zeitraum-Typen mit Perioden — deckungsgleich mit den Pokal-Perioden. */
export type CalendarPeriod = TrophyPeriod

export type LeaderboardPeriod = CalendarPeriod | 'all'

export const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'year', 'all']

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
  all: 'Alle',
}

const BERLIN = 'Europe/Berlin'

const BERLIN_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: BERLIN,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Berliner Wanduhrzeit eines Moments als Zahlen-Tupel. */
function berlinParts(at: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const raw: Record<string, string> = {}
  for (const p of BERLIN_PARTS.formatToParts(at)) raw[p.type] = p.value
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    // 24-Uhr-Formate liefern je nach Engine „24" statt „00" für Mitternacht.
    hour: Number(raw.hour) % 24,
    minute: Number(raw.minute),
    second: Number(raw.second),
  }
}

/** Abstand Berliner Wanduhr ↔ UTC in Millisekunden (+1 h bzw. +2 h). */
function berlinOffsetMs(at: Date): number {
  const p = berlinParts(at)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** Reines Kalenderdatum (UTC-Mitternacht) — Rechengrundlage aller Perioden. */
export function pureDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day))
}

/** Heutiges Kalenderdatum in Europe/Berlin. */
export function berlinToday(now: Date = new Date()): Date {
  const p = berlinParts(now)
  return pureDate(p.year, p.month - 1, p.day)
}

/** Berliner Kalenderdatum eines beliebigen Moments (z. B. eines Score-Zeitstempels). */
export function berlinDateOf(at: Date): Date {
  return berlinToday(at)
}

/**
 * Der UTC-Moment, an dem in Berlin dieser Kalendertag beginnt.
 *
 * Eine Korrekturrunde genügt: Die Zeitumstellung liegt um 01:00 UTC, die
 * Korrektur bewegt den Zeitpunkt von 00:00 UTC auf 22:00/23:00 UTC des
 * Vortages — in diesem Fenster wechselt der Offset nie.
 */
export function berlinMidnight(date: Date): Date {
  const utcMidnight = pureDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
  return new Date(utcMidnight.getTime() - berlinOffsetMs(utcMidnight))
}

/** Periodenanfang des Kalendertags `d` (Woche = Montag). */
export function truncateToPeriod(period: CalendarPeriod, d: Date): Date {
  if (period === 'year') return pureDate(d.getUTCFullYear(), 0, 1)
  if (period === 'month') return pureDate(d.getUTCFullYear(), d.getUTCMonth(), 1)
  const mondayBased = (d.getUTCDay() + 6) % 7
  return pureDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayBased)
}

/** Periodenanfang um `by` Perioden verschoben (negativ = zurück). */
export function shiftPeriod(period: CalendarPeriod, start: Date, by: number): Date {
  if (period === 'year') return pureDate(start.getUTCFullYear() + by, 0, 1)
  if (period === 'month') {
    return pureDate(start.getUTCFullYear(), start.getUTCMonth() + by, 1)
  }
  return pureDate(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + by * 7,
  )
}

/** Anfang der Periode, `offset` Perioden vor der laufenden (0 = aktuell). */
export function periodStart(
  period: CalendarPeriod,
  offset = 0,
  now: Date = new Date(),
): Date {
  return shiftPeriod(period, truncateToPeriod(period, berlinToday(now)), -offset)
}

/** Halboffenes Zeitfenster [since, until) einer Periode als ISO-Zeitstempel. */
export function periodRange(
  period: LeaderboardPeriod,
  offset = 0,
  now: Date = new Date(),
): { since: string | null; until: string | null } {
  if (period === 'all') return { since: null, until: null }
  const start = periodStart(period, offset, now)
  return {
    since: berlinMidnight(start).toISOString(),
    until: berlinMidnight(shiftPeriod(period, start, 1)).toISOString(),
  }
}

/** „2026-07-20" — Beschriftungs-Eingabe für `formatTrophyPeriod`. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Wie viele Perioden liegen zwischen den beiden Periodenanfängen? */
export function periodsBetween(
  period: CalendarPeriod,
  earlier: Date,
  later: Date,
): number {
  if (period === 'year') return later.getUTCFullYear() - earlier.getUTCFullYear()
  if (period === 'month') {
    return (
      (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
      (later.getUTCMonth() - earlier.getUTCMonth())
    )
  }
  return Math.round((later.getTime() - earlier.getTime()) / (7 * 86_400_000))
}

/**
 * Größter erlaubter ◀-Offset: bis zur Periode des ersten Eintrags.
 * `firstPlayed === null` (keine Daten oder RPC fehlt) → kein Blättern.
 */
export function maxPeriodOffset(
  period: LeaderboardPeriod,
  firstPlayed: string | null,
  now: Date = new Date(),
): number {
  if (period === 'all' || firstPlayed === null) return 0
  const at = new Date(firstPlayed)
  if (Number.isNaN(at.getTime())) return 0
  const first = truncateToPeriod(period, berlinDateOf(at))
  const current = periodStart(period, 0, now)
  return Math.max(0, periodsBetween(period, first, current))
}
