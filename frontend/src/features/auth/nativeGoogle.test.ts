import { describe, expect, it } from 'vitest'
import { classifyNativeGoogleError, toHex } from './nativeGoogle'

describe('classifyNativeGoogleError', () => {
  it('Abbruch durch den Nutzer ist endgültig', () => {
    expect(classifyNativeGoogleError({ code: 'canceled', message: 'x' })).toEqual({
      kind: 'canceled',
    })
  })

  it('alles andere weicht auf den Browser-Weg aus', () => {
    const result = classifyNativeGoogleError({
      code: 'failed',
      message: 'NoCredentialException: no credentials',
    })
    expect(result).toEqual({
      kind: 'unavailable',
      reason: 'NoCredentialException: no credentials',
    })
  })

  it('verkraftet Fehler ohne code/message', () => {
    expect(classifyNativeGoogleError(null).kind).toBe('unavailable')
    expect(classifyNativeGoogleError('boom')).toEqual({ kind: 'unavailable', reason: 'boom' })
  })
})

describe('toHex', () => {
  it('kodiert Bytes zweistellig klein', () => {
    expect(toHex(new Uint8Array([0, 15, 16, 255]).buffer)).toBe('000f10ff')
  })
})
