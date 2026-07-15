import { useEffect, useRef, useState } from 'react'
import type {
  GameMode,
  Question,
  SessionSummary,
} from '../features/quiz-engine/types'
import { useQuizSession, type PinAnswer } from '../hooks/useQuizSession'
import { TimerBar } from './TimerBar'
import { StreakBadge } from './StreakBadge'
import { CountryOutline } from './CountryOutline'
import { MapPicker } from './MapPicker'

const CHOICE_FEEDBACK_MS = 1500

interface Props {
  mode: GameMode | 'training'
  questions: Question[]
  title: string
  /** Called once when the session completes (before the summary is dismissed). */
  onDone: (summary: SessionSummary) => void
  /** Render the built-in summary screen (standalone modes). Cup renders its own. */
  showSummary?: boolean
  /** Streaming source (Training): yields questions endlessly until `limit`. */
  produceNext?: () => Question | null
  /** Cap a streamed session to this many questions (0/undefined = endless). */
  limit?: number
  onExit: () => void
  onReplay?: () => void
}

export function QuizView({
  mode,
  questions,
  title,
  onDone,
  showSummary = true,
  produceNext,
  limit,
  onExit,
  onReplay,
}: Props) {
  const session = useQuizSession(mode, questions, { produceNext, limit })
  // Training übt ohne Zeitdruck (Playtest-Feedback R3): kein Frage-Timer.
  const untimed = mode === 'training'
  const {
    question,
    index,
    total,
    phase,
    score,
    streak,
    feedback,
    summary,
    questionKey,
    answerChoice,
    answerPin,
    next,
  } = session

  const [pendingPin, setPendingPin] = useState<PinAnswer | null>(null)
  const doneReported = useRef(false)

  // Report completion exactly once.
  useEffect(() => {
    if (phase === 'done' && !doneReported.current) {
      doneReported.current = true
      onDone(summary)
    }
  }, [phase, summary, onDone])

  // Auto-advance after choice feedback; pin feedback waits for the button.
  useEffect(() => {
    if (phase !== 'feedback' || question?.kind !== 'choice') return
    const t = setTimeout(next, CHOICE_FEEDBACK_MS)
    return () => clearTimeout(t)
  }, [phase, question, next])

  // Reset pin when a new question starts.
  useEffect(() => {
    setPendingPin(null)
  }, [questionKey])

  // Keyboard shortcuts 1-4 for choice options.
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
      <SummaryView
        title={title}
        summary={summary}
        onExit={onExit}
        onReplay={onReplay}
      />
    )
  }

  if (!question) return null

  return (
    <div className={question.kind === 'pin' ? 'stack quiz-screen--pin' : 'stack quiz-screen--choice'}>
      {/* Chrome (HUD, timer, pin prompt/photo) is a plain pass-through on
          desktop; in the fullscreen pin layout it becomes the translucent
          top bar overlaying the map. */}
      <div className="quiz-chrome">
        <div className="quiz-chrome-main">
          <div className="hud">
            <div className="hud-stat">
              <span className="label">MODUS</span>
              <span className="glow-cyan">{title}</span>
            </div>
            <div className="hud-stat">
              <span className="label">FRAGE</span>
              {total > 0 ? `${index + 1}/${total}` : index + 1}
            </div>
            <div className="hud-stat">
              <span className="label">SCORE</span>
              <span className="glow-yellow">{score}</span>
            </div>
            <StreakBadge streak={streak} />
          </div>

          {!untimed && (
            <TimerBar
              resetKey={questionKey}
              timeLimitMs={question.timeLimitMs}
              running={phase === 'question'}
              onTimeout={() =>
                question.kind === 'choice' ? answerChoice(null) : answerPin(pendingPin)
              }
            />
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
          <ChoiceQuestionView
            question={question}
            phase={phase}
            chosenIndex={feedback?.chosenIndex ?? null}
            lastScore={feedback?.result.score ?? 0}
            onAnswer={answerChoice}
          />
          <div className="row">
            <div className="spacer" />
            <button type="button" className="pixel-btn" onClick={onExit}>
              Aufgeben
            </button>
          </div>
        </>
      ) : (
        <PinQuestionView
          question={question}
          phase={phase}
          resetKey={questionKey}
          pendingPin={pendingPin}
          feedbackScore={feedback?.result.score ?? 0}
          distanceKm={feedback?.result.distanceKm}
          onPin={setPendingPin}
          onConfirm={() => answerPin(pendingPin)}
          onNext={next}
          onExit={onExit}
        />
      )}
    </div>
  )
}

function ChoiceQuestionView({
  question,
  phase,
  chosenIndex,
  lastScore,
  onAnswer,
}: {
  question: Extract<Question, { kind: 'choice' }>
  phase: 'question' | 'feedback'
  chosenIndex: number | null
  lastScore: number
  onAnswer: (i: number) => void
}) {
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

      {phase === 'feedback' && (
        <div className="score-pop glow-green" aria-live="polite">
          {lastScore > 0 ? `+${lastScore}` : 'DANEBEN!'}
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
              onClick={() => onAnswer(i)}
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

function PinQuestionView({
  question,
  phase,
  resetKey,
  pendingPin,
  feedbackScore,
  distanceKm,
  onPin,
  onConfirm,
  onNext,
  onExit,
}: {
  question: Extract<Question, { kind: 'pin' }>
  phase: 'question' | 'feedback'
  resetKey: number
  pendingPin: PinAnswer | null
  feedbackScore: number
  distanceKm: number | undefined
  onPin: (p: PinAnswer) => void
  onConfirm: () => void
  onNext: () => void
  onExit: () => void
}) {
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
            <div aria-live="polite">
              <span className="display glow-yellow" style={{ fontSize: 14 }}>
                {distanceKm !== undefined
                  ? `${Math.round(distanceKm)} km daneben`
                  : 'Kein Pin gesetzt!'}
              </span>{' '}
              <span className="display glow-green" style={{ fontSize: 14, marginLeft: 10 }}>
                +{feedbackScore}
              </span>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="pixel-btn pixel-btn--cyan"
              onClick={onNext}
            >
              Weiter ▶
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function SummaryView({
  title,
  summary,
  onExit,
  onReplay,
}: {
  title: string
  summary: SessionSummary
  onExit: () => void
  onReplay?: () => void
}) {
  const pct =
    summary.maxPossible > 0
      ? Math.round((100 * summary.score) / summary.maxPossible)
      : 0
  const rank =
    pct >= 90 ? 'S' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D'
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
        {summary.correctCount}/{summary.questionCount} richtig · beste Serie{' '}
        {summary.bestStreak} · {pct} % von perfekt
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
