import type { TrophyPeriod } from './badgeCatalog'

/**
 * Perioden-Navigation im Pokale-Tab (Phase I1, DESIGN-GAMIFICATION.md):
 * Die Hall of Fame liefert alle vergebenen Pokale auf einmal — hier wird
 * daraus die blätterbare Perioden-Liste (◀/▶) je Periodentyp abgeleitet.
 * Rein clientseitig, kein neuer Endpunkt.
 */

export interface PeriodEntry {
  periodType: TrophyPeriod
  periodStart: string
}

/**
 * Eindeutige Perioden-Starts eines Typs, neueste zuerst — die Blätter-Achse
 * für ◀ (älter) / ▶ (neuer).
 */
export function listPeriodStarts(
  entries: readonly PeriodEntry[],
  type: TrophyPeriod,
): string[] {
  const unique = new Set<string>()
  for (const e of entries) {
    if (e.periodType === type) unique.add(e.periodStart)
  }
  return [...unique].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
}
