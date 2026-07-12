import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameMode, SessionSummary } from '../features/quiz-engine/types'
import type { Question } from '../features/quiz-engine/types'
import {
  ArcadeSession,
  makeGeneratorSource,
  type ArcadeAnswerFeedback,
  type ArcadeSummary,
} from '../features/quiz-engine/arcadeSession'
import {
  SESSION_SECONDS,
  streakMultiplier,
} from '../features/quiz-engine/arcadeScoring'
import { haversineKm } from '../features/geo/distance'
import { dataBundle, outlineDataBundle } from '../data'
import { useProgressStore } from '../state/progressStore'
import type { PinAnswer } from './useQuizSession'

/** Anzeige-Takt der Uhr; die Wahrheit liegt in der Engine (Wanduhr). */
const CLOCK_TICK_MS = 100
/** Preload hängt nie länger als das — danach startet die Frage trotzdem. */
const PRELOAD_TIMEOUT_MS = 4000

function preloadQuestion(q: Question | null): Promise<void> {
  if (!q || q.kind !== 'pin' || !q.image) return Promise.resolve()
  const src = q.image
  return new Promise((resolve) => {
    const img = new Image()
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, PRELOAD_TIMEOUT_MS)
    img.onload = done
    img.onerror = done
    img.src = src
  })
}

/**
 * React-Anbindung der ArcadeSession (Vertrag: DESIGN-ARCADE Umsetzungs-Log E2).
 * Aufdecken ist atomar: Fragen (inkl. Landmark-Foto) werden in Idle-/Feedback-
 * Pausen unsichtbar vorgeladen; erst danach startet die Uhr.
 */
export function useArcadeSession(
  mode: GameMode,
  budgetMs: number = SESSION_SECONDS * 1000,
) {
  const recordAnswer = useProgressStore((s) => s.recordAnswer)
  const [session] = useState(
    () =>
      new ArcadeSession({
        mode,
        budgetMs,
        nextQuestion: makeGeneratorSource(
          mode,
          mode === 'outline' ? outlineDataBundle : dataBundle,
        ),
      }),
  )
  const [, setTick] = useState(0)
  const rerender = useCallback(() => setTick((n) => n + 1), [])
  const [feedback, setFeedback] = useState<ArcadeAnswerFeedback | null>(null)
  const [nextReady, setNextReady] = useState(false)
  const [questionKey, setQuestionKey] = useState(0)
  // Entwertet laufende Preloads, wenn die Session weitergesprungen ist.
  const stageToken = useRef(0)

  // Erste Frage vorziehen und Foto laden — gestartet wird erst per begin()
  // (die View zeigt vorher den 3-2-1-Countdown; Frage bleibt bis dahin verdeckt).
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    const staged = session.prepareNext()
    void preloadQuestion(staged).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  /** Deckt die erste Frage auf und startet die Uhr (atomar). */
  const begin = useCallback(() => {
    if (session.phase !== 'idle') return
    session.start()
    setQuestionKey((k) => k + 1)
    rerender()
  }, [session, rerender])

  /** Nach jeder Antwort: nächste Frage unsichtbar vorbereiten. */
  const stageNext = useCallback(() => {
    setNextReady(false)
    const token = ++stageToken.current
    const staged = session.prepareNext()
    void preloadQuestion(staged).then(() => {
      if (stageToken.current === token) setNextReady(true)
    })
  }, [session])

  const answerChoice = useCallback(
    (chosenIndex: number | null) => {
      const fb = session.answerChoice(chosenIndex)
      if (fb) {
        recordAnswer(fb.questionId, fb.correct)
        setFeedback(fb)
        stageNext()
      }
      rerender() // deckt auch "Antwort zu spät → done" ab
    },
    [session, recordAnswer, stageNext, rerender],
  )

  const answerPin = useCallback(
    (guess: PinAnswer | null) => {
      const q = session.question
      const distanceKm =
        guess && q?.kind === 'pin'
          ? haversineKm(guess.lat, guess.lng, q.target.lat, q.target.lng)
          : null
      const fb = session.answerPin(distanceKm)
      if (fb) {
        recordAnswer(fb.questionId, fb.correct)
        setFeedback(fb)
        stageNext()
      }
      rerender()
    },
    [session, recordAnswer, stageNext, rerender],
  )

  const next = useCallback(() => {
    if (session.phase !== 'feedback' || !nextReady) return
    session.next()
    setFeedback(null)
    setQuestionKey((k) => k + 1)
    rerender()
  }, [session, nextReady, rerender])

  // Anzeige-Tick, nur solange eine Frage aktiv ist. Läuft die Wanduhr ab
  // (auch nach App-Hintergrund), beendet forceTimeUp die Session.
  const phase = session.phase
  useEffect(() => {
    if (phase !== 'question') return
    const id = setInterval(() => {
      if (session.remainingMs() <= 0) session.forceTimeUp()
      rerender()
    }, CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [phase, questionKey, session, rerender])

  const summary = useCallback(() => session.summary(), [session])

  return {
    phase,
    ready,
    begin,
    question: session.question,
    score: session.score,
    streak: session.streak,
    multiplier: streakMultiplier(session.streak),
    bestStreak: session.bestStreak,
    remainingMs: session.remainingMs(),
    budgetMs,
    feedback,
    nextReady,
    questionKey,
    answerChoice,
    answerPin,
    next,
    summary,
  }
}

/**
 * Interim-Brücke (bis E4/E5): Arcade-Ergebnis ins alte SessionSummary-Format.
 * `maxPossible` hat im Arcade-System kein echtes Gegenstück — wir setzen den
 * Score selbst ein (Prozent-Anzeigen zeigen dann 100 %). E5 ersetzt das Format.
 */
export function toSessionSummary(s: ArcadeSummary): SessionSummary {
  return {
    mode: s.mode,
    score: s.score,
    maxPossible: Math.max(s.score, 1),
    questionCount: s.questionCount,
    correctCount: s.correctCount,
    bestStreak: Math.floor(s.bestStreak),
    durationMs: Math.max(s.playedMs, 1),
    answers: [],
  }
}
