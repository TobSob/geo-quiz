import { supabase } from './supabaseClient'

/** Gründe wie im Check von `name_reports.reason` (Migration 0018). */
export const REPORT_REASONS = [
  { id: 'insult', label: 'Beleidigend' },
  { id: 'sexual', label: 'Sexuell / anstößig' },
  { id: 'extremist', label: 'Extremistisch' },
  { id: 'other', label: 'Sonstiges' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['id']

/**
 * Meldet einen Spielernamen (DESIGN-MODERATION.md). Der Server antwortet mit
 * einem Status-Text statt einer Exception; „duplicate" ist für den Spieler
 * dasselbe wie „ok" — er hat es ja schon gemeldet.
 */
export async function reportDisplayName(
  displayName: string,
  reason: ReportReason,
): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Offline — Melden geht gerade nicht.' }
  const { data, error } = await supabase.rpc('report_display_name', {
    p_display_name: displayName,
    p_reason: reason,
  })
  if (error) {
    // PGRST202: Migration 0018 noch nicht eingespielt.
    if (error.code === 'PGRST202') {
      return { ok: false, message: 'Melden ist auf diesem Server noch nicht freigeschaltet.' }
    }
    return { ok: false, message: 'Melden hat nicht geklappt — bitte später erneut versuchen.' }
  }
  switch (data) {
    case 'ok':
    case 'duplicate':
      return { ok: true, message: 'Danke! Der Name wird geprüft.' }
    case 'self':
      return { ok: false, message: 'Den eigenen Namen kannst du im Profil ändern.' }
    case 'rate_limited':
      return { ok: false, message: 'Du hast heute schon viele Namen gemeldet — bitte morgen weiter.' }
    case 'not_found':
      return { ok: false, message: 'Diesen Namen gibt es nicht mehr.' }
    default:
      return { ok: false, message: 'Melden hat nicht geklappt — bitte später erneut versuchen.' }
  }
}
