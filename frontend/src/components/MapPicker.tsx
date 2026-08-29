import { lazy, memo, Suspense, useState } from 'react'
import type { PinAnswer } from '../hooks/useQuizSession'

/**
 * `maplibre-gl` ist die größte Abhängigkeit der App und wird nur von einem der
 * acht Modi gebraucht — deshalb liegt der Kartenmotor in einem eigenen Chunk
 * (DESIGN-BASEMAP.md §4). Das Hauptmenü stößt das Laden über
 * `prefetchPinMap()` im Voraus an, damit die erste Pin-Frage nicht wartet.
 */
const PinMap = lazy(() => import('./PinMap').then((m) => ({ default: m.PinMap })))

let pinMapPromise: Promise<unknown> | null = null

/** Lädt den Kartenmotor vor. Idempotent, gefahrlos mehrfach aufrufbar. */
export function prefetchPinMap(): Promise<unknown> {
  pinMapPromise ??= import('./PinMap')
  return pinMapPromise
}

interface Props {
  resetKey: number
  guess: PinAnswer | null
  /** Target revealed only during feedback. */
  revealTarget: PinAnswer | null
  disabled: boolean
  onPick: (p: PinAnswer) => void
}

/**
 * `memo`, weil der Anzeige-Tick der Arcade-Session die Quiz-Ansicht 10×/s neu
 * rendert (useArcadeSession) — ohne das würde der ganze Kartenbaum mitlaufen.
 * Setzt voraus, dass `onPick` eine stabile Identität hat
 * (DESIGN-PERF-MOBILE.md, Befund 3).
 */
export const MapPicker = memo(function MapPicker(props: Props) {
  return (
    <div className="map-frame map-frame--pin">
      <Suspense fallback={<p className="dim center blink map-loading">LADE KARTE…</p>}>
        <PinMap {...props} />
      </Suspense>
      <MapCredits />
    </div>
  )
})

/**
 * Karten-Attribution als eigenes Element statt eines Karten-Controls
 * (DESIGN-MOBILE-POLISH.md #4): Desktop zeigt den Text dauerhaft unten
 * rechts, mobil klappt ihn ein ⓘ-Tap auf/zu — das alte Control saß unten
 * links und verdeckte Aufgeben-Button bzw. Feedback-Text der Action-Bar.
 * Liegt bewusst als Geschwister NEBEN dem Karten-Container: Taps hierauf
 * setzen keinen Pin.
 */
function MapCredits() {
  const [open, setOpen] = useState(false)
  return (
    <div className={`map-credits${open ? ' map-credits--open' : ''}`}>
      <span className="map-credits-panel">
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>{' '}
        &copy;{' '}
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">
          OpenMapTiles
        </a>{' '}
        &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>
      </span>
      <button
        type="button"
        className="map-credits-toggle"
        aria-label="Kartenquellen anzeigen"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        &#9432;
      </button>
    </div>
  )
}
