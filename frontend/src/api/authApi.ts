import { supabase } from './supabaseClient'

const ADJECTIVES = [
  'PIXEL', 'NEON', 'TURBO', 'RETRO', 'HYPER', 'MEGA', 'ULTRA', 'CYBER',
  'ATOMIC', 'COSMIC', 'BLAZE', 'SHADOW',
]
const ANIMALS = [
  'FOX', 'WOLF', 'HAWK', 'TIGER', 'PANDA', 'OTTER', 'RAVEN', 'COBRA',
  'LYNX', 'ORCA', 'YETI', 'DINGO',
]

export function generateRetroName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const n = Math.floor(Math.random() * 90) + 10
  return `${a}_${b}_${n}`
}

export interface AuthInfo {
  userId: string
  displayName: string
  isAnonymous: boolean
  email: string | null
}

/**
 * First launch: anonymous sign-in + profile row. Subsequent launches reuse
 * the persisted session. Returns null when Supabase isn't configured or the
 * network is down — the game keeps working offline.
 */
export async function ensureSession(): Promise<AuthInfo | null> {
  if (!supabase) return null
  try {
    let { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.session) return null
      sessionData = { session: data.session }
    }
    const user = sessionData.session.user
    const userId = user.id
    const isAnonymous = user.is_anonymous ?? false
    const email = user.email ?? null

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      // touch last_seen_at, ignore failures
      void supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {})
      return { userId, displayName: profile.display_name, isAnonymous, email }
    }

    const displayName = generateRetroName()
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, display_name: displayName })
    if (insertError) return { userId, displayName: 'PLAYER', isAnonymous, email }
    return { userId, displayName, isAnonymous, email }
  } catch {
    return null
  }
}

export interface AuthActionResult {
  ok: boolean
  /** User-facing message (German), e.g. confirmation-mail hint or error. */
  message: string
}

/**
 * Supabase/GoTrue error messages come back in English regardless of app
 * locale. Map the common ones to German; unknown ones get a generic
 * German fallback instead of leaking English text into the UI.
 */
function translateAuthError(message: string): string {
  const known: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-Mail oder Passwort ist falsch.'],
    [/user already registered|already been registered/i, 'Für diese E-Mail existiert bereits ein Account.'],
    [/password should be at least/i, 'Das Passwort muss mindestens 6 Zeichen haben.'],
    [/email rate limit exceeded/i, 'Zu viele Versuche — bitte kurz warten und erneut probieren.'],
    [/unable to validate email address/i, 'Das ist keine gültige E-Mail-Adresse.'],
    [/email not confirmed/i, 'E-Mail noch nicht bestätigt — bitte den Link in deinem Postfach anklicken.'],
    [/network/i, 'Keine Verbindung zum Server — bitte Internetverbindung prüfen.'],
  ]
  for (const [pattern, german] of known) {
    if (pattern.test(message)) return german
  }
  return 'Etwas ist schiefgelaufen — bitte versuche es erneut.'
}

/**
 * Converts the current anonymous user into a permanent account
 * (Supabase native: updateUser with email+password keeps the same user id,
 * so all progress and scores stay attached). With email confirmations
 * enabled, the address only becomes active after the confirmation click.
 */
export async function upgradeToAccount(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { data, error } = await supabase.auth.updateUser({ email, password })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  const pendingConfirmation = !data.user.email_confirmed_at
  return {
    ok: true,
    message: pendingConfirmation
      ? 'Fast geschafft! Bestätige den Link in deiner E-Mail, dann ist der Account dauerhaft.'
      : 'Account erstellt — dein Fortschritt ist jetzt dauerhaft gesichert.',
  }
}

/** Sign in with an existing account (e.g. on a second device). */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  return { ok: true, message: 'Angemeldet!' }
}

/** Sign out; the next launch starts a fresh anonymous session. */
export async function signOutUser(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function updateDisplayName(name: string): Promise<boolean> {
  if (!supabase) return false
  const trimmed = name.trim().slice(0, 24)
  if (trimmed.length < 2) return false
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) return false
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId)
  return !error
}
