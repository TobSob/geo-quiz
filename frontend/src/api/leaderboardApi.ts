import type { GameMode } from '../features/quiz-engine/types'
import { periodRange, type LeaderboardPeriod } from '../features/leaderboard/periods'
import { supabase } from './supabaseClient'

/**
 * Leaderboards seit dem Arcade-Umbau (E5): Bestleistung pro Spieler,
 * Rohpunkte, Zeitfilter — geliefert von den RPCs aus Migration 0005.
 *
 * Seit Migration 0016 sind die Zeiträume Kalenderperioden (Europe/Berlin,
 * deckungsgleich mit den Pokal-Perioden) und blätterbar — die Grenzen rechnet
 * `features/leaderboard/periods.ts`, der Server bekommt nur `p_since`/`p_until`
 * (DESIGN-LEADERBOARD-PERIODS.md).
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

export type { LeaderboardPeriod }

/**
 * Ruft eine Leaderboard-RPC auf und fällt zurück, falls `p_until` (0016) auf
 * der DB noch fehlt (PostgREST: PGRST202 „no function matches"). Ohne obere
 * Grenze stimmt die laufende Periode weiterhin — geblättert wird ohnehin erst,
 * wenn `fetchLeaderboardFirstPlayed` eine Untergrenze liefert.
 */
async function rpcWithPeriod<T>(
  fn: 'get_leaderboard_scores' | 'get_leaderboard_cups',
  args: Record<string, unknown>,
): Promise<T | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc(fn, args)
  if (!error) return data as T
  if (error.code !== 'PGRST202') return null
  const { p_until: _until, ...legacy } = args
  const retry = await supabase.rpc(fn, legacy)
  return retry.error ? null : (retry.data as T)
}

export async function fetchLeaderboardScores(
  mode: GameMode,
  period: LeaderboardPeriod = 'all',
  /** 0 = laufende Periode, 1 = die davor (◀). */
  periodOffset = 0,
  limit = 25,
  /** Gruppen-ID für Freundesgruppen-Ansicht; null = global (Phase F). */
  groupId: number | null = null,
): Promise<LeaderboardScore[] | null> {
  const { since, until } = periodRange(period, periodOffset)
  return rpcWithPeriod<LeaderboardScore[]>('get_leaderboard_scores', {
    p_mode: mode,
    p_since: since,
    p_until: until,
    p_limit: limit,
    p_group: groupId,
  })
}

export async function fetchLeaderboardCups(
  period: LeaderboardPeriod = 'all',
  periodOffset = 0,
  limit = 25,
  groupId: number | null = null,
): Promise<LeaderboardCup[] | null> {
  const { since, until } = periodRange(period, periodOffset)
  return rpcWithPeriod<LeaderboardCup[]>('get_leaderboard_cups', {
    p_since: since,
    p_until: until,
    p_limit: limit,
    p_group: groupId,
  })
}

/**
 * Frühester Eintrag der gewählten Liste (Modus `null` = Cup-Läufe) — die
 * Untergrenze fürs ◀-Blättern. `null` = keine Daten, offline oder Migration
 * 0016 fehlt noch; dann bleibt nur die laufende Periode.
 */
export async function fetchLeaderboardFirstPlayed(
  mode: GameMode | null,
  groupId: number | null = null,
): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_leaderboard_first_played', {
    p_mode: mode,
    p_group: groupId,
  })
  if (error || typeof data !== 'string') return null
  return data
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
