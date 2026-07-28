import { memo, useEffect, useState } from 'react'
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet'
import L from 'leaflet'
import type { PinAnswer } from '../hooks/useQuizSession'

// Pixel-style markers via divIcon — avoids bundler issues with Leaflet's
// default PNG icons and fits the 8-bit theme.
const guessIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;background:#29adff;border:3px solid #000;box-shadow:2px 2px 0 #000"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const targetIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;background:#00e756;border:3px solid #000;box-shadow:2px 2px 0 #000;transform:rotate(45deg)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function ClickCapture({
  onPick,
  disabled,
}: {
  onPick: (p: PinAnswer) => void
  disabled: boolean
}) {
  useMapEvents({
    click(e) {
      if (!disabled) onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

/**
 * Verschiebt `lng` um Vielfache von 360°, sodass es der Referenz-Longitude
 * am nächsten liegt (max. 180° Abstand). Ohne das zeichnet Leaflet Linie
 * und fitBounds beim Auflösen den *langen* Weg quer über die ganze Karte,
 * wenn Tipp und Ziel zwar geografisch nah, aber diesseits/jenseits der
 * ±180°-Naht liegen (z. B. Australien-Klick → Bora Bora): sah aus wie
 * „einmal um die Welt", obwohl der kurze Weg über die Datumsgrenze gemeint
 * ist. Die Haversine-Distanz war immer korrekt — nur die Darstellung nicht.
 */
const nearestLng = (lng: number, ref: number) =>
  lng + 360 * Math.round((ref - lng) / 360)

/**
 * Bringt Tipp- und Ziel-Longitude auf dieselbe Weltkopie (kurzer Weg über die
 * Datumsgrenze) UND verschiebt beide gemeinsam so, dass ihr Mittelpunkt in
 * (−180°, 180°] liegt. Ohne den zweiten Schritt ankerte das Ziel an der
 * Roh-Longitude des Tipps und konnte bei einem „komplett daneben"-Tipp auf der
 * Gegenseite jenseits der ±270°-`maxBounds` landen (z. B. Everest, Tipp in
 * Amerika → Ziel bei −273°): Marker und Linie lagen dann hinter der
 * unpannbaren Wand, der grüne Punkt war unerreichbar. Die Linienlänge hängt nur
 * von der Differenz ab — der gemeinsame Offset ändert die Darstellung nicht,
 * hält aber beide Enden im pannbaren Bereich (siehe DESIGN-MAP-FIXES.md #1).
 */
const revealLngs = (guessLng: number, targetLng: number) => {
  const near = nearestLng(targetLng, guessLng)
  const shift = -360 * Math.round((guessLng + near) / 2 / 360)
  return { guessLng: guessLng + shift, targetLng: near + shift }
}

/** Fits guess + target into view once the answer is revealed. */
function RevealView({
  guess,
  target,
}: {
  guess: PinAnswer | null
  target: PinAnswer | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    if (guess) {
      const lngs = revealLngs(guess.lng, target.lng)
      map.fitBounds(
        L.latLngBounds([guess.lat, lngs.guessLng], [target.lat, lngs.targetLng]).pad(0.4),
        // maxZoom deckelt den Auflöse-Zoom: ohne ihn zoomt fitBounds bei einem
        // Treffer nah am Ziel bis maxZoom (Straßenebene) — der harte
        // „Reinschieß"-Effekt (DESIGN-MAP-FIXES.md #3).
        { animate: true, maxZoom: 5 },
      )
    } else {
      map.setView([target.lat, target.lng], 4, { animate: true })
    }
  }, [map, guess, target])
  return null
}

/** Resets the world view when a new question starts. */
function ResetView({ resetKey }: { resetKey: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([25, 10], 2, { animate: false })
  }, [map, resetKey])
  return null
}

/**
 * Leaflet measures its container once on mount — in the fullscreen mobile
 * layout the container resizes with the viewport (esp. on device rotation),
 * so re-measure whenever that happens or tiles stay misaligned.
 */
function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])
  return null
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
const TILE_SUBDOMAINS = ['a', 'b', 'c']
// Leaflet's `{r}` always resolves to '@2x' on a retina display (regardless
// of the TileLayer's `detectRetina` option — that option controls a
// different half-size-tile trick). The live map on any modern phone
// requests @2x tiles, so prefetching plain 1x URLs would warm the cache
// for variants nothing ever asks for.
const RETINA_SUFFIX = typeof window !== 'undefined' && window.devicePixelRatio > 1 ? '@2x' : ''
/** Full-world prefetch range — covers the initial view (2) through the
 * zoom level most players reach while scanning for a region (5), before
 * the final close-in for precision where only a handful of new tiles are
 * needed anyway. 2+3+4+5 = 16+64+256+1024 = 1360 tiles world-wide. */
const PREFETCH_ZOOMS = [2, 3, 4, 5]

/** Gleichzeitig laufende Prefetch-Requests. Alle 1360 Kacheln auf einmal
 * loszutreten erzeugte beim Mount des ersten Pin-Legs eine CPU-Spitze von
 * 188 % einer Kernlast (DESIGN-PERF-MOBILE.md, Befund 4). Mit Warteschlange
 * bleibt das Volumen gleich, die Spitze verschwindet. */
const PREFETCH_CONCURRENCY = 6

let tilesPrefetched = false
// A prefetch `Image` with no surviving reference is fair game for the GC,
// which can abort the in-flight request before it loads — silently capping
// real-world completions at a few hundred instead of the full 1360. Die
// Referenz muss aber nur bis `load`/`error` halten: danach steht die Kachel
// im HTTP-Cache. (Früher blieben alle 1360 für die Lebensdauer der Seite
// liegen und belegten unnötig Speicher.)
const inFlight = new Set<HTMLImageElement>()

/** Warms the browser's HTTP cache for the entire world at the zoom levels
 * players actually pan/zoom through while hunting for a region, so panning
 * doesn't visibly re-fetch tiles. Runs once per page load, off the main
 * interaction path. (Earlier version only prefetched 5 rough continent
 * boxes at a single zoom — missed oceans, gaps between boxes, and the
 * lower zoom levels players start at; see DESIGN-PIN-UX.md.) */
function prefetchWorldTiles() {
  if (tilesPrefetched) return
  tilesPrefetched = true
  const run = () => {
    const urls: string[] = []
    let sub = 0
    for (const z of PREFETCH_ZOOMS) {
      const n = 2 ** z
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          const s = TILE_SUBDOMAINS[sub++ % TILE_SUBDOMAINS.length]
          urls.push(
            TILE_URL.replace('{s}', s)
              .replace('{z}', String(z))
              .replace('{x}', String(x))
              .replace('{y}', String(y))
              .replace('{r}', RETINA_SUFFIX),
          )
        }
      }
    }
    let next = 0
    const startOne = () => {
      if (next >= urls.length) return
      const img = new Image()
      inFlight.add(img)
      const done = () => {
        inFlight.delete(img)
        startOne() // Platz in der Warteschlange wird sofort nachbesetzt.
      }
      img.onload = done
      img.onerror = done
      img.src = urls[next++]
    }
    for (let i = 0; i < PREFETCH_CONCURRENCY; i++) startOne()
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 5000 })
  } else {
    setTimeout(run, 1000)
  }
}

interface Props {
  resetKey: number
  guess: PinAnswer | null
  /** Target revealed only during feedback. */
  revealTarget: PinAnswer | null
  disabled: boolean
  onPick: (p: PinAnswer) => void
}

/** Nord/Süd hart begrenzt (kein Abdriften ins Nichts jenseits der Pole);
 * Ost/West bewusst weiter gefasst als eine Weltbreite, damit `worldCopyJump`
 * beim Überqueren der ±180°-Naht weiter nahtlos zurückspringen kann. */
const MAP_BOUNDS: [[number, number], [number, number]] = [
  [-85, -270],
  [85, 270],
]

/**
 * `memo`, weil der Anzeige-Tick der Arcade-Session die Quiz-Ansicht 10×/s neu
 * rendert (useArcadeSession) — ohne das würde der ganze Leaflet-Baum mitlaufen
 * und `ClickCapture` seine Map-Handler 10×/s neu registrieren. Setzt voraus,
 * dass `onPick` eine stabile Identität hat (DESIGN-PERF-MOBILE.md, Befund 3).
 */
export const MapPicker = memo(function MapPicker({
  resetKey,
  guess,
  revealTarget,
  disabled,
  onPick,
}: Props) {
  useEffect(() => {
    prefetchWorldTiles()
  }, [])
  // Tipp und Ziel gemeinsam auf dieselbe, im pannbaren Bereich liegende
  // Weltkopie holen (kurzer Weg über die Datumsgrenze, grüner Punkt erreichbar
  // — DESIGN-MAP-FIXES.md #1). Nur während des Auflösens (Tipp + Ziel sichtbar);
  // solange nur der blaue Tipp steht (Training vor „Bestätigen"), bleibt er an
  // seiner Roh-Longitude.
  const reveal =
    guess && revealTarget ? revealLngs(guess.lng, revealTarget.lng) : null
  const guessLng = reveal ? reveal.guessLng : (guess?.lng ?? 0)
  const revealTargetLng = reveal ? reveal.targetLng : (revealTarget?.lng ?? 0)
  return (
    <div className="map-frame map-frame--pin">
      <MapContainer
        center={[25, 10]}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        maxBounds={MAP_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        worldCopyJump
        attributionControl={false}
        zoomControl={false}
      >
        {/* No-labels basemap: place names would give the answer away.
            Attribution rendert MapCredits unten (eigenes Element statt
            Leaflet-Control, DESIGN-MOBILE-POLISH.md #4). */}
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" />
        {/* Nur Desktop sichtbar — mobil verdeckten die Buttons die
            Action-Bar unten links, und Pinch-Zoom deckt das ohnehin ab. */}
        <ZoomControl position="bottomleft" />
        <ClickCapture onPick={onPick} disabled={disabled} />
        <ResetView resetKey={resetKey} />
        <InvalidateOnResize />
        {guess && <Marker position={[guess.lat, guessLng]} icon={guessIcon} />}
        {revealTarget && (
          <Marker position={[revealTarget.lat, revealTargetLng]} icon={targetIcon} />
        )}
        {guess && revealTarget && (
          <Polyline
            positions={[
              [guess.lat, guessLng],
              [revealTarget.lat, revealTargetLng],
            ]}
            pathOptions={{ color: '#ffec27', weight: 3, dashArray: '8 8' }}
          />
        )}
        {revealTarget && <RevealView guess={guess} target={revealTarget} />}
      </MapContainer>
      <MapCredits />
    </div>
  )
})

/**
 * OSM/CARTO-Attribution als eigenes Element statt Leaflets Control
 * (DESIGN-MOBILE-POLISH.md #4): Desktop zeigt den Text dauerhaft unten
 * rechts, mobil klappt ihn ein ⓘ-Tap auf/zu — das alte Control saß unten
 * links und verdeckte Aufgeben-Button bzw. Feedback-Text der Action-Bar.
 * Liegt bewusst als Geschwister NEBEN dem Leaflet-Container: Taps hierauf
 * setzen keinen Pin.
 */
function MapCredits() {
  const [open, setOpen] = useState(false)
  return (
    <div className={`map-credits${open ? ' map-credits--open' : ''}`}>
      <span className="map-credits-panel">
        &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        &copy;{' '}
        <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">
          CARTO
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
