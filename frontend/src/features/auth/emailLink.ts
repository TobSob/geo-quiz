/**
 * Reine Parsing-Logik für Links aus Auth-Mails (DESIGN-MAIL-DOMAIN.md) —
 * ohne Supabase-Import und ohne DOM, testbar wie `recovery.ts`.
 *
 * Die Templates verlinken auf die eigene Domain statt auf GoTrues
 * Verify-Endpunkt:
 *
 *   https://geoquiz.tobsob.dev/?token_hash=…&type=email_change
 *
 * Eingelöst wird der Token erst im Browser per `verifyOtp` — so zeigt die Mail
 * nicht auf eine fremde Domain, und Link-Scanner (Outlook Safe Links), die den
 * Link vorab aufrufen, verbrauchen ihn nicht.
 */

export const EMAIL_LINK_TYPES = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const

export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number]

export interface EmailLink {
  tokenHash: string
  type: EmailLinkType
}

function isEmailLinkType(value: string | null): value is EmailLinkType {
  return value !== null && (EMAIL_LINK_TYPES as readonly string[]).includes(value)
}

/**
 * Liest `token_hash` und `type` aus der Query. Nur die Query, nicht den Hash:
 * Die Templates hängen die Parameter vor das `#`, und im Hash liegen beim
 * HashRouter die Routen.
 */
export function parseEmailLink(search: string): EmailLink | null {
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  if (!tokenHash || !isEmailLinkType(type)) return null
  return { tokenHash, type }
}

/**
 * Rückmeldung nach erfolgreichem Einlösen. `recovery` bekommt keine: Dort
 * übernimmt das Panel „Neues Passwort setzen", eine zweite Meldung daneben
 * wäre Rauschen.
 */
export function emailLinkSuccessMessage(type: EmailLinkType): string | null {
  switch (type) {
    case 'email_change':
    case 'signup':
    case 'email':
      return 'E-Mail bestätigt — dein Account ist jetzt dauerhaft gesichert.'
    case 'magiclink':
    case 'invite':
      return 'Angemeldet!'
    case 'recovery':
      return null
  }
}
