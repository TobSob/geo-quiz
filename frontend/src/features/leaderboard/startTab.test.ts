import { describe, expect, it } from 'vitest'
import { startTab } from './startTab'

describe('startTab', () => {
  it('startet registrierte Spieler beim Geo Cup', () => {
    expect(startTab(true, 'online', false)).toBe('cups')
  })

  it('startet Gäste bei den eigenen Rekorden statt auf dem Account-Hinweis', () => {
    expect(startTab(true, 'online', true)).toBe('local')
  })

  it('bleibt während des Verbindens beim Cup (kein Tab-Sprung für Accounts)', () => {
    expect(startTab(true, 'connecting', true)).toBe('cups')
  })

  it('startet ohne Backend immer lokal — der Cup wäre dort gesperrt', () => {
    expect(startTab(false, 'online', false)).toBe('local')
    expect(startTab(false, 'connecting', false)).toBe('local')
  })

  it('startet nach abgebrochener Verbindung lokal', () => {
    expect(startTab(true, 'offline', true)).toBe('local')
  })
})
