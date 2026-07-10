import { describe, expect, it } from 'vitest'
import { AdaptiveSampler, priorityWeight, RECENT_BUFFER_SIZE } from './adaptiveSampler'
import type { QuestionProgress } from './types'
import type { Rng } from './questionGenerator'

const NOW = 1_750_000_000_000

function progress(
  id: string,
  overrides: Partial<QuestionProgress> = {},
): QuestionProgress {
  return {
    questionId: id,
    timesShown: 10,
    timesWrong: 0,
    timesCorrect: 10,
    lastSeenAt: NOW,
    lastResult: true,
    ...overrides,
  }
}

/** Deterministic RNG from a fixed sequence (repeats when exhausted). */
function seqRng(values: number[]): Rng {
  let i = 0
  return { next: () => values[i++ % values.length] }
}

describe('priorityWeight', () => {
  it('never-shown questions get the 3.0 novelty weight', () => {
    expect(priorityWeight(undefined, NOW)).toBe(3.0)
    expect(priorityWeight(progress('q', { timesShown: 0 }), NOW)).toBe(3.0)
  })

  it('always-wrong beats always-right by 5x (error weight range [1,5])', () => {
    const wrong = priorityWeight(
      progress('q', { timesWrong: 10, timesCorrect: 0 }),
      NOW,
    )
    const right = priorityWeight(progress('q'), NOW)
    expect(wrong / right).toBeCloseTo(5)
  })

  it('recency weight grows with days since last seen, capped at 4', () => {
    const fresh = priorityWeight(progress('q'), NOW)
    const tenDays = priorityWeight(
      progress('q', { lastSeenAt: NOW - 10 * 86_400_000 }),
      NOW,
    )
    const yearOld = priorityWeight(
      progress('q', { lastSeenAt: NOW - 365 * 86_400_000 }),
      NOW,
    )
    expect(tenDays).toBeCloseTo(fresh * 2.5) // 1 + 10*0.15
    expect(yearOld).toBeCloseTo(fresh * 4) // capped
  })
})

describe('AdaptiveSampler', () => {
  it('resurfaces wrong questions disproportionately (statistical)', () => {
    const ids = ['easy1', 'easy2', 'easy3', 'hard']
    const byId = new Map<string, QuestionProgress>([
      ['easy1', progress('easy1')],
      ['easy2', progress('easy2')],
      ['easy3', progress('easy3')],
      ['hard', progress('hard', { timesWrong: 10, timesCorrect: 0 })],
    ])
    // Real Math.random, large sample: 'hard' has weight 5 vs 1 each → expect
    // ~5/8 of weighted picks. With the 30% flat share, still well above 1/4.
    const sampler = new AdaptiveSampler(ids, byId, { next: () => Math.random() }, () => NOW)
    let hardCount = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      if (sampler.nextQuestionId() === 'hard') hardCount++
    }
    // Ring buffer suppresses streaks, but 'hard' must still clearly beat flat 25 %.
    expect(hardCount / n).toBeGreaterThan(0.3)
  })

  it('avoids immediate repeats via the ring buffer', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `q${i}`)
    const sampler = new AdaptiveSampler(ids, new Map(), { next: () => Math.random() }, () => NOW)
    const picks: string[] = []
    for (let i = 0; i < 200; i++) picks.push(sampler.nextQuestionId())
    for (let i = 0; i < picks.length; i++) {
      const windowStart = Math.max(0, i - RECENT_BUFFER_SIZE)
      expect(picks.slice(windowStart, i)).not.toContain(picks[i])
    }
  })

  it('uses flat-random for rng < 0.3 (serendipity share)', () => {
    const ids = ['a', 'b']
    const byId = new Map([['a', progress('a', { timesWrong: 10, timesCorrect: 0 })]])
    // First rng call 0.1 → flat branch; second call 0.99 → picks index 1 ('b')
    // despite 'a' having far higher priority.
    const sampler = new AdaptiveSampler(ids, byId, seqRng([0.1, 0.99]), () => NOW)
    expect(sampler.nextQuestionId()).toBe('b')
  })
})
