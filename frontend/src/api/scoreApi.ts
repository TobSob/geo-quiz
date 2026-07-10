import type { SessionSummary } from '../features/quiz-engine/types'
import { supabase } from './supabaseClient'

/**
 * Global leaderboards are registered-accounts-only (enforced server-side via
 * RLS too) — guests get null here and their scores stay local.
 */
async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user || user.is_anonymous) return null
  return user.id
}

/** Fire-and-forget score submit; false on any failure (guest, offline etc.). */
export async function submitScore(
  summary: SessionSummary,
  cupRunId?: number,
): Promise<boolean> {
  if (!supabase || summary.mode === 'training') return false
  const userId = await currentUserId()
  if (!userId) return false
  const { error } = await supabase.from('score_entries').insert({
    user_id: userId,
    mode: summary.mode,
    score: summary.score,
    max_possible: summary.maxPossible,
    question_count: summary.questionCount,
    duration_ms: Math.max(1, Math.round(summary.durationMs)),
    cup_run_id: cupRunId ?? null,
  })
  return !error
}

/** Stores the cup run, then its legs referencing it. */
export async function submitCupRun(
  totalScore: number,
  legs: SessionSummary[],
): Promise<boolean> {
  if (!supabase) return false
  const userId = await currentUserId()
  if (!userId) return false
  const { data, error } = await supabase
    .from('cup_runs')
    .insert({
      user_id: userId,
      total_score: totalScore,
      modes_played: legs.map((l) => l.mode),
    })
    .select('id')
    .single()
  if (error || !data) return false
  const results = await Promise.all(
    legs.map((leg) => submitScore(leg, data.id as number)),
  )
  return results.every(Boolean)
}
