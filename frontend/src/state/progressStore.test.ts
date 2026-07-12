import { describe, expect, it } from 'vitest'
import { addToBests, type LocalScoreEntry } from './progressStore'

function entry(mode: LocalScoreEntry['mode'], score: number, playedAt: number): LocalScoreEntry {
  return {
    mode,
    score,
    maxPossible: Math.max(score, 1),
    questionCount: 10,
    durationMs: 60_000,
    playedAt,
  }
}

describe('addToBests (Allzeit-Top-10 je Kategorie)', () => {
  it('sortiert nach Punkten absteigend und trennt Kategorien', () => {
    let bests: Record<string, LocalScoreEntry[]> = {}
    bests = addToBests(bests, entry('flags', 500, 1))
    bests = addToBests(bests, entry('flags', 900, 2))
    bests = addToBests(bests, entry('cup', 3000, 3))

    expect(bests['flags'].map((e) => e.score)).toEqual([900, 500])
    expect(bests['cup'].map((e) => e.score)).toEqual([3000])
  })

  it('behält maximal 10 Einträge — der schwächste fliegt raus', () => {
    let bests: Record<string, LocalScoreEntry[]> = {}
    for (let i = 1; i <= 12; i++) {
      bests = addToBests(bests, entry('flags', i * 100, i))
    }
    expect(bests['flags']).toHaveLength(10)
    expect(bests['flags'][0].score).toBe(1200)
    expect(bests['flags'][9].score).toBe(300) // 100 & 200 sind verdrängt
  })

  it('bei Punktgleichheit bleibt der ältere Lauf vorn', () => {
    let bests: Record<string, LocalScoreEntry[]> = {}
    bests = addToBests(bests, entry('flags', 700, 200))
    bests = addToBests(bests, entry('flags', 700, 100))
    expect(bests['flags'][0].playedAt).toBe(100)
  })

  it('Migration: reduce über einen Alt-Verlauf baut die Rekorde auf', () => {
    const history = [
      entry('flags', 300, 1),
      entry('cup', 2000, 2),
      entry('flags', 800, 3),
      entry('training', 450, 4),
    ]
    const bests = history.reduce(addToBests, {})
    expect(bests['flags'][0].score).toBe(800)
    expect(bests['cup'][0].score).toBe(2000)
    expect(bests['training'][0].score).toBe(450)
  })
})
