// App-Icon + Splash Screen im 8-Bit-Look (Phase B7, ROADMAP.md).
//
// Erzeugt die Quell-Grafiken für `@capacitor/assets generate --android` in
// frontend/assets/ — komplett prozedural (eigener PNG-Encoder, keine
// Dependencies), gleiche Philosophie wie der Avatar-Katalog: Pixel-Art als
// Code statt Binär-Assets, per Script reproduzierbar.
//
//   node scripts/generate-app-assets.mjs   (in frontend/)
//   npx @capacitor/assets generate --android
//
// Motiv: Pixel-Globus (Ozean = PICO-8-Blau wie "QUIZ", Land = PICO-8-Grün
// wie "GEO") + GEOQUIZ-Wordmark im 5×7-Pixel-Font auf dunklem Navy.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')

// ---- Palette (index.css / avatarCatalog.ts) --------------------------------
const BG_DEEP = [0x07, 0x06, 0x13, 255] // --bg-deep
const BG_PANEL = [0x1b, 0x19, 0x35, 255] // --panel (Icon-Hintergrund, etwas heller)
const GREEN = [0x00, 0xe7, 0x56, 255] // --green ("GEO", Landmassen)
const CYAN = [0x29, 0xad, 0xff, 255] // --cyan ("QUIZ", Ozean)
const OUTLINE = [0x12, 0x10, 0x1f, 255] // Avatar-Umrissfarbe
const WHITE = [0xf7, 0xf8, 0xff, 255] // Glanzlicht
const TRANSPARENT = [0, 0, 0, 0]

// ---- Minimaler PNG-Encoder (RGBA, Filter 0) --------------------------------

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // Bit-Tiefe
  ihdr[9] = 6 // RGBA
  // Kompression/Filter/Interlace = 0
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // Filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- Zeichenfläche ---------------------------------------------------------

class Canvas {
  constructor(size, fill = TRANSPARENT) {
    this.size = size
    this.data = Buffer.alloc(size * size * 4)
    if (fill[3] !== 0) {
      for (let i = 0; i < size * size; i++) fill.forEach((v, k) => (this.data[i * 4 + k] = v))
    }
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return
    const i = (y * this.size + x) * 4
    color.forEach((v, k) => (this.data[i + k] = v))
  }

  /** Gefülltes Rechteck (für skalierte "Pixel"-Zellen). */
  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color)
  }

  png() {
    return encodePng(this.size, this.size, this.data)
  }
}

// ---- Pixel-Globus (16×16, prozedural + Land-Overlay) -----------------------
// '.' = außerhalb, '0' = Umriss, 'e' = Ozean; das Land-Raster legt 'G' darüber.

const LAND = [
  '................',
  '................',
  '....GG...GGG....',
  '...GGGG.GGGGG...',
  '..GGGGG..GGGG...',
  '..GGGG...GGGGG..',
  '...GGG..GGGGG...',
  '...GG...GGGG....',
  '....GG..GGG.....',
  '....GGG..GG.....',
  '.....GG..GGG....',
  '....GG....GG....',
  '................',
  '................',
  '................',
  '................',
]

function globeGrid() {
  const grid = []
  const c = 7.5
  for (let y = 0; y < 16; y++) {
    const row = []
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - c, y - c)
      let cell = null
      if (d <= 6.6) cell = CYAN
      else if (d <= 7.9) cell = OUTLINE
      if (cell === CYAN && LAND[y][x] === 'G') cell = GREEN
      row.push(cell)
    }
    grid.push(row)
  }
  // Glanzlicht oben links (klassisches 8-Bit-Detail)
  grid[3][4] = WHITE
  grid[3][5] = WHITE
  grid[4][3] = WHITE
  return grid
}

/** 16×16-Raster mit Zellgröße `cell` zentriert um (cx, cy) zeichnen. */
function drawGrid(canvas, grid, cell, cx, cy) {
  const half = (16 * cell) / 2
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const color = grid[y][x]
      if (color) canvas.rect(cx - half + x * cell, cy - half + y * cell, cell, cell, color)
    }
}

// ---- 5×7-Pixel-Font (nur die Buchstaben des Wordmarks) ---------------------

const FONT = {
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
}

/** Wordmark zeichnen; `parts` = [{text, color}], zentriert um (cx, cy). */
function drawText(canvas, parts, cell, cx, cy) {
  const totalCols = parts.reduce((n, p) => n + p.text.length * 6, 0) - 1
  let col = 0
  const x0 = cx - Math.round((totalCols * cell) / 2)
  const y0 = cy - Math.round((7 * cell) / 2)
  for (const part of parts) {
    for (const ch of part.text) {
      const glyph = FONT[ch]
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy][gx] === '1')
            canvas.rect(x0 + (col + gx) * cell, y0 + gy * cell, cell, cell, part.color)
        }
      col += 6 // 5 Spalten + 1 Lücke
    }
  }
}

const WORDMARK = [
  { text: 'GEO', color: GREEN },
  { text: 'QUIZ', color: CYAN },
]

// ---- Assets ----------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })
const globe = globeGrid()

// Legacy-Icon (volle Fläche): Globus groß auf Panel-Navy
{
  const c = new Canvas(1024, BG_PANEL)
  drawGrid(c, globe, 56, 512, 512)
  writeFileSync(join(OUT_DIR, 'icon-only.png'), c.png())
}

// Adaptive-Icon-Ebenen: Vordergrund transparent (Safe Zone ~66 %), Hintergrund einfarbig
{
  const c = new Canvas(1024)
  drawGrid(c, globe, 38, 512, 512)
  writeFileSync(join(OUT_DIR, 'icon-foreground.png'), c.png())
}
{
  const c = new Canvas(1024, BG_PANEL)
  writeFileSync(join(OUT_DIR, 'icon-background.png'), c.png())
}

// Splash: Globus + Wordmark zentriert (Content bleibt in der Mitte, weil
// Android den Screen auf jedes Seitenverhältnis zuschneidet)
{
  const c = new Canvas(2732, BG_DEEP)
  drawGrid(c, globe, 34, 1366, 1180)
  drawText(c, WORDMARK, 16, 1366, 1690)
  const png = c.png()
  writeFileSync(join(OUT_DIR, 'splash.png'), png)
  // Das Spiel ist durchgehend dunkel — Dark-Variante identisch
  writeFileSync(join(OUT_DIR, 'splash-dark.png'), png)
}

console.log(`OK → ${OUT_DIR} (icon-only, icon-foreground, icon-background, splash, splash-dark)`)
