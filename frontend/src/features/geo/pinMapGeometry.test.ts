import { describe, expect, it } from 'vitest'
import { MAX_LAT, nearestLng, revealBounds, revealLngs } from './pinMapGeometry'

describe('nearestLng', () => {
  it('holt das Ziel auf die Weltkopie neben dem Tipp', () => {
    // Bora Bora (−151,7°), Tipp in Australien (150°): der kurze Weg geht über
    // die Datumsgrenze nach Osten, nicht quer über die halbe Welt zurück.
    expect(nearestLng(-151.7, 150)).toBeCloseTo(208.3, 5)
  })

  it('lässt eine bereits nahe Longitude in Ruhe', () => {
    expect(nearestLng(10, 12)).toBe(10)
  })

  it('bleibt immer höchstens 180° von der Referenz entfernt', () => {
    for (const ref of [-350, -180, -37, 0, 91, 180, 400]) {
      for (const lng of [-179, -90, 0, 90, 179]) {
        expect(Math.abs(nearestLng(lng, ref) - ref)).toBeLessThanOrEqual(180)
      }
    }
  })
})

describe('revealLngs', () => {
  it('hält den Mittelpunkt in (−180°, 180°] — Everest-Fall', () => {
    // DESIGN-MAP-FIXES.md #1: früher landete das Ziel bei −273°.
    for (const guess of [-100, -160, -175]) {
      const { guessLng, targetLng } = revealLngs(guess, 86.9)
      const mid = (guessLng + targetLng) / 2
      expect(mid).toBeGreaterThan(-180)
      expect(mid).toBeLessThanOrEqual(180)
    }
  })

  it('lässt die Differenz — und damit die Linienlänge — unverändert', () => {
    for (const [g, t] of [
      [-100, 86.9],
      [150, -151.7],
      [0, 0],
      [179, -179],
    ] as const) {
      const near = nearestLng(t, g)
      const out = revealLngs(g, t)
      expect(out.targetLng - out.guessLng).toBeCloseTo(near - g, 9)
    }
  })
})

describe('revealBounds', () => {
  it('sortiert Südwest und Nordost — egal in welcher Reihenfolge die Punkte kommen', () => {
    // Der Bug vom 2026-08-29: Tipp nördlich UND östlich vom Ziel ergab bei
    // MapLibre eine invertierte Box, fitBounds sprang woanders hin.
    const guess: [number, number] = [30, 60]
    const target: [number, number] = [-10, 20]
    const a = revealBounds(guess, target)
    const b = revealBounds(target, guess)
    expect(a).toEqual(b)
    expect(a.sw[0]).toBeLessThan(a.ne[0])
    expect(a.sw[1]).toBeLessThan(a.ne[1])
  })

  it('erweitert um 40 % der Spannweite je Seite', () => {
    const { sw, ne } = revealBounds([0, 0], [10, 20])
    expect(sw).toEqual([-4, -8])
    expect(ne).toEqual([14, 28])
  })

  it('deckelt die Breite an der Mercator-Grenze', () => {
    const { sw, ne } = revealBounds([0, -80], [10, 84])
    expect(ne[1]).toBe(MAX_LAT)
    expect(sw[1]).toBe(-MAX_LAT)
  })

  it('behält unverpackte Longitudes jenseits ±180 bei', () => {
    // revealLngs darf beide Enden bis ±270 schieben — die Box muss das
    // mitmachen, sonst nimmt fitBounds wieder den langen Weg.
    const { guessLng, targetLng } = revealLngs(150, -151.7)
    const { sw, ne } = revealBounds([guessLng, -16], [targetLng, -17])
    expect(sw[0]).toBeLessThan(ne[0])
    expect(ne[0]).toBeGreaterThan(180)
  })

  it('ergibt bei identischen Punkten eine Box ohne Ausdehnung', () => {
    const { sw, ne } = revealBounds([12, 34], [12, 34])
    expect(sw).toEqual([12, 34])
    expect(ne).toEqual([12, 34])
  })
})
