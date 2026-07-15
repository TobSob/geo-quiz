import { supabase } from './supabaseClient'

/**
 * Avatar-Server-Sync (Feature-Idee R3). Der gewählte Avatar liegt am eigenen
 * Profil, damit die Bestenliste die Avatare aller Spieler zeigen kann.
 *
 * Alles ist graceful: solange Migration 0010 nicht eingespielt ist (Spalte
 * `avatar_id` / RPC `get_profile_avatars` fehlen), scheitern die Aufrufe
 * still und die App läuft wie bisher — nur ohne fremde Avatare.
 */

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Speichert den gewählten Avatar am eigenen Profil. */
export async function syncAvatarToServer(avatarId: string): Promise<void> {
  if (!supabase) return
  const userId = await currentUserId()
  if (!userId) return
  await supabase.from('profiles').update({ avatar_id: avatarId }).eq('id', userId)
}

/** Serverseitig gespeicherter Avatar des eigenen Accounts (null = keiner/Spalte fehlt). */
export async function fetchMyAvatar(): Promise<string | null> {
  if (!supabase) return null
  const userId = await currentUserId()
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_id')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return (data.avatar_id as string | null) ?? null
}

/**
 * Gleicht den lokalen Avatar mit dem Server ab: hat der Account schon einen,
 * gewinnt er (folgt übers Gerät); sonst wird der lokale hochgeladen.
 * Rückgabe = serverseitiger Avatar, falls vorhanden.
 */
export async function reconcileAvatar(localId: string): Promise<string | null> {
  const server = await fetchMyAvatar()
  if (server) return server
  await syncAvatarToServer(localId)
  return null
}

/** Avatar-Zuordnung (Anzeigename → Avatar-ID) für eine Bestenlisten-Seite. */
export async function fetchAvatars(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!supabase || names.length === 0) return map
  const { data, error } = await supabase.rpc('get_profile_avatars', { p_names: names })
  if (error || !data) return map
  for (const row of data as { display_name: string; avatar_id: string | null }[]) {
    if (row.avatar_id) map.set(row.display_name, row.avatar_id)
  }
  return map
}
