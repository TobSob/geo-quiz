import type { GameMode } from '../features/quiz-engine/types'
import type {
  BadgeTier,
  TrophyPeriod,
  TrophyRank,
} from '../features/gamification/badgeCatalog'
import {
  parseFeaturedItems,
  type FeaturedItem,
} from '../features/gamification/featuredItems'
import { supabase } from './supabaseClient'

export { parseFeaturedItems }
export type { FeaturedItem }

/**
 * Gamification-RPCs (Migration 0008): eigener Stand (get_gamification),
 * Hall of Fame (get_cup_trophies) und Level-Bestenliste
 * (get_leaderboard_levels). Alles nur für registrierte Accounts —
 * Fehler/Gäste liefern null, das UI zeigt dann den Teaser.
 */

export interface PlayerStats {
  xp: number
  rounds_played: number
  solo_best_score: number
  cup_count: number
  cup_best_score: number
  questions_answered: number
  questions_correct: number
  total_points: number
  best_streak: number
  volltreffer_count: number
  trophy_count: number
  play_days: number
  last_play_day: string | null
  mode_correct: Partial<Record<GameMode, number>>
  updated_at: string
}

export interface OwnedBadge {
  badgeId: string
  tier: BadgeTier
  awardedAt: string
}

export interface OwnedTrophy {
  /** Server-ID (0014) — null, solange die Migration auf der DB fehlt. */
  trophyId: number | null
  periodType: TrophyPeriod
  periodStart: string
  rank: TrophyRank
  totalScore: number
  awardedAt: string
}

export interface GamificationData {
  stats: PlayerStats
  badges: OwnedBadge[]
  trophies: OwnedTrophy[]
  /** Pokalregal-Slots; leer ohne Kuration oder ohne Migration 0014. */
  featured: FeaturedItem[]
}

export interface NewBadge {
  badgeId: string
  tier: BadgeTier
  xp: number
}

/** Rückgabe der submit-RPCs: was diese Abgabe freigeschaltet hat. */
export interface UnlockPayload {
  xpGained: number
  xpTotal: number
  newBadges: NewBadge[]
}

export interface HallOfFameEntry {
  periodType: TrophyPeriod
  periodStart: string
  rank: TrophyRank
  displayName: string
  totalScore: number
  awardedAt: string
}

export interface LeaderboardLevelEntry {
  display_name: string
  xp: number
}

/** Spielerkarte eines beliebigen registrierten Accounts (Klick in der Bestenliste). */
export interface OtherPlayerCard {
  displayName: string
  avatarId: string | null
  xp: number
  trophyCount: number
  cupBestScore: number
  badges: { badgeId: string; tier: BadgeTier }[]
  modeBests: { mode: GameMode; score: number }[]
  /** Pokalregal-Slots; leer ohne Kuration oder ohne Migration 0014. */
  featured: FeaturedItem[]
}

type Json = Record<string, unknown>

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : null
}

function asArray(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.map((v) => asObject(v)).filter((v): v is Json => v !== null)
    : []
}

function toNewBadge(b: Json): NewBadge {
  return {
    badgeId: String(b.badge_id),
    tier: Number(b.tier) as BadgeTier,
    xp: Number(b.xp) || 0,
  }
}

/** jsonb der submit-RPCs → UnlockPayload (null bei unbrauchbarer Antwort). */
export function parseUnlockPayload(data: unknown): UnlockPayload | null {
  const d = asObject(data)
  if (!d || typeof d.xp_gained !== 'number') return null
  return {
    xpGained: d.xp_gained,
    xpTotal: typeof d.xp_total === 'number' ? d.xp_total : 0,
    newBadges: asArray(d.new_badges).map(toNewBadge),
  }
}

/** Mehrere Payloads (Cup-Run + Legs) zu einer Anzeige-Summe bündeln. */
export function mergeUnlockPayloads(
  payloads: (UnlockPayload | null)[],
): UnlockPayload | null {
  const valid = payloads.filter((p): p is UnlockPayload => p !== null)
  if (valid.length === 0) return null
  const seen = new Set<string>()
  const newBadges: NewBadge[] = []
  for (const p of valid) {
    for (const b of p.newBadges) {
      const key = `${b.badgeId}:${b.tier}`
      if (!seen.has(key)) {
        seen.add(key)
        newBadges.push(b)
      }
    }
  }
  return {
    xpGained: valid.reduce((sum, p) => sum + p.xpGained, 0),
    xpTotal: Math.max(...valid.map((p) => p.xpTotal)),
    newBadges,
  }
}

/** Eigener Gamification-Stand; null für Gäste/offline/frische Accounts. */
export async function fetchGamification(): Promise<GamificationData | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_gamification')
  if (error || !data) return null
  const d = asObject(data)
  const stats = d ? asObject(d.stats) : null
  if (!d || !stats) return null
  return {
    stats: stats as unknown as PlayerStats,
    badges: asArray(d.badges).map((b) => ({
      badgeId: String(b.badge_id),
      tier: Number(b.tier) as BadgeTier,
      awardedAt: String(b.awarded_at),
    })),
    trophies: asArray(d.trophies).map((t) => ({
      trophyId: typeof t.trophy_id === 'number' ? t.trophy_id : null,
      periodType: t.period_type as TrophyPeriod,
      periodStart: String(t.period_start),
      rank: (Number(t.rank) || 1) as TrophyRank,
      totalScore: Number(t.total_score) || 0,
      awardedAt: String(t.awarded_at),
    })),
    featured: parseFeaturedItems(d.featured),
  }
}

/**
 * Pokalregal speichern (RPC set_featured_items, 0014) — ersetzt alle Slots
 * auf einmal. False bei Gast/offline oder wenn die Migration noch fehlt.
 */
export async function saveFeaturedItems(items: FeaturedItem[]): Promise<boolean> {
  if (!supabase) return false
  const payload = items.map((i) =>
    i.itemType === 'badge'
      ? { slot: i.slot, item_type: 'badge', badge_id: i.badgeId, tier: i.tier }
      : { slot: i.slot, item_type: 'trophy', trophy_id: i.trophyId },
  )
  const { error } = await supabase.rpc('set_featured_items', { p_items: payload })
  return !error
}

/** Hall of Fame: alle vergebenen Cup-Pokale (Name + Punkte, nie user_id). */
export async function fetchHallOfFame(
  limit = 100,
): Promise<HallOfFameEntry[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_cup_trophies', {
    p_limit: limit,
  })
  if (error || !data) return null
  return asArray(data).map((row) => ({
    periodType: row.period_type as TrophyPeriod,
    periodStart: String(row.period_start),
    rank: (Number(row.rank) || 1) as TrophyRank,
    displayName: String(row.display_name),
    totalScore: Number(row.total_score) || 0,
    awardedAt: String(row.awarded_at),
  }))
}

/**
 * Spielerkarte eines beliebigen Accounts anhand seines Anzeigenamens
 * (Migration 0012) — `null` bei Gast/offline, unbekanntem Namen oder wenn die
 * Migration auf der Live-DB noch fehlt. Nie die eigene Karte hardcodiert:
 * die Bestenliste ruft das für jede angeklickte Zeile mit ihrem Namen auf.
 */
export async function fetchPlayerCard(displayName: string): Promise<OtherPlayerCard | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_player_card', {
    p_display_name: displayName,
  })
  if (error || !data) return null
  const d = asObject(data)
  if (!d) return null
  return {
    displayName: String(d.display_name ?? displayName),
    avatarId: typeof d.avatar_id === 'string' ? d.avatar_id : null,
    xp: Number(d.xp) || 0,
    trophyCount: Number(d.trophy_count) || 0,
    cupBestScore: Number(d.cup_best_score) || 0,
    badges: asArray(d.badges).map((b) => ({
      badgeId: String(b.badge_id),
      tier: Number(b.tier) as BadgeTier,
    })),
    modeBests: asArray(d.mode_bests).map((m) => ({
      mode: String(m.mode) as GameMode,
      score: Number(m.score) || 0,
    })),
    featured: parseFeaturedItems(d.featured),
  }
}

/** Level-Bestenliste (XP absteigend); Level rechnet der Client. */
export async function fetchLeaderboardLevels(
  limit = 25,
  groupId: number | null = null,
): Promise<LeaderboardLevelEntry[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_leaderboard_levels', {
    p_limit: limit,
    p_group: groupId,
  })
  if (error) return null
  return data as LeaderboardLevelEntry[]
}
