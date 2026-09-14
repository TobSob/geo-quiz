/**
 * Reine Parsing-Logik für OAuth-Redirects (Phase J, DESIGN-AUTH.md) — bewusst
 * ohne Supabase-Import, damit sie ohne Seiteneffekte (echter Client, DOM)
 * testbar bleibt. `authApi.ts` nutzt das für resolveOAuthRedirectError().
 */

export interface OAuthRedirectOutcome {
  /** true, wenn der Redirect überhaupt einen OAuth-Fehler enthielt. */
  hasError: boolean
  errorCode: string | null
  errorDescription: string | null
}

/**
 * Fehler beim Verknüpfen, nach denen statt einer Meldung die normale
 * Anmeldung mit demselben Provider folgt (Zweitgerät-Fall).
 *
 * - `identity_already_exists`: dieses Google/GitHub-Konto hängt schon an einem
 *   anderen Spieler.
 * - `email_exists` / `user_already_exists`: ein Spieler mit **derselben
 *   E-Mail** existiert, etwa per E-Mail/Passwort angelegt. Die Anmeldung
 *   verknüpft das Provider-Konto dann über die bestätigte E-Mail mit ihm.
 *   Gerätetest 2026-09-14: vorher endete das in „Für diese E-Mail existiert
 *   bereits ein Account", im Web wie in der App (DESIGN-OAUTH-ANDROID.md §5).
 */
export function shouldSignInInsteadOfLinking(errorCode: string | null): boolean {
  return (
    errorCode === 'identity_already_exists' ||
    errorCode === 'email_exists' ||
    errorCode === 'user_already_exists'
  )
}

/**
 * GoTrue hängt Fehler mal als Hash-, mal als Query-Parameter an den
 * Redirect — beide werden gleichermaßen geprüft.
 */
export function parseOAuthRedirectError(hash: string, search: string): OAuthRedirectOutcome {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(search.replace(/^\?/, ''))
  const errorCode = hashParams.get('error_code') ?? searchParams.get('error_code')
  const errorDescription =
    hashParams.get('error_description') ?? searchParams.get('error_description')
  const hasError = errorCode !== null || hashParams.has('error') || searchParams.has('error')
  return { hasError, errorCode, errorDescription }
}
