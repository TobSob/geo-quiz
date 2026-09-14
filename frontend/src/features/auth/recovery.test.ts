import { describe, expect, it } from 'vitest'
import {
  isRecoveryRedirect,
  MIN_PASSWORD_LENGTH,
  passwordProblemMessage,
  validateNewPassword,
} from './recovery'

describe('isRecoveryRedirect', () => {
  it('erkennt den Implicit-Flow-Rücksprung im Hash', () => {
    expect(
      isRecoveryRedirect('#access_token=abc&refresh_token=def&type=recovery', ''),
    ).toBe(true)
  })

  it('erkennt type=recovery auch als Query-Parameter', () => {
    expect(isRecoveryRedirect('', '?type=recovery')).toBe(true)
  })

  it('ignoriert andere Rücksprünge', () => {
    expect(isRecoveryRedirect('#access_token=abc&type=signup', '')).toBe(false)
    expect(isRecoveryRedirect('#/profile', '')).toBe(false)
    expect(isRecoveryRedirect('', '')).toBe(false)
  })

  it('greift nicht bei einem abgelaufenen Link (Fehler statt Token)', () => {
    expect(
      isRecoveryRedirect('#error=access_denied&error_code=otp_expired', ''),
    ).toBe(false)
  })
})

describe('validateNewPassword', () => {
  it('lässt ein gültiges Paar durch', () => {
    expect(validateNewPassword('geheim123', 'geheim123')).toBeNull()
  })

  it('meldet zu kurze Passwörter', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    expect(validateNewPassword(short, short)).toBe('too-short')
  })

  it('meldet abweichende Wiederholung', () => {
    expect(validateNewPassword('geheim123', 'geheim124')).toBe('mismatch')
  })

  it('prüft die Länge vor der Gleichheit — die konkretere Meldung gewinnt', () => {
    expect(validateNewPassword('abc', 'xyz')).toBe('too-short')
  })

  it('liefert zu jedem Problem eine deutsche Meldung und zu null keine', () => {
    expect(passwordProblemMessage('too-short')).toMatch(/mindestens/)
    expect(passwordProblemMessage('mismatch')).toMatch(/nicht überein/)
    expect(passwordProblemMessage(null)).toBeNull()
  })
})
