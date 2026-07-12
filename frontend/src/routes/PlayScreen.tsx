import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameMode, SessionSummary } from '../features/quiz-engine/types'
import { ArcadeQuizView } from '../components/ArcadeQuizView'
import { useProgressStore } from '../state/progressStore'
import { submitScore } from '../api/scoreApi'
import { flushProgress } from '../features/progress/progressSync'

export const MODE_TITLES: Record<GameMode, string> = {
  flags: 'Flaggen',
  countries: 'Länder',
  capitals: 'Hauptstädte',
  outline: 'Umrisse',
  'city-pin': 'Städte-Pin',
  'landmark-pin': 'Landmark-Pin',
}

const VALID_MODES = new Set(Object.keys(MODE_TITLES))

/** Einzelmodi laufen seit Phase E zeitbasiert (60 s, DESIGN-ARCADE.md). */
export function PlayScreen() {
  const { mode: modeParam } = useParams()
  const navigate = useNavigate()
  const recordSession = useProgressStore((s) => s.recordSession)
  const [runKey, setRunKey] = useState(0)

  const mode = (VALID_MODES.has(modeParam ?? '') ? modeParam : null) as GameMode | null

  const onDone = useCallback(
    (summary: SessionSummary) => {
      // Abgebrochene Runden ohne eine einzige Antwort nicht verewigen.
      if (summary.questionCount === 0) return
      recordSession(summary)
      // fire-and-forget: offline failures leave the local record intact
      void submitScore(summary)
      void flushProgress()
    },
    [recordSession],
  )

  if (!mode) {
    navigate('/')
    return null
  }

  return (
    <ArcadeQuizView
      // Mode-Wechsel & Replay erzwingen eine frische Session (neuer Timer!)
      key={`${mode}:${runKey}`}
      mode={mode}
      title={MODE_TITLES[mode]}
      onDone={onDone}
      onExit={() => navigate('/')}
      onReplay={() => setRunKey((k) => k + 1)}
    />
  )
}
