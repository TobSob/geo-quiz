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
