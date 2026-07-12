import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GameMode,
  QuestionProgress,
  SessionSummary,
} from '../features/quiz-engine/types'

export interface LocalScoreEntry {
  mode: GameMode | 'cup' | 'training'
  score: number
  maxPossible: number
  questionCount: number
  durationMs: number
  playedAt: number
}

const MAX_SCORE_ENTRIES = 50

/** Unsynced counter deltas per question, waiting to be pushed to Supabase. */
export interface PendingDelta {
  shown: number
  wrong: number
  correct: number
}

interface ProgressState {
  progressById: Record<string, QuestionProgress>
  scores: LocalScoreEntry[]
  pending: Record<string, PendingDelta>
  recordAnswer: (questionId: string, correct: boolean) => void
  recordSession: (summary: SessionSummary) => void
  recordCup: (totalScore: number, legs: SessionSummary[]) => void
  /** Subtract successfully synced amounts from the pending queue. */
  consumePending: (synced: Record<string, PendingDelta>) => void
  resetProgress: () => void
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      progressById: {},
      scores: [],
      pending: {},

      recordAnswer: (questionId, correct) =>
        set((state) => {
          const prev = state.progressById[questionId]
          const next: QuestionProgress = {
            questionId,
            timesShown: (prev?.timesShown ?? 0) + 1,
            timesWrong: (prev?.timesWrong ?? 0) + (correct ? 0 : 1),
            timesCorrect: (prev?.timesCorrect ?? 0) + (correct ? 1 : 0),
            lastSeenAt: Date.now(),
            lastResult: correct,
          }
          const pendingPrev = state.pending[questionId] ?? {
            shown: 0,
            wrong: 0,
            correct: 0,
          }
          return {
            progressById: { ...state.progressById, [questionId]: next },
            pending: {
              ...state.pending,
              [questionId]: {
                shown: pendingPrev.shown + 1,
                wrong: pendingPrev.wrong + (correct ? 0 : 1),
                correct: pendingPrev.correct + (correct ? 1 : 0),
              },
            },
          }
        }),

      recordSession: (summary) =>
        set((state) => ({
          scores: [
            {
              mode: summary.mode,
              score: summary.score,
              maxPossible: summary.maxPossible,
              questionCount: summary.questionCount,
              durationMs: summary.durationMs,
              playedAt: Date.now(),
            },
            ...state.scores,
          ].slice(0, MAX_SCORE_ENTRIES),
        })),

      recordCup: (totalScore, legs) =>
        set((state) => ({
          scores: [
            {
              mode: 'cup' as const,
              score: totalScore,
              // Interim bis E5: Rohsumme hat kein Maximum (wie toSessionSummary)
              maxPossible: Math.max(totalScore, 1),
              questionCount: legs.reduce((s, l) => s + l.questionCount, 0),
              durationMs: legs.reduce((s, l) => s + l.durationMs, 0),
              playedAt: Date.now(),
            },
            ...state.scores,
          ].slice(0, MAX_SCORE_ENTRIES),
        })),

      consumePending: (synced) =>
        set((state) => {
          const pending: Record<string, PendingDelta> = {}
          for (const [id, delta] of Object.entries(state.pending)) {
            const done = synced[id]
            if (!done) {
              pending[id] = delta
              continue
            }
            const rest: PendingDelta = {
              shown: delta.shown - done.shown,
              wrong: delta.wrong - done.wrong,
              correct: delta.correct - done.correct,
            }
            if (rest.shown > 0 || rest.wrong > 0 || rest.correct > 0) {
              pending[id] = rest
            }
          }
          return { pending }
        }),

      resetProgress: () => set({ progressById: {}, scores: [], pending: {} }),
    }),
    { name: 'geo-quiz-progress' },
  ),
)
