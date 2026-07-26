import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameMode } from '../features/quiz-engine/types'
import { quizPool } from '../features/quiz-engine/questionGenerator'
import { makeForcedSource } from '../features/quiz-engine/arcadeSession'
import { cities, countries, dataBundle, landmarks, outlineDataBundle } from '../data'
import { ArcadeQuizView } from '../components/ArcadeQuizView'
import { MODE_TITLES } from './PlayScreen'

/**
 * Dev-Werkzeug (DESIGN-DEV-ROUND.md): stellt eine echte Arcade-Runde aus
 * selbst gewählten Items zusammen — um Grenzfälle wie „Bora Bora, kurz über
 * die Datumsgrenze" reproduzierbar zu testen. Nur im Dev-Build erreichbar
 * (Route + Menü-Link hängen an `import.meta.env.DEV`); meldet keinen Score ab.
 */

const MODE_OPTIONS: GameMode[] = [
  'landmark-pin',
  'city-pin',
  'flags',
  'countries',
  'capitals',
  'outline',
]

interface Item {
  key: string
  label: string
}

/** Wählbare Items für einen Modus — Schlüssel passt zu `generateQuestion(forcedKey)`. */
function itemsForMode(mode: GameMode): Item[] {
  let items: Item[]
  if (mode === 'city-pin') {
    items = cities.map((c) => ({ key: c.id, label: `${c.name} · ${c.countryIso2}` }))
  } else if (mode === 'landmark-pin') {
    items = landmarks.map((l) => ({ key: l.id, label: `${l.name} · ${l.countryIso2}` }))
  } else {
    const pool = quizPool(mode === 'outline' ? outlineDataBundle.countries : countries)
    items = pool.map((c) => ({ key: c.iso2, label: `${c.nameDe} · ${c.iso2}` }))
  }
  return items.sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

export function DevScreen() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<GameMode>('landmark-pin')
  const [filter, setFilter] = useState('')
  const [playlist, setPlaylist] = useState<string[]>([])
  const [runKey, setRunKey] = useState(0)
  const [playing, setPlaying] = useState(false)

  const items = useMemo(() => itemsForMode(mode), [mode])
  const labelByKey = useMemo(
    () => new Map(items.map((i) => [i.key, i.label])),
    [items],
  )

  // Modus-Wechsel: Playlist verwerfen (Schlüssel gehören zum alten Modus).
  useEffect(() => {
    setPlaylist([])
    setFilter('')
  }, [mode])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const base = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items
    return base.slice(0, 200)
  }, [items, filter])

  if (playing) {
    return (
      <DevRound
        key={runKey}
        mode={mode}
        keys={playlist}
        onExit={() => setPlaying(false)}
        onReplay={() => setRunKey((k) => k + 1)}
      />
    )
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stack center" style={{ gap: 4 }}>
        <h2 className="glow-cyan" style={{ margin: 0 }}>
          🛠️ DEV — Erzwungene Runde
        </h2>
        <p className="dim center" style={{ margin: 0, fontSize: 13 }}>
          Items in die Playlist legen (Duplikate erlaubt) und als echte
          Arcade-Runde spielen. Timer läuft nur während der Frage — das
          aufgelöste Ergebnis lässt sich beliebig lange ansehen.
        </p>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="label">MODUS</span>
        {MODE_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={`pixel-btn${m === mode ? ' pixel-btn--cyan' : ''}`}
            onClick={() => setMode(m)}
          >
            {MODE_TITLES[m]}
          </button>
        ))}
      </div>

      {/* Playlist */}
      <div className="stack" style={{ gap: 6 }}>
        <span className="label">
          PLAYLIST ({playlist.length})
        </span>
        {playlist.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            Noch leer — unten Items anklicken zum Hinzufügen.
          </p>
        ) : (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {playlist.map((key, idx) => (
              <button
                key={`${key}:${idx}`}
                type="button"
                className="pixel-btn"
                title="Aus Playlist entfernen"
                onClick={() =>
                  setPlaylist((p) => p.filter((_, i) => i !== idx))
                }
              >
                {idx + 1}. {labelByKey.get(key) ?? key} ✕
              </button>
            ))}
            <button
              type="button"
              className="pixel-btn pixel-btn--danger"
              onClick={() => setPlaylist([])}
            >
              Alles leeren
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="pixel-btn pixel-btn--primary"
        disabled={playlist.length === 0}
        onClick={() => {
          setRunKey((k) => k + 1)
          setPlaying(true)
        }}
      >
        ▶ Runde starten ({playlist.length})
      </button>

      {/* Item-Auswahl */}
      <div className="stack" style={{ gap: 6 }}>
        <input
          type="text"
          placeholder="Suchen… (z. B. Bora)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            background: 'var(--bg-deep)',
            color: 'var(--ink)',
            border: '4px solid var(--shadow)',
            padding: '8px 10px',
            width: '100%',
          }}
        />
        <div
          className="stack"
          style={{
            gap: 4,
            maxHeight: 320,
            overflowY: 'auto',
            border: '2px solid #000',
            padding: 8,
          }}
        >
          {filtered.map((i) => (
            <button
              key={i.key}
              type="button"
              className="pixel-btn"
              style={{ textAlign: 'left' }}
              onClick={() => setPlaylist((p) => [...p, i.key])}
            >
              ＋ {i.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="dim" style={{ margin: 0 }}>
              Nichts gefunden.
            </p>
          )}
        </div>
      </div>

      <div className="row">
        <div className="spacer" />
        <button type="button" className="pixel-btn" onClick={() => navigate('/')}>
          ◀ Menü
        </button>
      </div>
    </div>
  )
}

/**
 * Eine Dev-Runde. Die erzwungene Quelle wird pro Mount einmal erzeugt (der
 * Zähler in `makeForcedSource` ist zustandsbehaftet); „Nochmal" mountet über
 * den `key` in `DevScreen` neu und setzt sie damit zurück.
 */
function DevRound({
  mode,
  keys,
  onExit,
  onReplay,
}: {
  mode: GameMode
  keys: string[]
  onExit: () => void
  onReplay: () => void
}) {
  const source = useMemo(() => {
    const data = mode === 'outline' ? outlineDataBundle : dataBundle
    return makeForcedSource(mode, data, keys)
  }, [mode, keys])

  return (
    <ArcadeQuizView
      mode={mode}
      title={`DEV · ${MODE_TITLES[mode]}`}
      sourceOverride={source}
      // Kein Score-Abgeben: Dev-Runde verfälscht Progress/Leaderboard nicht.
      onDone={() => {}}
      onExit={onExit}
      onReplay={onReplay}
    />
  )
}
