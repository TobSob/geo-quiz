import { Capacitor } from '@capacitor/core'
import { supabase } from './supabaseClient'
import {
  parseOAuthRedirectError,
  type OAuthRedirectOutcome,
} from '../features/auth/oauthRedirect'
import { isRecoveryRedirect } from '../features/auth/recovery'
import {
  emailLinkSuccessMessage,
  parseEmailLink,
  type EmailLink,
} from '../features/auth/emailLink'

export { parseOAuthRedirectError }
export type { OAuthRedirectOutcome }

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
    // Ein Link aus einer Auth-Mail muss VOR getSession() eingelöst sein —
    // sonst legt die App erst einen neuen Gast an und verliert ihn Sekunden
    // später wieder an die bestätigte Sitzung.
    await verifyPendingEmailLink()
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
    [/provider is not enabled|unsupported provider/i, 'Diese Anmeldung ist serverseitig noch nicht freigeschaltet.'],
    [/manual linking is disabled/i, 'Konto-Verknüpfung ist serverseitig deaktiviert.'],
    [/identity is already linked/i, 'Dieses Konto ist bereits mit einem anderen Spieler verknüpft.'],
    [/otp_expired|invalid or has expired|token has expired/i, 'Der Link ist abgelaufen oder wurde schon benutzt — fordere einen neuen an.'],
    [/new password should be different/i, 'Das neue Passwort muss sich vom alten unterscheiden.'],
    [/auth session missing|session_not_found/i, 'Die Sitzung ist abgelaufen — fordere den Link bitte neu an.'],
    [/for security purposes|only request this after/i, 'Zu schnell hintereinander — bitte einen Moment warten.'],
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

export type OAuthProvider = 'google' | 'github'

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
}

/**
 * OAuth-Rücksprungziel (Phase J, DESIGN-AUTH.md): die App-Root ohne Hash —
 * supabase-js (detectSessionInUrl) liest das Token-Fragment nach dem
 * Provider-Roundtrip und räumt die URL auf, bevor der HashRouter greift.
 */
function oauthRedirectTo(): string {
  return window.location.origin + window.location.pathname
}

/**
 * Gast → Account per Google/GitHub: linkIdentity verknüpft die OAuth-Identität
 * mit der BESTEHENDEN (anonymen) User-ID — Fortschritt und Retro-Name bleiben,
 * wie beim E-Mail-Upgrade. Bei Erfolg verlässt der Browser die App Richtung
 * Provider; zurück kommt er auf der App-Root mit fertiger Session.
 * Voraussetzung: Provider im Supabase-Dashboard aktiviert + „Allow manual
 * linking" eingeschaltet.
 */
export async function linkProvider(provider: OAuthProvider): Promise<AuthActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: oauthRedirectTo() },
  })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  return { ok: true, message: `Weiter bei ${OAUTH_PROVIDER_LABELS[provider]}…` }
}

/**
 * Anmeldung mit bestehendem Google/GitHub-Account (z. B. Zweitgerät) —
 * ersetzt die anonyme Session, wie signInWithEmail.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
): Promise<AuthActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: oauthRedirectTo() },
  })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  return { ok: true, message: `Weiter bei ${OAUTH_PROVIDER_LABELS[provider]}…` }
}

const PENDING_PROVIDER_KEY = 'geoquiz-oauth-pending-provider'
const OAUTH_MESSAGE_KEY = 'geoquiz-oauth-message'

/**
 * Einziger OAuth-Button für Gäste (Nutzer-Entscheid 2026-07-18: EIN „Mit
 * Google/GitHub" statt getrennter Sichern-/Anmelden-Varianten). Versucht
 * immer zuerst linkIdentity (Fortschritt bleibt erhalten, falls die Identität
 * neu ist); merkt sich den Provider, damit resolveOAuthRedirectError() nach
 * dem Rücksprung weiß, mit wem es bei einem Konflikt weitermachen soll.
 */
export async function continueWithProvider(
  provider: OAuthProvider,
): Promise<AuthActionResult> {
  sessionStorage.setItem(PENDING_PROVIDER_KEY, provider)
  const result = await linkProvider(provider)
  if (!result.ok) sessionStorage.removeItem(PENDING_PROVIDER_KEY)
  return result
}

/**
 * Räumt einen OAuth-Fehler-Redirect auf, BEVOR der HashRouter mountet — sonst
 * interpretiert er z. B. „#error=identity_already_exists&…" als ungültigen
 * Routen-Pfad (leere Seite). Muss synchron vor dem ersten Render laufen
 * (main.tsx). Erfolgs-Redirects (Token/Code) bleiben unangetastet, die
 * verarbeitet supabase-js selbst über detectSessionInUrl.
 *
 * identity_already_exists: das gewählte Google/GitHub-Konto gehört schon
 * einem ANDEREN Spieler (typischer Fall: neues Gerät, Nutzer hat den Account
 * hier schon mal über den Anmelden-Button verknüpft). Statt einer Fehlermeldung
 * folgt automatisch ein normaler Zweitgerät-Login mit demselben Provider —
 * vom Umweg merkt der Nutzer nichts außer einem zweiten kurzen Redirect.
 */
export function resolveOAuthRedirectError(): void {
  if (typeof window === 'undefined') return
  const outcome = parseOAuthRedirectError(window.location.hash, window.location.search)
  if (!outcome.hasError) return

  const pendingProvider = sessionStorage.getItem(PENDING_PROVIDER_KEY) as OAuthProvider | null
  sessionStorage.removeItem(PENDING_PROVIDER_KEY)
  window.history.replaceState(null, '', window.location.pathname + '#/profile')

  if (outcome.errorCode === 'identity_already_exists' && pendingProvider) {
    void signInWithProvider(pendingProvider)
  } else {
    sessionStorage.setItem(
      OAUTH_MESSAGE_KEY,
      translateAuthError(outcome.errorDescription ?? outcome.errorCode ?? 'oauth error'),
    )
  }
}

/** Einmalige Meldung aus einem vorherigen OAuth-Redirect abholen (LoginPanel). */
export function consumePendingOAuthMessage(): string | null {
  const msg = sessionStorage.getItem(OAUTH_MESSAGE_KEY)
  if (msg) sessionStorage.removeItem(OAUTH_MESSAGE_KEY)
  return msg
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

const RECOVERY_KEY = 'geoquiz-password-recovery'

/**
 * Zieladresse des Reset-Links (DESIGN-PASSWORD-RESET.md).
 *
 * In der Android-App ist `window.location.origin` Capacitors eigener Origin
 * (`https://localhost`) — ein Link dorthin wäre für den System-Browser, der die
 * Mail öffnet, wertlos. Deshalb zeigt der Reset-Link aus der App immer auf die
 * öffentliche Web-Adresse: Das Passwort wird im Browser neu gesetzt, danach
 * meldet man sich in der App damit an.
 */
const PUBLIC_SITE_URL =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ??
  'https://geoquiz.tobsob.dev'

function passwordResetRedirectTo(): string {
  return Capacitor.isNativePlatform() ? PUBLIC_SITE_URL : oauthRedirectTo()
}

/**
 * Reset-Mail anfordern. Die Rückmeldung ist bewusst **unabhängig davon, ob es
 * das Konto gibt** — sonst wäre das Formular ein Verzeichnis dafür, welche
 * E-Mail-Adressen hier registriert sind.
 */
export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: passwordResetRedirectTo(),
  })
  // Rate-Limits und Netzfehler zeigen wir an; ein „unbekannte Adresse" gibt
  // Supabase hier ohnehin nicht zurück.
  if (error) return { ok: false, message: translateAuthError(error.message) }
  // In der App endet der Link im System-Browser (siehe passwordResetRedirectTo)
  // — ohne diesen Hinweis wartet man in der App darauf, dass dort etwas
  // passiert, und die Sitzung wechselt ja bewusst nicht mit.
  return {
    ok: true,
    message: Capacitor.isNativePlatform()
      ? 'Wenn es zu dieser Adresse ein Konto gibt, ist die Mail unterwegs. Der Link öffnet sich im Browser — setz dort dein neues Passwort und melde dich danach hier damit an.'
      : 'Wenn es zu dieser Adresse ein Konto gibt, ist die Mail unterwegs. Der Link ist nur kurze Zeit gültig.',
  }
}

/**
 * Neues Passwort setzen. Läuft auf der Sitzung, die der Recovery-Link erzeugt
 * hat — deshalb ist hier kein altes Passwort nötig und auch keins verfügbar.
 */
export async function setNewPassword(password: string): Promise<AuthActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  return { ok: true, message: 'Passwort geändert — du bist angemeldet.' }
}

/**
 * Merkt sich synchron, dass dieser Seitenaufruf ein Recovery-Rücksprung war —
 * **vor** dem ersten Render, aus demselben Grund wie
 * `resolveOAuthRedirectError()`: Der HashRouter (bzw. seine Catch-all-Route)
 * schreibt den Hash gleich auf `#/profile` um, und danach wäre `type=recovery`
 * nicht mehr zu sehen.
 *
 * Die Tokens bleiben unangetastet — die löst supabase-js über
 * `detectSessionInUrl` ein. Hier wird nur die Absicht festgehalten.
 */
export function captureRecoveryRedirect(): void {
  if (typeof window === 'undefined') return
  if (isRecoveryRedirect(window.location.hash, window.location.search)) {
    sessionStorage.setItem(RECOVERY_KEY, '1')
  }
}

/**
 * Link aus einer Auth-Mail (DESIGN-MAIL-DOMAIN.md), synchron vor dem ersten
 * Render festgehalten (main.tsx). Bewusst nur im Speicher: Ein Reload soll den
 * Einmal-Token nicht ein zweites Mal einlösen — das scheitert sicher und
 * meldet dann „abgelaufen", obwohl es gerade geklappt hat.
 */
let pendingEmailLink: EmailLink | null = null
let emailLinkVerification: Promise<void> | null = null

const EMAIL_LINK_MESSAGE_KEY = 'geoquiz-email-link-message'

/**
 * Muss nach `captureRecoveryRedirect()` laufen — das liest `type=recovery`
 * aus derselben Query, die hier entfernt wird.
 */
export function captureEmailLink(): void {
  if (typeof window === 'undefined') return
  const link = parseEmailLink(window.location.search)
  if (!link) return
  pendingEmailLink = link
  // Token sofort aus Adressleiste und Verlauf: Ein geteilter Screenshot oder
  // eine kopierte URL wäre sonst eine weitergegebene Anmeldung.
  window.history.replaceState(null, '', window.location.pathname + '#/profile')
}

/**
 * Löst den festgehaltenen Link genau einmal ein, auch wenn `ensureSession()`
 * von mehreren Stellen gleichzeitig läuft. `verifyOtp` mit `type: 'recovery'`
 * feuert `PASSWORD_RECOVERY`, das Passwort-Panel springt also wie gehabt an.
 */
function verifyPendingEmailLink(): Promise<void> {
  if (!emailLinkVerification) {
    emailLinkVerification = (async () => {
      const link = pendingEmailLink
      pendingEmailLink = null
      if (!supabase || !link) return
      const { error } = await supabase.auth.verifyOtp({
        token_hash: link.tokenHash,
        type: link.type,
      })
      const message = error
        ? translateAuthError(error.message)
        : emailLinkSuccessMessage(link.type)
      if (message) sessionStorage.setItem(EMAIL_LINK_MESSAGE_KEY, message)
    })()
  }
  return emailLinkVerification
}

/** Einmalige Rückmeldung zum eingelösten Mail-Link abholen (Profil). */
export function consumeEmailLinkMessage(): string | null {
  const msg = sessionStorage.getItem(EMAIL_LINK_MESSAGE_KEY)
  if (msg) sessionStorage.removeItem(EMAIL_LINK_MESSAGE_KEY)
  return msg
}

/** Einmalig abholen, ob gerade ein Recovery-Link geöffnet wurde. */
export function consumeRecoveryFlag(): boolean {
  const flag = sessionStorage.getItem(RECOVERY_KEY)
  if (flag) sessionStorage.removeItem(RECOVERY_KEY)
  return flag !== null
}

/**
 * Zweiter, unabhängiger Weg in den Recovery-Modus: GoTrue feuert nach dem
 * Einlösen des Links `PASSWORD_RECOVERY`. Der Marker oben deckt den Fall ab,
 * dass der Router schneller war als supabase-js; dieses Event den Fall, dass
 * die Seite schon stand. Beide zusammen sind robust gegen die Reihenfolge.
 */
export function onPasswordRecovery(callback: () => void): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') callback()
  })
  return () => data.subscription.unsubscribe()
}

/** Sign out; the next launch starts a fresh anonymous session. */
export async function signOutUser(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

/**
 * Konto endgültig löschen (DESIGN-PLAYSTORE.md) — Play-Pflicht für jede App
 * mit Registrierung. Die RPC `delete_own_account` (0017) löscht die Zeile in
 * auth.users, der Rest fällt per Cascade: Profil, Lernfortschritt, Scores,
 * Cups, Pokale, Abzeichen, Gruppen.
 *
 * Räumt bewusst NICHT die lokalen Speicher auf — das macht der Aufrufer erst
 * nach `ok: true`. Andersherum stünde bei einem Serverfehler der Fortschritt
 * lokal gelöscht und serverseitig noch da.
 */
export async function deleteOwnAccount(): Promise<AuthActionResult> {
  if (!supabase) return { ok: false, message: 'Offline — kein Backend konfiguriert.' }
  const { error } = await supabase.rpc('delete_own_account')
  if (error) {
    // PGRST202 = Funktion nicht im Schema-Cache, also Migration 0017 noch nicht
    // eingespielt. Der Code steht in error.code; die message („Could not find
    // the function … in the schema cache") ist nichts, was man Spielern zeigt.
    if (error.code === 'PGRST202') {
      return { ok: false, message: 'Löschen ist auf diesem Server noch nicht freigeschaltet.' }
    }
    return { ok: false, message: translateAuthError(error.message) }
  }
  return { ok: true, message: 'Konto und alle zugehörigen Daten wurden gelöscht.' }
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
