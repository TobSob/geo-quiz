import {
  RANK_EMOJI,
  type TrophyPeriod,
  type TrophyRank,
} from '../features/gamification/badgeCatalog'

/**
 * Pixel-Pokal (Phase I2, DESIGN-GAMIFICATION.md): Monats- und Jahrespokale
 * bekommen ein eigenes 16×16-Sprite statt der Medaillen-Emojis — gleiches
 * Verfahren wie der Avatar-Katalog (Zeichen-Raster → RLE-<rect>s), damit die
 * Optik auf jedem Gerät identisch ist. Wochenpokale bleiben 🥇/🥈/🥉.
 */

/** Zeichen-Raster des Pokals: 0=Umriss, C=Körper, c=Schatten, W=Glanz. */
const TROPHY_ROWS = [
  '................',
  '..000000000000..',
  '..0CCCCCCCCCC0..',
  '.00CWCCCCCCCC00.',
  '.0c0WCCCCCCC0c0.',
  '.0c0CCCCCCCC0c0.',
  '.0c0CCCCCCCC0c0.',
  '..00CCCCCCCC00..',
  '...0cCCCCCCc0...',
  '....0cCCCCc0....',
  '.....00CC00.....',
  '......0CC0......',
  '.....0CCCC0.....',
  '....00000000....',
  '...0CCCCCCCC0...',
  '...0000000000...',
] as const

/** Rang-Paletten: Gold / Silber / Bronze (PICO-8-nah, wie TIER_COLORS). */
const RANK_PALETTES: Record<TrophyRank, Record<string, string>> = {
  1: { '0': '#12101f', C: '#ffe45a', c: '#c99a1e', W: '#fff7c9' },
  2: { '0': '#12101f', C: '#c2c3c7', c: '#7f8398', W: '#ffffff' },
  3: { '0': '#12101f', C: '#e8873a', c: '#b45f1e', W: '#ffc37a' },
}

/** Raster → <rect>-Markup (RLE je Zeile), gecacht pro Rang. */
const bodyCache = new Map<TrophyRank, string>()

function trophyBody(rank: TrophyRank): string {
  const cached = bodyCache.get(rank)
  if (cached) return cached
  const palette = RANK_PALETTES[rank]
  const out: string[] = []
  for (let y = 0; y < 16; y++) {
    const row = TROPHY_ROWS[y]
    let x = 0
    while (x < 16) {
      const ch = row[x]
      if (ch === '.' || !palette[ch]) {
        x++
        continue
      }
      let run = 1
      while (x + run < 16 && row[x + run] === ch) run++
      out.push(
        `<rect x='${x}' y='${y}' width='${run}' height='1' fill='${palette[ch]}'/>`,
      )
      x += run
    }
  }
  const body = out.join('')
  bodyCache.set(rank, body)
  return body
}

/** Anzeige-Größen: Woche (Emoji) < Monat (kleiner Pokal) < Jahr (großer Pokal). */
const TROPHY_SYMBOL_SIZE: Record<TrophyPeriod, number> = {
  week: 22,
  month: 26,
  year: 36,
}

export function TrophyIcon({
  rank,
  size,
  title,
}: {
  rank: TrophyRank
  size: number
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? `Pokal Platz ${rank}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', flex: '0 0 auto' }}
      dangerouslySetInnerHTML={{ __html: trophyBody(rank) }}
    />
  )
}

/**
 * Das richtige Pokal-Symbol je Periode: Woche = Medaillen-Emoji,
 * Monat = kleiner Pixel-Pokal, Jahr = großer Pixel-Pokal.
 */
export function TrophySymbol({
  period,
  rank,
  size,
  title,
}: {
  period: TrophyPeriod
  rank: TrophyRank
  /** Überschreibt die periodenabhängige Standardgröße. */
  size?: number
  title?: string
}) {
  const px = size ?? TROPHY_SYMBOL_SIZE[period]
  if (period === 'week') {
    return (
      <span
        role="img"
        aria-label={title ?? `Medaille Platz ${rank}`}
        title={title}
        style={{ fontSize: px, lineHeight: 1, flex: '0 0 auto' }}
      >
        {RANK_EMOJI[rank - 1]}
      </span>
    )
  }
  return <TrophyIcon rank={rank} size={px} title={title} />
}
