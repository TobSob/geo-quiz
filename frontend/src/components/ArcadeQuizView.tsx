import { useEffect, useRef, useState } from 'react'
import type { GameMode, Question, SessionSummary } from '../features/quiz-engine/types'
import type { ArcadeAnswerFeedback, ArcadeSummary } from '../features/quiz-engine/arcadeSession'
import { useArcadeSession, toSessionSummary } from '../hooks/useArcadeSession'
import type { PinAnswer } from '../hooks/useQuizSession'
import { CountryOutline } from './CountryOutline'
import { MapPicker } from './MapPicker'

const CHOICE_FEEDBACK_MS = 1200

/** Tier-ID → Glow-Klasse fürs Feedback-Label. */
const TIER_GLOW: Record<string, string> = {
  volltreffer: 'glow-green',
  stark: 'glow-cyan',
  knapp: 'glow-yellow',
  naja: 'dim',
  verpeilt: 'glow-pink',
}

function formatStreak(streak: number): string {
  return streak.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

interface Props {
  mode: GameMode
  title: string
  /** Zeitbudget in ms; Standard 60 s, Cup-Legs übergeben 30 s (E4). */
  budgetMs?: number
  onDone: (summary: SessionSummary) => void
  /** false beim Cup — der rendert eigene Zwischen-/Endscreens. */
  showSummary?: boolean
  onExit: () => void
  onReplay?: () => void
}

/**
 * Zeitbasierte Quiz-Ansicht (Arcade-Umbau, DESIGN-ARCADE.md). Training und
 * Cup laufen weiterhin über die alte QuizView, bis E4 den Cup umstellt.
 */
export function ArcadeQuizView({
  mode,
  title,
  budgetMs,
  onDone,
  showSummary = true,
  onExit,
  onReplay,
}: Props) {
  const s = useArcadeSession(mode, budgetMs)
  const { phase, question, nextReady, questionKey, next, answerChoice, summary } = s
  const [pendingPin, setPendingPin] = useState<PinAnswer | null>(null)
  const [lastSummary, setLastSummary] = useState<ArcadeSummary | null>(null)
  const doneReported = useRef(false)

  // Session-Ende genau einmal melden.
  useEffect(() => {
    if (phase === 'done' && !doneReported.current) {
      doneReported.current = true
      const result = summary()
      setLastSummary(result)
      onDone(toSessionSummary(result))
    }
  }, [phase, summary, onDone])

  // Choice-Feedback rückt automatisch weiter, sobald die Folgefrage geladen ist.
  useEffect(() => {
    if (phase !== 'feedback' || question?.kind !== 'choice' || !nextReady) return
    const t = setTimeout(next, CHOICE_FEEDBACK_MS)
    return () => clearTimeout(t)
  }, [phase, question, nextReady, next])

  // Pin zurücksetzen, wenn eine neue Frage aufgedeckt wird.
  useEffect(() => {
    setPendingPin(null)
  }, [questionKey])

  // Tastatur 1–4 für Choice-Optionen.
  useEffect(() => {
    if (phase !== 'question' || question?.kind !== 'choice') return
    const handler = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= 4) answerChoice(n - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, question, answerChoice])

  if (phase === 'done') {
    if (!showSummary) return null
    return (
      <ArcadeSummaryView
        title={title}
        summary={lastSummary ?? summary()}
        onExit={onExit}
        onReplay={onReplay}
      />
    )
  }

  if (phase === 'idle' || !question) {
    return <p className="dim center blink">LADE…</p>
  }

  const secondsLeft = Math.ceil(s.remainingMs / 1000)
  const fraction = Math.min(1, s.remainingMs / s.budgetMs)
  const clockGlow =
    s.remainingMs <= 10_000
      ? 'glow-pink'
      : s.remainingMs <= 20_000
        ? 'glow-yellow'
        : 'glow-green'
  const fillCls =
    fraction < 0.17
      ? 'timer-fill timer-fill--danger'
      : fraction < 0.34
        ? 'timer-fill timer-fill--warn'
        : 'timer-fill'

  return (
    <div className={question.kind === 'pin' ? 'stack quiz-screen--pin' : 'stack'}>
      <div className="quiz-chrome">
        <div className="quiz-chrome-main">
          <div className="hud">
            <div className="hud-stat">
              <span className="label">MODUS</span>
              <span className="glow-cyan">{title}</span>
            </div>
            <div className="hud-stat">
              <span className="label">ZEIT</span>
              <span
                className={`arcade-clock ${clockGlow}${s.remainingMs <= 10_000 ? ' blink' : ''}`}
              >
                {secondsLeft}s
              </span>
            </div>
            <div className="hud-stat">
              <span className="label">SCORE</span>
              <span className="glow-yellow">{s.score}</span>
            </div>
            {s.streak >= 1 && (
              <span
                className={`streak-badge${s.streak >= 5 ? ' streak-badge--hot' : ''}`}
              >
                {s.streak >= 5 ? '🔥' : '⚡'} {formatStreak(s.streak)} ·{' '}
                {Math.round(s.multiplier * 100)}%
              </span>
            )}
          </div>

          <div className="timer-track" aria-label="Zeit">
            <div className={fillCls} style={{ width: `${fraction * 100}%` }} />
          </div>

          {s.feedback && s.feedback.reclaimedSeconds > 0 && (
            <div className="time-pop display glow-cyan" aria-live="polite">
              +{s.feedback.reclaimedSeconds} SEC!
            </div>
          )}

          {question.kind === 'pin' && (
            <h2 className="center pin-prompt">{question.prompt}</h2>
          )}
        </div>

        {question.kind === 'pin' && question.image && (
          <img
            src={question.image}
            alt={question.targetName}
            className="landmark-photo"
          />
        )}
      </div>

      {question.kind === 'choice' ? (
        <>
          <ArcadeChoiceView
            question={question}
            phase={phase}
            feedback={s.feedback}
            onAnswer={s.answerChoice}
          />
          <div className="row">
            <div className="spacer" />
            <button type="button" className="pixel-btn" onClick={onExit}>
              Aufgeben
            </button>
          </div>
        </>
      ) : (
        <ArcadePinView
          question={question}
          phase={phase}
          resetKey={s.questionKey}
          pendingPin={pendingPin}
          feedback={s.feedback}
          nextReady={s.nextReady}
          onPin={setPendingPin}
          onConfirm={() => s.answerPin(pendingPin)}
          onNext={s.next}
          onExit={onExit}
        />
      )}
    </div>
  )
}

function ArcadeChoiceView({
  question,
  phase,
  feedback,
  onAnswer,
}: {
  question: Extract<Question, { kind: 'choice' }>
  phase: 'question' | 'feedback'
  feedback: ArcadeAnswerFeedback | null
  onAnswer: (i: number) => void
}) {
  const [chosenIndex, setChosenIndex] = useState<number | null>(null)

  useEffect(() => {
    if (phase === 'question') setChosenIndex(null)
  }, [phase, question.id])

  return (
    <div className="stack center">
      <h2 style={{ marginTop: 8 }}>{question.prompt}</h2>

      {question.mode === 'flags' && question.promptIso2 && (
        <div>
          <span className="flag-frame">
            <span className={`fi fi-${question.promptIso2.toLowerCase()}`} />
          </span>
        </div>
      )}

      {question.mode === 'outline' && question.promptIso2 && (
        <CountryOutline iso2={question.promptIso2} />
      )}

      {phase === 'feedback' && feedback && (
        <div className="score-pop glow-green" aria-live="polite">
          {feedback.points > 0 ? `+${feedback.points}` : 'DANEBEN!'}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {question.options.map((opt, i) => {
          let cls = 'pixel-btn'
          if (phase === 'feedback') {
            if (i === question.correctIndex) cls += ' pixel-btn--correct'
            else if (i === chosenIndex) cls += ' pixel-btn--wrong'
          }
          return (
            <button
              key={`${question.id}:${i}`}
              type="button"
              className={cls}
              disabled={phase === 'feedback'}
              onClick={() => {
                setChosenIndex(i)
                onAnswer(i)
              }}
            >
              <span className="dim" style={{ marginRight: 8 }}>
                {i + 1}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ArcadePinView({
  question,
  phase,
  resetKey,
  pendingPin,
  feedback,
  nextReady,
  onPin,
  onConfirm,
  onNext,
  onExit,
}: {
  question: Extract<Question, { kind: 'pin' }>
  phase: 'question' | 'feedback'
  resetKey: number
  pendingPin: PinAnswer | null
  feedback: ArcadeAnswerFeedback | null
  nextReady: boolean
  onPin: (p: PinAnswer) => void
  onConfirm: () => void
  onNext: () => void
  onExit: () => void
}) {
  const tier = feedback?.tier ?? null
  return (
    <div className="stack pin-question">
      <div className="pin-map-area">
        <MapPicker
          resetKey={resetKey}
          guess={pendingPin}
          revealTarget={phase === 'feedback' ? question.target : null}
          disabled={phase === 'feedback'}
          onPick={onPin}
        />
      </div>

      <div className="row pin-actions">
        {phase === 'question' ? (
          <>
            <button type="button" className="pixel-btn" onClick={onExit}>
              Aufgeben
            </button>
            <div className="spacer" />
            <button
              type="button"
              className="pixel-btn pixel-btn--primary"
              disabled={!pendingPin}
              onClick={onConfirm}
            >
              {pendingPin ? 'Bestätigen' : 'Setze einen Pin…'}
            </button>
          </>
        ) : (
          <>
            <div aria-live="polite" className="stack" style={{ gap: 2 }}>
              {tier && (
                <span
                  className={`display ${TIER_GLOW[tier.id] ?? ''}`}
                  style={{ fontSize: 14 }}
                >
                  {tier.label}
                </span>
              )}
              <span style={{ fontSize: 18 }}>
                {feedback?.distanceKm !== undefined ? (
                  <span className="dim">
                    {Math.round(feedback.distanceKm)} km daneben
                  </span>
                ) : (
                  <span className="dim">Kein Pin gesetzt!</span>
                )}{' '}
                <span className="glow-green">+{feedback?.points ?? 0}</span>
              </span>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="pixel-btn pixel-btn--cyan"
              disabled={!nextReady}
              onClick={onNext}
            >
              {nextReady ? 'Weiter ▶' : 'LADE…'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function ArcadeSummaryView({
  title,
  summary,
  onExit,
  onReplay,
}: {
  title: string
  summary: ArcadeSummary
  onExit: () => void
  onReplay?: () => void
}) {
  const accuracy =
    summary.questionCount > 0
      ? Math.round((100 * summary.correctCount) / summary.questionCount)
      : 0
  const rank =
    accuracy >= 90 && summary.questionCount >= 5
      ? 'S'
      : accuracy >= 75
        ? 'A'
        : accuracy >= 60
          ? 'B'
          : accuracy >= 40
            ? 'C'
            : 'D'
  const rankColor =
    rank === 'S'
      ? 'glow-yellow'
      : rank === 'A'
        ? 'glow-green'
        : rank === 'B'
          ? 'glow-cyan'
          : 'glow-pink'

  return (
    <div className="stack center">
      <h2>{title} — Ergebnis</h2>
      <div className={`display ${rankColor}`} style={{ fontSize: 72 }}>
        {rank}
      </div>
      <div className="display glow-yellow" style={{ fontSize: 28 }}>
        {summary.score} Punkte
      </div>
      <div className="dim">
        {summary.questionCount} Fragen · {summary.correctCount} Treffer ·
        beste Serie {formatStreak(summary.bestStreak)}
        {summary.timeAddedSeconds > 0 &&
          ` · +${summary.timeAddedSeconds} s geholt`}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {onReplay && (
          <button
            type="button"
            className="pixel-btn pixel-btn--primary"
            onClick={onReplay}
          >
            Nochmal
          </button>
        )}
        <button type="button" className="pixel-btn" onClick={onExit}>
          Menü
        </button>
      </div>
    </div>
  )
}
