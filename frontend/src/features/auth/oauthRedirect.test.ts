import { describe, expect, it } from 'vitest'
import { parseOAuthRedirectError } from './oauthRedirect'

describe('parseOAuthRedirectError', () => {
  it('kein Fehler-Redirect → hasError false', () => {
    expect(parseOAuthRedirectError('', '')).toEqual({
      hasError: false,
      errorCode: null,
      errorDescription: null,
    })
    // Erfolgs-Redirect (Token-Fragment) ist kein Fehler.
    expect(
      parseOAuthRedirectError('#access_token=abc&refresh_token=def&token_type=bearer', ''),
    ).toEqual({ hasError: false, errorCode: null, errorDescription: null })
  })

  it('identity_already_exists als Hash-Fragment', () => {
    const hash =
      '#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked'
    expect(parseOAuthRedirectError(hash, '')).toEqual({
      hasError: true,
      errorCode: 'identity_already_exists',
      errorDescription: 'Identity is already linked',
    })
  })

  it('Fehler als Query-Parameter statt Hash', () => {
    const search = '?error=access_denied&error_code=access_denied&error_description=User+cancelled'
    expect(parseOAuthRedirectError('', search)).toEqual({
      hasError: true,
      errorCode: 'access_denied',
      errorDescription: 'User cancelled',
    })
  })

  it('error ohne error_code zählt trotzdem als Fehler', () => {
    const result = parseOAuthRedirectError('#error=server_error', '')
    expect(result.hasError).toBe(true)
    expect(result.errorCode).toBeNull()
  })
})
