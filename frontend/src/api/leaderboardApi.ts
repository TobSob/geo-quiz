import type { GameMode } from '../features/quiz-engine/types'
import { supabase } from './supabaseClient'

/**
 * Leaderboards seit dem Arcade-Umbau (E5): Bestleistung pro Spieler,
 * Rohpunkte, Zeitfilter — geliefert von den RPCs aus Migration 0005.
 */

export interface LeaderboardScore {
  display_name: string
  score: number
  question_count: number
  played_at: string
}

export interface LeaderboardCup {
  cup_run_id: number
  display_name: string
  total_score: number
  modes_played: string[]
  played_at: string
}

/** Punkte einer einzelnen Disziplin innerhalb eines Cup-Laufs. */
export interface CupRunLeg {
  mode: GameMode
  score: number
  question_count: number
}

export type LeaderboardPeriod = 'week' | 'month' | 'year' | 'all'

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
  all: 'Alle',
}

/** Rollierende Fenster: letzte 7/30/365 Tage; null = alles. */
function periodSince(period: LeaderboardPeriod): string | null {
  const days = { week: 7, month: 30, year: 365, all: null }[period]
  if (days === null) return null
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export async function fetchLeaderboardScores(
  mode: GameMode,
  period: LeaderboardPeriod = 'all',
  limit = 25,
  /** Gruppen-ID für Freundesgruppen-Ansicht; null = global (Phase F). */
  groupId: number | null = null,
): Promise<LeaderboardScore[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_leaderboard_scores', {
    p_mode: mode,
    p_since: periodSince(period),
    p_limit: limit,
    p_group: groupId,
  })
  if (error) return null
  return data as LeaderboardScore[]
}

export async function fetchLeaderboardCups(
  period: LeaderboardPeriod = 'all',
  limit = 25,
  groupId: number | null = null,
): Promise<LeaderboardCup[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_leaderboard_cups', {
    p_since: periodSince(period),
    p_limit: limit,
    p_group: groupId,
  })
  if (error) return null
  return data as LeaderboardCup[]
}

/**
 * Punkte je Disziplin eines Cup-Laufs (Klick auf den Score in der
 * Bestenliste, Migration 0011) — funktioniert für jeden Lauf, nicht nur den
 * eigenen: Score + Name sind über `fetchLeaderboardCups` ohnehin schon für
 * alle registrierten Spieler sichtbar. `null` = Migration fehlt noch oder
 * offline; Aufrufer zeigt dann einfach keine Aufschlüsselung.
 */
export async function fetchCupRunLegs(cupRunId: number): Promise<CupRunLeg[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_cup_run_legs', {
    p_cup_run_id: cupRunId,
  })
  if (error) return null
  return data as CupRunLeg[]
}
