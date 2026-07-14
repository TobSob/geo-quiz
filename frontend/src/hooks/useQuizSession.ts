import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  AnswerResult,
  GameMode,
  Question,
  SessionSummary,
} from '../features/quiz-engine/types'
import {
  MAX_CHOICE_SCORE,
  MAX_PIN_SCORE,
  scoreChoice,
  scorePin,
} from '../features/quiz-engine/scoring'
import { haversineKm } from '../features/geo/distance'
import { sfx } from '../features/audio/sfx'
import { useProgressStore } from '../state/progressStore'

export type QuizPhase = 'question' | 'feedback' | 'done'

export interface PinAnswer {
  lat: number
  lng: number
}

export interface FeedbackInfo {
  result: AnswerResult
  /** Chosen option index (choice) — null on timeout. */
  chosenIndex: number | null
  /** Where the user dropped the pin (pin modes). */
  guess: PinAnswer | null
}

/**
 * Session state machine shared by all modes: question → feedback → next.
 * Scoring, streaks and progress recording live here; screens only render.
 */
export function useQuizSession(mode: GameMode | 'training', questions: Question[]) {
  const recordAnswer = useProgressStore((s) => s.recordAnswer)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<QuizPhase>('question')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [answers, setAnswers] = useState<AnswerResult[]>([])
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null)
  const [questionKey, setQuestionKey] = useState(0)
  const startedAtRef = useRef(Date.now())
  const questionStartRef = useRef(Date.now())
  // Guards against timer-timeout and user-click answering the same question
  // in the same render cycle (the `phase` state guard alone is stale then).
  const answeredRef = useRef(false)

  const question = questions[index] ?? null

  const finishAnswer = useCallback(
    (result: AnswerResult, chosenIndex: number | null, guess: PinAnswer | null) => {
      if (answeredRef.current) return
      answeredRef.current = true
      if (result.correct) sfx.correct()
      else sfx.wrong()
      recordAnswer(result.questionId, result.correct)
      const nextStreak = result.correct ? streak + 1 : 0
      setScore((s) => s + result.score)
      setStreak(nextStreak)
      setBestStreak((b) => Math.max(b, nextStreak))
      setAnswers((a) => [...a, result])
      setFeedback({ result, chosenIndex, guess })
      setPhase('feedback')
    },
    [recordAnswer, streak],
  )

  const answerChoice = useCallback(
    (chosenIndex: number | null) => {
      if (!question || question.kind !== 'choice' || phase !== 'question') return
      const elapsedMs = Date.now() - questionStartRef.current
      const correct = chosenIndex === question.correctIndex
      const points = scoreChoice(correct, elapsedMs, question.timeLimitMs, streak)
      finishAnswer(
        {
          questionId: question.id,
          correct,
          score: points,
          maxScore: MAX_CHOICE_SCORE,
          elapsedMs,
        },
        chosenIndex,
        null,
      )
    },
    [question, phase, streak, finishAnswer],
  )

  const answerPin = useCallback(
    (guess: PinAnswer | null) => {
      if (!question || question.kind !== 'pin' || phase !== 'question') return
      const elapsedMs = Date.now() - questionStartRef.current
      if (!guess) {
        finishAnswer(
          {
            questionId: question.id,
            correct: false,
            score: 0,
            maxScore: MAX_PIN_SCORE,
            elapsedMs,
            distanceKm: undefined,
          },
          null,
          null,
        )
        return
      }
      const distanceKm = haversineKm(
        guess.lat,
        guess.lng,
        question.target.lat,
        question.target.lng,
      )
      const points = scorePin(
        distanceKm,
        question.falloffKm,
        elapsedMs,
        question.timeLimitMs,
      )
      finishAnswer(
        {
          questionId: question.id,
          // "correct" for progress tracking: within 1.5x falloff radius
          correct: distanceKm <= question.falloffKm * 1.5,
          score: points,
          maxScore: MAX_PIN_SCORE,
          elapsedMs,
          distanceKm,
        },
        null,
        guess,
      )
    },
    [question, phase, finishAnswer],
  )

  const next = useCallback(() => {
    setFeedback(null)
    if (index + 1 >= questions.length) {
      setPhase('done')
    } else {
      answeredRef.current = false
      setIndex((i) => i + 1)
      setQuestionKey((k) => k + 1)
      questionStartRef.current = Date.now()
      setPhase('question')
    }
  }, [index, questions.length])

  const summary: SessionSummary = useMemo(
    () => ({
      mode,
      score,
      maxPossible: questions.reduce(
        (s, q) => s + (q.kind === 'choice' ? MAX_CHOICE_SCORE : MAX_PIN_SCORE),
        0,
      ),
      questionCount: questions.length,
      correctCount: answers.filter((a) => a.correct).length,
      bestStreak,
      durationMs: Date.now() - startedAtRef.current,
      answers,
    }),
    [mode, score, questions, answers, bestStreak],
  )

  return {
    question,
    index,
    total: questions.length,
    phase,
    score,
    streak,
    bestStreak,
    feedback,
    summary,
    questionKey,
    questionStartRef,
    answerChoice,
    answerPin,
    next,
  }
}
