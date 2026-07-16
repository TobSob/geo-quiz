import { useEffect } from 'react'
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
        attributionControl
        zoomControl={false}
      >
        {/* No-labels basemap: place names would give the answer away. */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {/* Bottom-left: the fullscreen mobile layout overlays a top bar
            where the default control would sit. */}
        <ZoomControl position="bottomleft" />
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
