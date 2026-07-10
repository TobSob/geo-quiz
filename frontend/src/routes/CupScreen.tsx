import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameMode, SessionSummary } from '../features/quiz-engine/types'
import {
  completeLeg,
  CUP_MODES,
  CUP_QUESTIONS_PER_LEG,
  cupScore,
  currentCupMode,
  isCupFinished,
  newCup,
  type CupState,
} from '../features/quiz-engine/cupSession'
import { generateSession } from '../features/quiz-engine/questionGenerator'
import { dataBundle } from '../data'
import { QuizView } from '../components/QuizView'
import { MODE_TITLES } from './PlayScreen'
import { useProgressStore } from '../state/progressStore'
import { submitCupRun } from '../api/scoreApi'
import { flushProgress } from '../features/progress/progressSync'

type CupPhase = 'intro' | 'leg' | 'interstitial' | 'finished'

export function CupScreen() {
  const navigate = useNavigate()
  const recordCup = useProgressStore((s) => s.recordCup)
  const [cup, setCup] = useState<CupState>(newCup)
  const [phase, setPhase] = useState<CupPhase>('intro')
  const [legKey, setLegKey] = useState(0)

  const mode = currentCupMode(cup)

  const questions = useMemo(
    () => (mode ? generateSession(mode, dataBundle, CUP_QUESTIONS_PER_LEG) : []),
    [mode, legKey],
  )

  const onLegDone = useCallback(
    (summary: SessionSummary) => {
      setCup((c) => {
        const next = completeLeg(c, summary)
        if (isCupFinished(next)) {
          recordCup(cupScore(next), next.legs)
          void submitCupRun(cupScore(next), next.legs)
          void flushProgress()
          setPhase('finished')
        } else {
          setPhase('interstitial')
        }
        return next
      })
    },
    [recordCup],
  )

  const startNextLeg = () => {
    setLegKey((k) => k + 1)
    setPhase('leg')
  }

  const restart = () => {
    setCup(newCup())
    setLegKey((k) => k + 1)
    setPhase('intro')
  }

  if (phase === 'intro') {
    return (
      <div className="stack center" style={{ gap: 24 }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <h1 className="glow-yellow">GEO CUP</h1>
        <p className="dim" style={{ maxWidth: 560, margin: '0 auto' }}>
          {CUP_MODES.length} Disziplinen, je {CUP_QUESTIONS_PER_LEG} Fragen:{' '}
          {CUP_MODES.map((m) => MODE_TITLES[m]).join(' → ')}. Am Ende zählt die
          Gesamtwertung — 100 bedeutet perfekt.
        </p>
        <div>
          <button
            type="button"
            className="pixel-btn pixel-btn--primary"
            onClick={startNextLeg}
          >
            ▶ Start
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'interstitial') {
    const lastLeg = cup.legs[cup.legs.length - 1]
    const nextMode = currentCupMode(cup)
    return (
      <div className="stack center" style={{ gap: 20 }}>
        <h2 className="glow-cyan">
          Disziplin {cup.legIndex}/{CUP_MODES.length} geschafft!
        </h2>
        <div className="display glow-yellow" style={{ fontSize: 24 }}>
          +{lastLeg.score} Punkte
        </div>
        <p className="dim">
          Zwischenstand: {cupScore(cup)}/100 · Als Nächstes:{' '}
          {nextMode ? MODE_TITLES[nextMode] : ''}
        </p>
        <div>
          <button
            type="button"
            className="pixel-btn pixel-btn--primary"
            onClick={startNextLeg}
          >
            Weiter ▶
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'finished') {
    const total = cupScore(cup)
    return (
      <div className="stack center" style={{ gap: 20 }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <h1 className="glow-yellow">CUP BEENDET!</h1>
        <div className="display glow-green" style={{ fontSize: 48 }}>
          {total}/100
        </div>
        <table
          className="summary-table"
          style={{ maxWidth: 560, margin: '0 auto' }}
        >
          <thead>
            <tr>
              <th>Disziplin</th>
              <th>Punkte</th>
              <th>Richtig</th>
            </tr>
          </thead>
          <tbody>
            {cup.legs.map((leg) => (
              <tr key={leg.mode}>
                <td>{MODE_TITLES[leg.mode as GameMode]}</td>
                <td className="glow-yellow">
                  {leg.score}/{leg.maxPossible}
                </td>
                <td>
                  {leg.correctCount}/{leg.questionCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="pixel-btn pixel-btn--primary"
            onClick={restart}
          >
            Nochmal
          </button>
          <button type="button" className="pixel-btn" onClick={() => navigate('/')}>
            Menü
          </button>
        </div>
      </div>
    )
  }

  if (!mode) return null

  return (
    <QuizView
      key={`${cup.legIndex}-${legKey}`}
      mode={mode}
      questions={questions}
      title={`Cup ${cup.legIndex + 1}/${CUP_MODES.length}: ${MODE_TITLES[mode]}`}
      onDone={onLegDone}
      showSummary={false}
      onExit={() => navigate('/')}
    />
  )
}
