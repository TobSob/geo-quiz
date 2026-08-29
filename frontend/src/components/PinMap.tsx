import { memo, useEffect, useRef, useState } from 'react'
import {
  config as maplibreConfig,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import basemapStyle from '../data/basemap-dark-nolabels.json'
import type { PinAnswer } from '../hooks/useQuizSession'
import { revealBounds, revealLngs } from '../features/geo/pinMapGeometry'

/**
 * MapLibre sucht seinen Worker über `new URL('./maplibre-gl-worker.mjs',
 * import.meta.url)`. Der Pfad ist zusammengesetzt und damit für Vite nicht
 * statisch analysierbar — die Datei landet **weder** im Dev-Prebundle
 * (`.vite/deps/`) **noch** im Produktions-Build. Ergebnis ohne diese Zeilen:
 * 404 auf den Worker, keine Kachel wird je geparst, die Karte bleibt
 * komplett schwarz (nur die `background`-Farbe des Styles). Kein
 * Konsolenfehler weist darauf hin.
 *
 * `?worker&url` lässt Vite den Worker als eigenen Eintrag bauen — inklusive
 * seines `./maplibre-gl-shared.mjs`-Imports, der bei einem blossen `?url`
 * seinerseits ins Leere liefe — und liefert die fertige URL.
 */
maplibreConfig.WORKER_URL = maplibreWorkerUrl

/**
 * WebGL-Kartenmotor des Pin-Modus (DESIGN-BASEMAP.md). Bewusst als eigener
 * Chunk hinter `lazy()` in `MapPicker`: `maplibre-gl` ist die mit Abstand
 * größte Abhängigkeit der App und der Pin-Modus ist einer von acht Modi — der
 * App-Start darf ihn nicht bezahlen (dieselbe Begründung wie beim
 * 50m-Topojson, DESIGN-OUTLINE-DETAIL.md #1).
 */

// Pixel-Marker als reines DOM — passt zum 8-Bit-Look und spart die
// Sprite-/Icon-Maschinerie von MapLibre.
// `box-sizing: border-box` bei 24 px entspricht exakt Leaflets altem
// divIcon (18 px Inhalt + 3 px Rahmen).
const GUESS_HTML =
  '<div style="width:24px;height:24px;box-sizing:border-box;background:#29adff;border:3px solid #000;box-shadow:2px 2px 0 #000"></div>'
const TARGET_HTML =
  '<div style="width:24px;height:24px;box-sizing:border-box;background:#00e756;border:3px solid #000;box-shadow:2px 2px 0 #000;transform:rotate(45deg)"></div>'

/**
 * MapLibre schreibt die Positions-`transform` direkt auf das übergebene
 * Element — der gedrehte Ziel-Marker braucht deshalb einen Wrapper, dessen
 * Kind die `rotate(45deg)` behalten darf.
 */
function markerElement(html: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.width = '24px'
  wrapper.style.height = '24px'
  wrapper.innerHTML = html
  return wrapper
}

/**
 * MapLibre rechnet Zoomstufen auf 512-px-Kacheln, Leaflet auf 256er: dieselbe
 * Darstellungsgröße liegt hier also eine Stufe niedriger. Die Werte unten sind
 * die 1:1-Entsprechungen der alten Leaflet-Stufen 2 / 2 / 10 / 5 / 4.
 */
const START_CENTER: [number, number] = [10, 25]
const START_ZOOM = 1
const MIN_ZOOM = 1
const MAX_ZOOM = 9
const REVEAL_MAX_ZOOM = 4
const REVEAL_FALLBACK_ZOOM = 3

const LINE_ID = 'reveal-line'

/** Grundabstand zum Rand, damit Marker nicht auf der Kante kleben. */
const EDGE_PADDING = 16
/** Kein Rand darf mehr als so viel der Karte fressen — sonst kippt fitBounds. */
const MAX_PADDING_RATIO = 0.35

/**
 * Im Handy-Vollbild liegen HUD-Leiste und Aktionsleiste **über** der Karte
 * (index.css, `@media (max-width: 900px), (pointer: coarse)`). `fitBounds`
 * kennt nur den Container und zentriert deshalb in die volle Fläche — der
 * Tipp-Marker landete beim Auflösen unter der Kopfleiste und war nicht mehr
 * zu sehen. Die Leisten sind je nach Modus verschieden hoch (Landmark-Foto!),
 * darum werden sie gemessen statt geschätzt.
 *
 * Auf dem Desktop überlappt nichts — dort fallen beide Werte auf 0 zurück und
 * der austarierte Auflöse-Zoom bleibt, wie er war.
 */
function overlayPadding(container: HTMLElement) {
  const map = container.getBoundingClientRect()
  let top = 0
  let bottom = 0
  for (const selector of ['.quiz-chrome', '.pin-actions']) {
    const overlay = document.querySelector(selector)
    if (!overlay) continue
    const box = overlay.getBoundingClientRect()
    if (box.height === 0) continue
    const overlapsTopHalf = box.top - map.top < map.height / 2
    if (overlapsTopHalf) top = Math.max(top, box.bottom - map.top)
    else bottom = Math.max(bottom, map.bottom - box.top)
  }
  const capV = map.height * MAX_PADDING_RATIO
  const capH = map.width * MAX_PADDING_RATIO
  const clamp = (value: number, cap: number) =>
    Math.min(Math.max(value, 0) + EDGE_PADDING, Math.max(cap, EDGE_PADDING))
  return {
    top: clamp(top, capV),
    bottom: clamp(bottom, capV),
    left: clamp(0, capH),
    right: clamp(0, capH),
  }
}

const EMPTY_LINE: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: [] },
}

export interface PinMapProps {
  resetKey: number
  guess: PinAnswer | null
  /** Target revealed only during feedback. */
  revealTarget: PinAnswer | null
  disabled: boolean
  onPick: (p: PinAnswer) => void
}

export const PinMap = memo(function PinMap({
  resetKey,
  guess,
  revealTarget,
  disabled,
  onPick,
}: PinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const guessMarker = useRef<Marker | null>(null)
  const targetMarker = useRef<Marker | null>(null)
  // Klick-Handler wird einmal registriert und liest den jeweils aktuellen
  // Stand über Refs — sonst müsste er bei jeder Frage neu gebunden werden.
  const disabledRef = useRef(disabled)
  const onPickRef = useRef(onPick)
  disabledRef.current = disabled
  onPickRef.current = onPick

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const instance = new MapLibreMap({
      container,
      style: basemapStyle as StyleSpecification,
      center: START_CENTER,
      zoom: START_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // Attribution rendert MapCredits als eigenes Element (DESIGN-MOBILE-POLISH.md #4).
      attributionControl: false,
    })
    // Eine schief gedrehte oder gekippte Weltkarte macht das Zielen nur
    // schwerer — im Quiz gibt es beides nicht.
    instance.dragRotate.disable()
    instance.touchZoomRotate.disableRotation()
    instance.keyboard.disableRotation()
    // Nur Desktop sichtbar — mobil verdeckten die Buttons die Action-Bar
    // unten links, und Pinch-Zoom deckt das ohnehin ab (CSS).
    instance.addControl(new NavigationControl({ showCompass: false }), 'bottom-left')

    instance.on('load', () => {
      instance.addSource(LINE_ID, { type: 'geojson', data: EMPTY_LINE })
      instance.addLayer({
        id: LINE_ID,
        type: 'line',
        source: LINE_ID,
        paint: {
          'line-color': '#ffec27',
          'line-width': 3,
          // Einheit ist die Linienbreite — 2.7 × 3 px ≈ die alten 8-px-Striche.
          'line-dasharray': [2.7, 2.7],
        },
      })
      setMap(instance)
    })

    // MapLibre misst seinen Container beim Anlegen. Im mobilen Vollbild wächst
    // er mit dem Viewport (v. a. beim Drehen) — ohne Neuvermessung verrutscht
    // die Karte gegenüber dem Rahmen.
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      guessMarker.current = null
      targetMarker.current = null
      setMap(null)
      instance.remove()
    }
  }, [])

  useEffect(() => {
    if (!map) return
    const handler = (e: MapMouseEvent) => {
      if (!disabledRef.current) onPickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map])

  /** Resets the world view when a new question starts. */
  useEffect(() => {
    if (!map) return
    map.jumpTo({ center: START_CENTER, zoom: START_ZOOM })
  }, [map, resetKey])

  // Tipp und Ziel gemeinsam auf dieselbe Weltkopie holen (kurzer Weg über die
  // Datumsgrenze, DESIGN-MAP-FIXES.md #1). Nur während des Auflösens (Tipp +
  // Ziel sichtbar); solange nur der blaue Tipp steht (Training vor
  // „Bestätigen"), bleibt er an seiner Roh-Longitude.
  const reveal = guess && revealTarget ? revealLngs(guess.lng, revealTarget.lng) : null
  const guessLng = reveal ? reveal.guessLng : (guess?.lng ?? 0)
  const revealTargetLng = reveal ? reveal.targetLng : (revealTarget?.lng ?? 0)

  useEffect(() => {
    if (!map) return
    if (!guess) {
      guessMarker.current?.remove()
      guessMarker.current = null
      return
    }
    const position: [number, number] = [guessLng, guess.lat]
    if (guessMarker.current) guessMarker.current.setLngLat(position)
    else {
      guessMarker.current = new Marker({ element: markerElement(GUESS_HTML) })
        .setLngLat(position)
        .addTo(map)
    }
  }, [map, guess, guessLng])

  useEffect(() => {
    if (!map) return
    if (!revealTarget) {
      targetMarker.current?.remove()
      targetMarker.current = null
      return
    }
    const position: [number, number] = [revealTargetLng, revealTarget.lat]
    if (targetMarker.current) targetMarker.current.setLngLat(position)
    else {
      targetMarker.current = new Marker({ element: markerElement(TARGET_HTML) })
        .setLngLat(position)
        .addTo(map)
    }
  }, [map, revealTarget, revealTargetLng])

  useEffect(() => {
    if (!map) return
    const source = map.getSource(LINE_ID) as GeoJSONSource | undefined
    if (!source) return
    source.setData(
      guess && revealTarget
        ? {
            ...EMPTY_LINE,
            geometry: {
              type: 'LineString',
              coordinates: [
                [guessLng, guess.lat],
                [revealTargetLng, revealTarget.lat],
              ],
            },
          }
        : EMPTY_LINE,
    )
  }, [map, guess, guessLng, revealTarget, revealTargetLng])

  /** Fits guess + target into view once the answer is revealed. */
  useEffect(() => {
    if (!map || !revealTarget) return
    if (guess) {
      const { sw, ne } = revealBounds(
        [guessLng, guess.lat],
        [revealTargetLng, revealTarget.lat],
      )
      map.fitBounds(new LngLatBounds(sw, ne), {
        // maxZoom deckelt den Auflöse-Zoom: ohne ihn zoomt fitBounds bei einem
        // Treffer nah am Ziel bis maxZoom (Straßenebene) — der harte
        // „Reinschieß"-Effekt (DESIGN-MAP-FIXES.md #3).
        maxZoom: REVEAL_MAX_ZOOM,
        padding: overlayPadding(map.getContainer()),
      })
    } else {
      map.easeTo({
        center: [revealTarget.lng, revealTarget.lat],
        zoom: REVEAL_FALLBACK_ZOOM,
      })
    }
    // `guessLng`/`revealTargetLng` leiten sich aus guess/revealTarget ab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, guess, revealTarget])

  return <div ref={containerRef} className="pin-map" />
})
