import { describe, expect, it } from 'vitest'
import { NATIVE_OAUTH_REDIRECT, parseNativeOAuthCallback } from './nativeOAuth'

describe('parseNativeOAuthCallback', () => {
  it('Schema passt zur App-ID', () => {
    expect(NATIVE_OAUTH_REDIRECT).toBe('de.tobsob.geoquizarcade://auth-callback')
  })

  it('liest den PKCE-Code aus dem Rücksprung', () => {
    expect(parseNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}?code=abc-123`)).toEqual({
      kind: 'code',
      code: 'abc-123',
    })
    expect(parseNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}/?code=xyz`)).toEqual({
      kind: 'code',
      code: 'xyz',
    })
  })

  it('erkennt Fehler in Query und Hash, wie im Web', () => {
    const q = parseNativeOAuthCallback(
      `${NATIVE_OAUTH_REDIRECT}?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked`,
    )
    expect(q).toEqual({
      kind: 'error',
      outcome: {
        hasError: true,
        errorCode: 'identity_already_exists',
        errorDescription: 'Identity is already linked',
      },
    })
    const h = parseNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}#error=access_denied`)
    expect(h?.kind).toBe('error')
  })

  it('Fehler hat Vorrang vor einem Code', () => {
    expect(
      parseNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}?code=abc&error=access_denied`)?.kind,
    ).toBe('error')
  })

  it('ohne Code und ohne Fehler: als Fehler melden, nicht still ignorieren', () => {
    expect(parseNativeOAuthCallback(NATIVE_OAUTH_REDIRECT)).toEqual({
      kind: 'error',
      outcome: { hasError: true, errorCode: 'missing_code', errorDescription: null },
    })
  })

  it('fremde URLs sind kein Callback', () => {
    expect(parseNativeOAuthCallback('https://geoquiz.tobsob.dev/?code=abc')).toBeNull()
    expect(parseNativeOAuthCallback('de.tobsob.geoquizarcade://other?code=abc')).toBeNull()
    expect(parseNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}X?code=abc`)).toBeNull()
  })
})
