import { supabase } from './supabaseClient'

/** Freundesgruppen (Phase F) — alles läuft über die RPCs aus Migration 0006. */

export interface FriendGroup {
  group_id: number
  name: string
  code: string
  member_count: number
  is_owner: boolean
}

export interface GroupActionResult {
  ok: boolean
  /** User-facing message (German). */
  message: string
  group?: { group_id: number; name: string; code?: string }
}

/** RPC-Exceptions (englische `raise exception`-Texte) → deutsche UI-Meldungen. */
function translateGroupError(message: string): string {
  const known: [RegExp, string][] = [
    [/registered account required/i, 'Freundesgruppen gibt es nur mit Account — sichere kurz deinen Account im Profil.'],
    [/invalid group name/i, 'Der Gruppenname braucht 2–24 Zeichen.'],
    [/too many groups/i, 'Du bist schon in der Maximalzahl an Gruppen (12) — verlasse erst eine.'],
    [/too many join attempts/i, 'Zu viele Beitrittsversuche — bitte eine Stunde warten.'],
    [/group not found/i, 'Keine Gruppe mit diesem Code gefunden — Tippfehler?'],
    [/group full/i, 'Diese Gruppe ist voll (max. 50 Mitglieder).'],
    [/only the creator/i, 'Nur wer die Gruppe erstellt hat, kann sie löschen.'],
    [/network/i, 'Keine Verbindung zum Server — bitte Internetverbindung prüfen.'],
  ]
  for (const [pattern, german] of known) {
    if (pattern.test(message)) return german
  }
  return 'Etwas ist schiefgelaufen — bitte versuche es erneut.'
}

export async function listMyGroups(): Promise<FriendGroup[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('list_my_groups')
  if (error) return null
  return data as FriendGroup[]
}

export async function createGroup(name: string): Promise<GroupActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { data, error } = await supabase.rpc('create_group', { p_name: name })
  if (error) return { ok: false, message: translateGroupError(error.message) }
  const row = (data as { group_id: number; name: string; code: string }[])[0]
  return {
    ok: true,
    message: `Gruppe „${row.name}" erstellt — teile den Code ${row.code} mit deinen Freunden!`,
    group: row,
  }
}

export async function joinGroup(code: string): Promise<GroupActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { data, error } = await supabase.rpc('join_group', { p_code: code })
  if (error) return { ok: false, message: translateGroupError(error.message) }
  const row = (data as { group_id: number; name: string }[])[0]
  return { ok: true, message: `Willkommen in „${row.name}"!`, group: row }
}

export async function leaveGroup(groupId: number): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('leave_group', { p_group: groupId })
  return !error
}

export async function deleteGroup(groupId: number): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('delete_group', { p_group: groupId })
  return !error
}
