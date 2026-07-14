import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameMode, SessionSummary } from '../features/quiz-engine/types'
import { ArcadeQuizView } from '../components/ArcadeQuizView'
import { useProgressStore } from '../state/progressStore'
import { useGamificationStore } from '../state/gamificationStore'
import { startPlaySession, submitScore } from '../api/scoreApi'
import type { UnlockPayload } from '../api/gamificationApi'
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
  const [unlocks, setUnlocks] = useState<UnlockPayload | null>(null)

  const mode = (VALID_MODES.has(modeParam ?? '') ? modeParam : null) as GameMode | null

  // Rundenstart serverseitig verankern (Anti-Cheat D1) — je Runde und Replay.
  // Nebenbei alte Unlocks verwerfen (z. B. nach Modus-Wechsel per Navigation).
  useEffect(() => {
    setUnlocks(null)
    if (mode) void startPlaySession()
  }, [mode, runKey])

  const onDone = useCallback(
    (summary: SessionSummary) => {
      // Abgebrochene Runden ohne eine einzige Antwort nicht verewigen.
      if (summary.questionCount === 0) return
      recordSession(summary)
      // Offline/Gast liefert null — dann bleibt nur der lokale Rekord.
      void submitScore(summary).then((u) => {
        if (u) {
          useGamificationStore.getState().applyUnlock(u)
          setUnlocks(u)
        }
      })
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
      unlocks={unlocks}
      onExit={() => navigate('/')}
      onReplay={() => {
        setUnlocks(null)
        setRunKey((k) => k + 1)
      }}
    />
  )
}
