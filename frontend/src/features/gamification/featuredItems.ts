import type { BadgeTier, TrophyPeriod, TrophyRank } from './badgeCatalog'

/**
 * Pokalregal-Slots (Phase I, DESIGN-GAMIFICATION.md): typisierte Sicht auf das
 * `featured`-Array der Lese-RPCs (Migration 0014). Pures Modul (testbar ohne
 * Supabase-Client) — die API-Schicht (gamificationApi) reicht nur durch.
 */

/** Ein kuratierter Regal-Platz: Abzeichen oder Pokal. */
export type FeaturedItem =
  | { slot: number; itemType: 'badge'; badgeId: string; tier: BadgeTier }
  | {
      slot: number
      itemType: 'trophy'
      trophyId: number
      periodType: TrophyPeriod
      periodStart: string
      rank: TrophyRank
      totalScore: number
    }

type Json = Record<string, unknown>

function asObjects(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.filter(
        (v): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v),
      )
    : []
}

/**
 * jsonb-Array `featured` → typisierte Regal-Slots. Unbrauchbare Einträge
 * werden verworfen statt die ganze Antwort zu kippen; fehlt der Schlüssel
 * komplett (Migration 0014 nicht eingespielt), kommt [] heraus.
 */
export function parseFeaturedItems(value: unknown): FeaturedItem[] {
  const items: FeaturedItem[] = []
  for (const f of asObjects(value)) {
    const slot = Number(f.slot)
    if (!Number.isInteger(slot) || slot < 1 || slot > 6) continue
    if (f.item_type === 'badge' && typeof f.badge_id === 'string') {
      const tier = Number(f.tier)
      if (tier < 1 || tier > 5) continue
      items.push({
        slot,
        itemType: 'badge',
        badgeId: f.badge_id,
        tier: tier as BadgeTier,
      })
    } else if (f.item_type === 'trophy' && f.period_type != null) {
      const rank = Number(f.rank)
      if (rank < 1 || rank > 3) continue
      items.push({
        slot,
        itemType: 'trophy',
        trophyId: Number(f.trophy_id) || 0,
        periodType: f.period_type as TrophyPeriod,
        periodStart: String(f.period_start),
        rank: rank as TrophyRank,
        totalScore: Number(f.total_score) || 0,
      })
    }
  }
  return items.sort((a, b) => a.slot - b.slot)
}
