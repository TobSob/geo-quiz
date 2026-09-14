import { describe, expect, it } from 'vitest'
import { emailLinkSuccessMessage, parseEmailLink } from './emailLink'

describe('parseEmailLink', () => {
  it('liest den Bestätigungslink des Konto-Upgrades', () => {
    expect(parseEmailLink('?token_hash=abc123&type=email_change')).toEqual({
      tokenHash: 'abc123',
      type: 'email_change',
    })
  })

  it('funktioniert auch ohne führendes Fragezeichen', () => {
    expect(parseEmailLink('token_hash=abc&type=recovery')).toEqual({
      tokenHash: 'abc',
      type: 'recovery',
    })
  })

  it('ignoriert Aufrufe ohne Token oder ohne Typ', () => {
    expect(parseEmailLink('')).toBeNull()
    expect(parseEmailLink('?type=email_change')).toBeNull()
    expect(parseEmailLink('?token_hash=abc')).toBeNull()
    expect(parseEmailLink('?token_hash=&type=email_change')).toBeNull()
  })

  it('lehnt unbekannte Typen ab, statt sie an verifyOtp durchzureichen', () => {
    expect(parseEmailLink('?token_hash=abc&type=sms')).toBeNull()
    expect(parseEmailLink('?token_hash=abc&type=EMAIL_CHANGE')).toBeNull()
  })

  it('verwechselt den alten Implicit-Flow-Link nicht mit dem neuen', () => {
    // Alte Mails: Tokens im Hash, die löst supabase-js selbst ein.
    expect(parseEmailLink('?code=xyz')).toBeNull()
    expect(parseEmailLink('?type=recovery')).toBeNull()
  })
})

describe('emailLinkSuccessMessage', () => {
  it('bestätigt das Konto-Upgrade', () => {
    expect(emailLinkSuccessMessage('email_change')).toMatch(/bestätigt/)
  })

  it('schweigt bei Recovery, dort übernimmt das Passwort-Panel', () => {
    expect(emailLinkSuccessMessage('recovery')).toBeNull()
  })
})
