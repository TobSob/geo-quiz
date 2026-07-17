import { useEffect } from 'react'
import {
  AttributionControl,
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
      map.fitBounds(
        L.latLngBounds([guess.lat, guess.lng], [target.lat, target.lng]).pad(0.4),
        { animate: true },
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

let tilesPrefetched = false
// A prefetch `Image` with no surviving reference is fair game for the GC,
// which can abort the in-flight request before it loads — silently capping
// real-world completions at a few hundred instead of the full 1360. Keeping
// them all alive for the page's lifetime is what makes the prefetch actually
// finish.
const keepAlive: HTMLImageElement[] = []

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
    let sub = 0
    for (const z of PREFETCH_ZOOMS) {
      const n = 2 ** z
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          const s = TILE_SUBDOMAINS[sub++ % TILE_SUBDOMAINS.length]
          const url = TILE_URL.replace('{s}', s)
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y))
            .replace('{r}', RETINA_SUFFIX)
          const img = new Image()
          img.src = url
          keepAlive.push(img)
        }
      }
    }
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

export function MapPicker({ resetKey, guess, revealTarget, disabled, onPick }: Props) {
  useEffect(() => {
    prefetchWorldTiles()
  }, [])
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
        {/* No-labels basemap: place names would give the answer away. */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {/* Both bottom-left, paired with zoom: the primary action button
            (Bestätigen/Weiter) lives bottom-right in the floating mobile
            action bar, and attribution's external link was getting fat-
            fingered mid-game. "Aufgeben" (left) is tapped rarely, so any
            stray taps land somewhere low-stakes instead. */}
        <ZoomControl position="bottomleft" />
        <AttributionControl position="bottomleft" prefix={false} />
        <ClickCapture onPick={onPick} disabled={disabled} />
        <ResetView resetKey={resetKey} />
        <InvalidateOnResize />
        {guess && <Marker position={[guess.lat, guess.lng]} icon={guessIcon} />}
        {revealTarget && (
          <Marker position={[revealTarget.lat, revealTarget.lng]} icon={targetIcon} />
        )}
        {guess && revealTarget && (
          <Polyline
            positions={[
              [guess.lat, guess.lng],
              [revealTarget.lat, revealTarget.lng],
            ]}
            pathOptions={{ color: '#ffec27', weight: 3, dashArray: '8 8' }}
          />
        )}
        {revealTarget && <RevealView guess={guess} target={revealTarget} />}
      </MapContainer>
    </div>
  )
}
