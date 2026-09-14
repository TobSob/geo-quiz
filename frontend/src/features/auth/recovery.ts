/**
 * Reine Parsing-Logik für den Passwort-Recovery-Redirect (DESIGN-PASSWORD-RESET.md)
 * — bewusst ohne Supabase-Import und ohne DOM, damit sie ohne Browser testbar
 * bleibt, genau wie `oauthRedirect.ts`.
 *
 * Der Client läuft im **Implicit Flow** (supabase-js-Default, in
 * `supabaseClient.ts` nicht überschrieben). GoTrue hängt die Tokens deshalb
 * als Hash-Fragment an:
 *
 *   https://…/#access_token=…&refresh_token=…&type=recovery
 *
 * Abgelaufene oder schon benutzte Links kommen stattdessen als Fehler zurück
 * (`error_code=otp_expired`); die fängt `resolveOAuthRedirectError()` ab.
 */

/**
 * Erkennt einen Recovery-Rücksprung. Prüft Hash **und** Query, weil GoTrue
 * seine Parameter je nach Flow an unterschiedlichen Stellen anhängt — dieselbe
 * Doppelprüfung wie bei den OAuth-Fehlern.
 *
 * Liest ausdrücklich **nur** `type=recovery` und nicht die Tokens: Die Tokens
 * verarbeitet supabase-js selbst über `detectSessionInUrl`. Würden wir sie hier
 * auch anfassen, gäbe es zwei Stellen, die denselben Einmal-Token einlösen.
 */
export function isRecoveryRedirect(hash: string, search: string): boolean {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(search.replace(/^\?/, ''))
  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
}

/** Mindestlänge, die Supabase serverseitig erzwingt. */
export const MIN_PASSWORD_LENGTH = 6

export type PasswordProblem = 'too-short' | 'mismatch' | null

/**
 * Prüft das Paar aus neuem Passwort und Wiederholung, bevor ein Request
 * rausgeht. Die Wiederholung gibt es, weil ein Tippfehler hier besonders teuer
 * wäre: Das alte Passwort ist nach dem Setzen weg, und der Nutzer merkt den
 * Fehler erst beim nächsten Anmelden — dann braucht er einen zweiten
 * Reset-Link.
 */
export function validateNewPassword(password: string, repeat: string): PasswordProblem {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too-short'
  if (password !== repeat) return 'mismatch'
  return null
}

export function passwordProblemMessage(problem: PasswordProblem): string | null {
  switch (problem) {
    case 'too-short':
      return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`
    case 'mismatch':
      return 'Die beiden Passwörter stimmen nicht überein.'
    default:
      return null
  }
}
