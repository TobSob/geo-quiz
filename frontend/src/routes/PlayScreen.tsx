import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameMode, SessionSummary } from '../features/quiz-engine/types'
import { generateSession } from '../features/quiz-engine/questionGenerator'
import { dataBundle, outlineDataBundle } from '../data'
import { QuizView } from '../components/QuizView'
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

const QUESTIONS_PER_SESSION = 10

const VALID_MODES = new Set(Object.keys(MODE_TITLES))

export function PlayScreen() {
  const { mode: modeParam } = useParams()
  const navigate = useNavigate()
  const recordSession = useProgressStore((s) => s.recordSession)
  const [runKey, setRunKey] = useState(0)

  const mode = (VALID_MODES.has(modeParam ?? '') ? modeParam : null) as GameMode | null

  const questions = useMemo(
    () =>
      mode
        ? generateSession(
            mode,
            mode === 'outline' ? outlineDataBundle : dataBundle,
            QUESTIONS_PER_SESSION,
          )
        : [],
    // runKey re-rolls the questions on replay
    [mode, runKey],
  )

  const onDone = useCallback(
    (summary: SessionSummary) => {
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
    <QuizView
      key={runKey}
      mode={mode}
      questions={questions}
      title={MODE_TITLES[mode]}
      onDone={onDone}
      onExit={() => navigate('/')}
      onReplay={() => setRunKey((k) => k + 1)}
    />
  )
}
