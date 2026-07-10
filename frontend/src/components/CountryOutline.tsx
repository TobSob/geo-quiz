import { memo } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'
import topo from '../data/world-atlas-110m.json'
import { countryByIso2 } from '../data'

interface Props {
  iso2: string
}

/** Zoom heuristic: small countries need more zoom to be visible at all. */
function zoomForArea(areaKm2: number): number {
  if (areaKm2 > 5_000_000) return 1.6
  if (areaKm2 > 1_000_000) return 2.4
  if (areaKm2 > 200_000) return 3.8
  if (areaKm2 > 50_000) return 5.5
  if (areaKm2 > 5_000) return 8
  return 12
}

export const CountryOutline = memo(function CountryOutline({ iso2 }: Props) {
  const country = countryByIso2(iso2)
  if (!country) return null
  const [lat, lng] = country.latlng
  const zoom = zoomForArea(country.area)

  return (
    <div className="map-frame" style={{ background: '#0e1a2e' }}>
      <ComposableMap
        width={800}
        height={420}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <ZoomableGroup
          center={[lng, lat]}
          zoom={zoom}
          minZoom={zoom}
          maxZoom={zoom}
          filterZoomEvent={() => false}
        >
          <Geographies geography={topo} className="outline-map">
            {({ geographies }) =>
              geographies.map((geo) => {
                const isTarget = String(geo.id) === country.ccn3
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isTarget ? '#ffec27' : '#1b1935'}
                    stroke={isTarget ? '#ff004d' : '#3a3565'}
                    strokeWidth={isTarget ? 0.8 : 0.4}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
})
