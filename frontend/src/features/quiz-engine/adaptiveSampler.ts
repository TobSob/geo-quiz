import type { QuestionProgress } from './types'
import type { Rng } from './questionGenerator'
import { defaultRng } from './questionGenerator'

export const FLAT_RANDOM_SHARE = 0.3
export const RECENT_BUFFER_SIZE = 5
const MS_PER_DAY = 86_400_000

/**
 * Priority weight for one question, from its local progress counters.
 * error_weight in [1, 5], recency_weight in [1, 4] (3.0 if never shown).
 */
export function priorityWeight(
  progress: QuestionProgress | undefined,
  now: number,
): number {
  if (!progress || progress.timesShown === 0) return 1 * 3.0
  const wrongRate = progress.timesWrong / Math.max(progress.timesShown, 1)
  const errorWeight = 1 + 4 * wrongRate
  const daysSince = (now - progress.lastSeenAt) / MS_PER_DAY
  const recencyWeight = Math.min(1 + daysSince * 0.15, 4.0)
  return errorWeight * recencyWeight
}

/**
 * Weighted-random sampler for Training mode. 30 % of picks are flat-random
 * for variety; a short ring buffer avoids immediate repeats.
 */
export class AdaptiveSampler {
  private recent: string[] = []
  private readonly questionIds: string[]
  private readonly progressById: Map<string, QuestionProgress>
  private readonly rng: Rng
  private readonly now: () => number

  constructor(
    questionIds: string[],
    progressById: Map<string, QuestionProgress>,
    rng: Rng = defaultRng,
    now: () => number = () => Date.now(),
  ) {
    if (questionIds.length === 0) {
      throw new Error('AdaptiveSampler needs at least one question')
    }
    this.questionIds = questionIds
    this.progressById = progressById
    this.rng = rng
    this.now = now
  }

  nextQuestionId(): string {
    const candidates = this.questionIds.filter((id) => !this.recent.includes(id))
    const pool = candidates.length > 0 ? candidates : this.questionIds
    const id =
      this.rng.next() < FLAT_RANDOM_SHARE
        ? pool[Math.floor(this.rng.next() * pool.length)]
        : this.weightedPick(pool)
    this.remember(id)
    return id
  }

  private weightedPick(pool: string[]): string {
    const now = this.now()
    const weights = pool.map((id) =>
      priorityWeight(this.progressById.get(id), now),
    )
    const total = weights.reduce((s, w) => s + w, 0)
    let r = this.rng.next() * total
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }

  private remember(id: string) {
    this.recent.push(id)
    if (this.recent.length > RECENT_BUFFER_SIZE) this.recent.shift()
  }
}
