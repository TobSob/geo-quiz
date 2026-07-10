import { supabase } from '../../api/supabaseClient'
import { useProgressStore, type PendingDelta } from '../../state/progressStore'

let flushing = false

/**
 * Push all pending progress deltas to Supabase via the sync_progress RPC.
 * Snapshot-based: answers recorded while the flush is in flight stay queued.
 * Safe to call any time — no-ops when offline, unauthenticated, or empty.
 */
export async function flushProgress(): Promise<boolean> {
  if (!supabase || flushing) return false
  const snapshot: Record<string, PendingDelta> = {
    ...useProgressStore.getState().pending,
  }
  const entries = Object.entries(snapshot)
  if (entries.length === 0) return true

  flushing = true
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return false
    const payload = entries.map(([questionId, d]) => ({
      question_id: questionId,
      shown: d.shown,
      wrong: d.wrong,
      correct: d.correct,
    }))
    const { error } = await supabase.rpc('sync_progress', { p_deltas: payload })
    if (error) return false
    useProgressStore.getState().consumePending(snapshot)
    return true
  } catch {
    return false
  } finally {
    flushing = false
  }
}
