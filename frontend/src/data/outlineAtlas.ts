import { feature } from 'topojson-client'
import type { Feature, FeatureCollection } from 'geojson'

let atlasPromise: Promise<Feature[]> | null = null

/**
 * Lädt das 50m-Topojson des Umriss-Modus als eigenen Chunk (~236 KB gzip).
 * Bewusst kein statischer Import: der Umriss ist einer von acht Modi, seine
 * Auflösung darf den App-Start nicht kosten (DESIGN-OUTLINE-DETAIL.md #1).
 * Idempotent — das Hauptmenü stößt den Ladevorgang im Voraus an, damit die
 * erste Umriss-Frage nicht mehr wartet.
 */
export function prefetchOutlineAtlas(): Promise<Feature[]> {
  atlasPromise ??= import('./world-atlas-50m.json').then((mod) => {
    const topo = mod.default as unknown as { objects: { countries: unknown } }
    const fc = feature(
      topo as never,
      topo.objects.countries as never,
    ) as unknown as FeatureCollection
    return fc.features
  })
  return atlasPromise
}
