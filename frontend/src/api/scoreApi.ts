import type { SessionSummary } from '../features/quiz-engine/types'
import {
  mergeUnlockPayloads,
  parseUnlockPayload,
  type UnlockPayload,
} from './gamificationApi'
import { supabase } from './supabaseClient'

/**
 * Score-Abgabe seit Migration 0007 (Anti-Cheat D1): Alles läuft über RPCs.
 * Der Client meldet den Rundenstart (startPlaySession), der Server prüft bei
 * der Abgabe, ob die behauptete Spielzeit real vergangen ist. Direkte
 * Tabellen-Inserts sind Clients nicht mehr erlaubt.
 */

/**
 * Rundenstart serverseitig verankern — fire-and-forget beim Beginn einer
 * Einzelrunde bzw. eines Cups. Ohne diesen Anker lehnt der Server die
 * spätere Abgabe ab.
 */
export async function startPlaySession(): Promise<void> {
  if (!supabase) return
  try {
    await supabase.rpc('start_session')
  } catch {
    // offline o. ä. — die Abgabe scheitert dann eben serverseitig
  }
}

/**
 * Global leaderboards are registered-accounts-only (enforced server-side via
 * the RPCs too) — guests get null here and their scores stay local.
 */
async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user || user.is_anonymous) return null
  return user.id
}

/**
 * Score submit; seit Phase G liefert der Server eine Unlock-Payload
 * (XP + neue Abzeichen) zurück — null bei jedem Fehlschlag (Gast, offline).
 */
export async function submitScore(
  summary: SessionSummary,
  cupRunId?: number,
): Promise<UnlockPayload | null> {
  if (!supabase || summary.mode === 'training') return null
  const userId = await currentUserId()
  if (!userId) return null
  const { data, error } = await supabase.rpc('submit_score', {
    p_mode: summary.mode,
    p_score: summary.score,
    p_max_possible: summary.maxPossible,
    p_question_count: summary.questionCount,
    p_duration_ms: Math.max(1, Math.round(summary.durationMs)),
    p_cup_run_id: cupRunId ?? null,
    p_correct_count: summary.correctCount,
    p_best_streak: summary.bestStreak,
    p_volltreffer: summary.volltrefferCount ?? 0,
  })
  if (error) return null
  return parseUnlockPayload(data)
}

/**
 * Stores the cup run, then its legs referencing it. Die Unlock-Payloads von
 * Run + Legs werden für die Anzeige zu einer Summe gebündelt.
 */
export async function submitCupRun(
  totalScore: number,
  legs: SessionSummary[],
): Promise<UnlockPayload | null> {
  if (!supabase) return null
  const userId = await currentUserId()
  if (!userId) return null
  const { data, error } = await supabase.rpc('submit_cup_run', {
    p_total: totalScore,
    p_modes: legs.map((l) => l.mode),
  })
  if (error || data === null) return null
  const runUnlock = parseUnlockPayload(data)
  const cupRunId = (data as { cup_run_id?: number }).cup_run_id
  if (typeof cupRunId !== 'number') return runUnlock
  const legUnlocks = await Promise.all(
    legs.map((leg) => submitScore(leg, cupRunId)),
  )
  return mergeUnlockPayloads([runUnlock, ...legUnlocks])
}
