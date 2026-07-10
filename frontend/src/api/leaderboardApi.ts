import type { GameMode } from '../features/quiz-engine/types'
import { supabase } from './supabaseClient'

export interface LeaderboardScore {
  display_name: string
  mode: GameMode
  score: number
  max_possible: number
  percent: number
  question_count: number
  played_at: string
}

export interface LeaderboardCup {
  display_name: string
  total_score: number
  modes_played: string[]
  played_at: string
}

export async function fetchLeaderboardScores(
  mode?: GameMode,
  limit = 25,
): Promise<LeaderboardScore[] | null> {
  if (!supabase) return null
  let query = supabase.from('leaderboard_scores').select('*').limit(limit)
  if (mode) query = query.eq('mode', mode)
  const { data, error } = await query
  if (error) return null
  return data as LeaderboardScore[]
}

export async function fetchLeaderboardCups(
  limit = 25,
): Promise<LeaderboardCup[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('leaderboard_cups')
    .select('*')
    .limit(limit)
  if (error) return null
  return data as LeaderboardCup[]
}
