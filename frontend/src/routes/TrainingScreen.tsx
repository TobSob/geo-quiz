import { useCallback, useRef, useState } from 'react'
import { AdaptiveSampler } from '../features/quiz-engine/adaptiveSampler'
import {
  deterministicId,
  questionFromId,
  quizPool,
} from '../features/quiz-engine/questionGenerator'
import type { GameMode, Question } from '../features/quiz-engine/types'
import { cities, countries, dataBundle, landmarks, outlineRenderableIso2 } from '../data'
import { QuizView } from '../components/QuizView'
import { MODE_TITLES } from './PlayScreen'
import { useProgressStore } from '../state/progressStore'

/** Reihenfolge der Kategorien im Setup (deckt sich mit dem Home-Menü). */
const TRAINING_MODES: readonly GameMode[] = [
  'flags',
  'capitals',
  'countries',
  'outline',
  'city-pin',
  'landmark-pin',
]

const MODE_ICONS: Record<GameMode, string> = {
  flags: '🚩',
  capitals: '🏛️',
  countries: '🌍',
  outline: '🗺️',
  'city-pin': '📍',
  'landmark-pin': '🗿',
}

/** Länge einer Trainings-Session; 0 = endlos (kein Limit). */
const LENGTH_OPTIONS = [
  { value: 0, label: '∞ Endlos' },
  { value: 10, label: '10 Fragen' },
  { value: 25, label: '25 Fragen' },
] as const

interface RunConfig {
  modes: GameMode[]
  limit: number
  /** Neustart-Zähler — erzwingt einen frischen Sampler bei „Nochmal". */
  key: number
}

/** Alle abfragbaren Fragen-IDs der gewählten Kategorien — das Universum des Samplers. */
function questionUniverse(modes: ReadonlySet<GameMode>): string[] {
  const ids: string[] = []
  const wantsCountryMode =
    modes.has('flags') ||
    modes.has('capitals') ||
    modes.has('countries') ||
    modes.has('outline')
  if (wantsCountryMode) {
    for (const c of quizPool(countries)) {
      if (modes.has('flags')) ids.push(deterministicId('flags', c.iso2))
      if (modes.has('capitals')) ids.push(deterministicId('capitals', c.iso2))
      if (modes.has('countries')) ids.push(deterministicId('countries', c.iso2))
      if (modes.has('outline') && outlineRenderableIso2.has(c.iso2)) {
        ids.push(deterministicId('outline', c.iso2))
      }
    }
  }
  if (modes.has('city-pin')) {
    for (const city of cities) ids.push(deterministicId('city-pin', city.id))
  }
  if (modes.has('landmark-pin')) {
    for (const lm of landmarks) ids.push(deterministicId('landmark-pin', lm.id))
  }
  return ids
}

export function TrainingScreen() {
  const [config, setConfig] = useState<RunConfig | null>(null)

  if (!config) {
    return (
      <TrainingSetup
        onStart={(modes, limit) => setConfig({ modes, limit, key: 0 })}
      />
    )
  }

  return (
    <TrainingRun
      key={config.key}
      config={config}
      onReplay={() => setConfig((c) => (c ? { ...c, key: c.key + 1 } : c))}
      // „Aufgeben"/„Menü" führen zurück ins Trainings-Setup (Home liegt im Header).
      onExit={() => setConfig(null)}
    />
  )
}

function TrainingSetup({
  onStart,
}: {
  onStart: (modes: GameMode[], limit: number) => void
}) {
  const answeredCount = useProgressStore((s) => Object.keys(s.progressById).length)
  const [selected, setSelected] = useState<Set<GameMode>>(
    () => new Set(TRAINING_MODES),
  )
  const [limit, setLimit] = useState(0)

  const toggle = (m: GameMode) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })

  const allSelected = selected.size === TRAINING_MODES.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(TRAINING_MODES))

  const canStart = selected.size > 0

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="center">
        <h2 className="glow-pink" style={{ marginBottom: 6 }}>
          🎯 Training
        </h2>
        <p className="dim" style={{ margin: 0 }}>
          Üben ohne Zeitdruck. Was du noch nie hattest oder oft falsch machst,
          kommt öfter dran.
        </p>
        <p className="dim" style={{ marginTop: 6, fontSize: 14 }}>
          {answeredCount} Fragen bereits im Lernverlauf.
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <div className="row">
          <span className="display glow-cyan" style={{ fontSize: 11 }}>
            KATEGORIEN
          </span>
          <div className="spacer" />
          <button
            type="button"
            className="pixel-btn"
            style={{ fontSize: 11 }}
            onClick={toggleAll}
          >
            {allSelected ? 'Keine' : 'Alle'}
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          {TRAINING_MODES.map((m) => {
            const on = selected.has(m)
            return (
              <button
                key={m}
                type="button"
                className={`pixel-btn${on ? ' pixel-btn--primary' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(m)}
              >
                <span style={{ marginRight: 8 }}>{MODE_ICONS[m]}</span>
                {MODE_TITLES[m]}
                <span className="dim" style={{ marginLeft: 8 }}>
                  {on ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <span className="display glow-cyan" style={{ fontSize: 11 }}>
          LÄNGE
        </span>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {LENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pixel-btn${limit === opt.value ? ' pixel-btn--primary' : ''}`}
              aria-pressed={limit === opt.value}
              onClick={() => setLimit(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button
          type="button"
          className="pixel-btn pixel-btn--primary"
          disabled={!canStart}
          onClick={() => onStart([...selected], limit)}
        >
          {canStart ? '▶ Training starten' : 'Wähle eine Kategorie…'}
        </button>
      </div>
    </div>
  )
}

function TrainingRun({
  config,
  onReplay,
  onExit,
}: {
  config: RunConfig
  onReplay: () => void
  onExit: () => void
}) {
  // Sampler genau einmal je Lauf aufbauen — mit dem Lernstand von jetzt.
  const samplerRef = useRef<AdaptiveSampler | null>(null)
  if (!samplerRef.current) {
    const progress = useProgressStore.getState().progressById
    samplerRef.current = new AdaptiveSampler(
      questionUniverse(new Set(config.modes)),
      new Map(Object.entries(progress)),
    )
  }

  const produceNext = useCallback((): Question | null => {
    const sampler = samplerRef.current!
    // Der Sampler liefert IDs; sehr selten scheitert die Rekonstruktion — dann
    // die nächste ID versuchen statt aufzugeben.
    for (let i = 0; i < 200; i++) {
      const id = sampler.nextQuestionId()
      const q = questionFromId(id, dataBundle)
      if (q) return q
    }
    return null
  }, [])

  const label =
    config.modes.length === TRAINING_MODES.length
      ? 'Training'
      : `Training (${config.modes.length} Kat.)`

  return (
    <div className="stack">
      <p className="dim center" style={{ margin: 0, fontSize: 13 }}>
        🎯 Adaptiv · {config.limit > 0 ? `${config.limit} Fragen` : 'endlos'} ·
        „Aufgeben" beendet jederzeit
      </p>
      <QuizView
        mode="training"
        questions={[]}
        produceNext={produceNext}
        limit={config.limit || undefined}
        title={label}
        onDone={() => {}}
        onExit={onExit}
        onReplay={onReplay}
      />
    </div>
  )
}
