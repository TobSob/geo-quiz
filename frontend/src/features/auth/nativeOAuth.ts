import { parseOAuthRedirectError, type OAuthRedirectOutcome } from './oauthRedirect'

/**
 * Rücksprung aus Google/GitHub in die Android-App (DESIGN-OAUTH-ANDROID.md) —
 * reine Parsing-Logik ohne Capacitor- und Supabase-Import, testbar wie
 * `oauthRedirect.ts`.
 *
 * Supabase schickt nach der Anmeldung an dieses Schema zurück; das Manifest
 * leitet es an die laufende App-Instanz (`appUrlOpen`). Mit PKCE trägt der
 * Rücksprung nur einen Einmal-Code, keine Tokens.
 */

export const NATIVE_OAUTH_SCHEME = 'de.tobsob.geoquizarcade'
export const NATIVE_OAUTH_HOST = 'auth-callback'
export const NATIVE_OAUTH_REDIRECT = `${NATIVE_OAUTH_SCHEME}://${NATIVE_OAUTH_HOST}`

export type NativeOAuthCallback =
  | { kind: 'code'; code: string }
  | { kind: 'error'; outcome: OAuthRedirectOutcome }

/**
 * `null`, wenn die URL gar nicht unser Callback ist — andere Deep-Links
 * (künftig vielleicht) sollen hier nicht als Login-Fehler enden.
 */
export function parseNativeOAuthCallback(url: string): NativeOAuthCallback | null {
  const prefix = `${NATIVE_OAUTH_REDIRECT}`
  if (!url.startsWith(prefix)) return null
  const rest = url.slice(prefix.length)
  // Nur „…://auth-callback", „…/", „?…" oder „#…" — nicht „…://auth-callbackX".
  if (rest !== '' && !/^[/?#]/.test(rest)) return null

  const hashIndex = rest.indexOf('#')
  const beforeHash = hashIndex === -1 ? rest : rest.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : rest.slice(hashIndex)
  const queryIndex = beforeHash.indexOf('?')
  const search = queryIndex === -1 ? '' : beforeHash.slice(queryIndex)

  const outcome = parseOAuthRedirectError(hash, search)
  if (outcome.hasError) return { kind: 'error', outcome }

  const code = new URLSearchParams(search.replace(/^\?/, '')).get('code')
  if (code) return { kind: 'code', code }

  // Weder Code noch Fehler: ohne Code gibt es nichts einzulösen — als Fehler
  // melden statt still nichts zu tun.
  return {
    kind: 'error',
    outcome: { hasError: true, errorCode: 'missing_code', errorDescription: null },
  }
}
