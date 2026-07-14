import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameMode, SessionSummary } from '../features/quiz-engine/types'
import {
  completeLeg,
  CUP_MODES,
  cupScore,
  currentCupMode,
  isCupFinished,
  newCup,
  type CupState,
} from '../features/quiz-engine/cupSession'
import { CUP_LEG_SECONDS } from '../features/quiz-engine/arcadeScoring'
import { ArcadeQuizView } from '../components/ArcadeQuizView'
import { UnlockPanel } from '../components/UnlockPanel'
import { MODE_TITLES } from './PlayScreen'
import { useProgressStore } from '../state/progressStore'
import { useGamificationStore } from '../state/gamificationStore'
import { startPlaySession, submitCupRun } from '../api/scoreApi'
import type { UnlockPayload } from '../api/gamificationApi'
import { sfx } from '../features/audio/sfx'
import { flushProgress } from '../features/progress/progressSync'

type CupPhase = 'intro' | 'leg' | 'interstitial' | 'finished'

/** Seit Phase E: jede Disziplin ist ein 30-Sekunden-Arcade-Leg (DESIGN-ARCADE). */
export function CupScreen() {
  const navigate = useNavigate()
  const recordCup = useProgressStore((s) => s.recordCup)
  const [cup, setCup] = useState<CupState>(newCup)
  const [phase, setPhase] = useState<CupPhase>('intro')
  const [legKey, setLegKey] = useState(0)
  const [unlocks, setUnlocks] = useState<UnlockPayload | null>(null)

  const mode = currentCupMode(cup)

  useEffect(() => {
    if (phase === 'finished') sfx.fanfare()
  }, [phase])

  const onLegDone = useCallback(
    (summary: SessionSummary) => {
      setCup((c) => {
        const next = completeLeg(c, summary)
        if (isCupFinished(next)) {
          recordCup(cupScore(next), next.legs)
          // Unlock-Payload (Run + Legs gebündelt) fürs Endscreen-Panel.
          void submitCupRun(cupScore(next), next.legs).then((u) => {
            if (u) {
              useGamificationStore.getState().applyUnlock(u)
              setUnlocks(u)
            }
          })
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
    // Der GANZE Cup teilt sich ein Wanduhr-Konto (Anti-Cheat D1): nur beim
    // ersten Leg verankern — ein Reset je Leg würde die Summenprüfung der
    // am Ende gesammelt abgegebenen Legs zerschießen.
    if (cup.legIndex === 0) void startPlaySession()
    setLegKey((k) => k + 1)
    setPhase('leg')
  }

  const restart = () => {
    setCup(newCup())
    setLegKey((k) => k + 1)
    setUnlocks(null)
    setPhase('intro')
  }

  if (phase === 'intro') {
    return (
      <div className="stack center" style={{ gap: 24 }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <h1 className="glow-yellow">GEO CUP</h1>
        <p className="dim" style={{ maxWidth: 560, margin: '0 auto' }}>
          {CUP_MODES.length} Disziplinen, je {CUP_LEG_SECONDS} Sekunden:{' '}
          {CUP_MODES.map((m) => MODE_TITLES[m]).join(' → ')}. Beantworte so
          viele Fragen, wie du schaffst — Serien geben Multiplikator und
          Extra-Zeit. Am Ende zählt die Punktsumme aller Disziplinen.
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
          Zwischenstand: {cupScore(cup)} Punkte · Als Nächstes:{' '}
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
          {total} Punkte
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
                <td className="glow-yellow">{leg.score}</td>
                <td>
                  {leg.correctCount}/{leg.questionCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <UnlockPanel unlocks={unlocks} />
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
    <ArcadeQuizView
      key={`${cup.legIndex}-${legKey}`}
      mode={mode}
      budgetMs={CUP_LEG_SECONDS * 1000}
      title={`Cup ${cup.legIndex + 1}/${CUP_MODES.length}: ${MODE_TITLES[mode]}`}
      onDone={onLegDone}
      showSummary={false}
      onExit={() => navigate('/')}
    />
  )
}
