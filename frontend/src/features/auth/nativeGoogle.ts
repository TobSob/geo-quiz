import { registerPlugin } from '@capacitor/core'

/**
 * Native Google-Anmeldung in der Android-App (DESIGN-GOOGLE-NATIVE.md):
 * Credential Manager liefert ein ID-Token, Supabase löst es per
 * `signInWithIdToken` / `linkIdentity` ein. Ersetzt für Google den Umweg
 * über Custom Tab + URL-Schema (DESIGN-OAUTH-ANDROID.md), der eine
 * Supabase-Adresse zeigte und bei bestehendem Konto einen zweiten Tipp
 * brauchte.
 */

interface GoogleSignInPlugin {
  signIn(options: { serverClientId: string; nonce: string }): Promise<{ idToken: string }>
}

const GoogleSignIn = registerPlugin<GoogleSignInPlugin>('GoogleSignIn')

/**
 * Web-Client-ID aus der Google Cloud Console — dieselbe, die im
 * Supabase-Dashboard beim Google-Provider steht. Öffentlich, kein Secret: Sie
 * landet als `aud` im ID-Token, und Supabase akzeptiert nur Tokens für diese
 * ID. Fehlt sie, bleibt die App beim Custom-Tab-Weg.
 */
export const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) || null

export type NativeGoogleResult =
  | { kind: 'token'; idToken: string; rawNonce: string }
  /** Nutzer hat die Kontoauswahl geschlossen — kein Fallback. */
  | { kind: 'canceled' }
  /** Nicht konfiguriert / Gerät ohne Play-Dienste o. ä. — Browser-Weg nehmen. */
  | { kind: 'unavailable'; reason: string }

/**
 * Plugin-Fehler einordnen. Nur ein echter Abbruch ist endgültig; alles andere
 * (falscher SHA-1 in der Console, keine Play-Dienste, Netz) soll auf den
 * alten Weg ausweichen, statt den Login ganz zu sperren.
 */
export function classifyNativeGoogleError(error: unknown): NativeGoogleResult {
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'canceled') return { kind: 'canceled' }
  const message = (error as { message?: unknown } | null)?.message
  return { kind: 'unavailable', reason: typeof message === 'string' ? message : String(error) }
}

export function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Nonce-Paar: Google bekommt den SHA-256-Hash und schreibt ihn ins Token,
 * Supabase bekommt den Rohwert und vergleicht dessen Hash. So kann ein
 * abgefangenes Token nicht bei einer zweiten Anmeldung wiederverwendet werden.
 */
async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const hashed = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))
  return { raw, hashed }
}

export async function requestGoogleIdToken(): Promise<NativeGoogleResult> {
  if (!GOOGLE_WEB_CLIENT_ID) return { kind: 'unavailable', reason: 'no client id' }
  try {
    const nonce = await createNonce()
    const { idToken } = await GoogleSignIn.signIn({
      serverClientId: GOOGLE_WEB_CLIENT_ID,
      nonce: nonce.hashed,
    })
    return { kind: 'token', idToken, rawNonce: nonce.raw }
  } catch (error) {
    return classifyNativeGoogleError(error)
  }
}
