import { BADGES, type BadgeId } from '../gamification/badgeCatalog'

/**
 * Avatar-Katalog (Feature-Idee R3): handgepixelte 8-Bit-Charaktere im Stil der
 * ersten Game-Boy-Rollenspiele. Jeder Avatar ist ein 16×16-Sprite, das aus
 * einem Zeichen-Raster in scharfe SVG-Rechtecke übersetzt wird — keine
 * Bilddateien, scharf auf jeder Größe, themeneutral.
 *
 * Menschliche Trainer teilen sich ein Basis-Gesicht (`BASE`) und bekommen
 * Frisur/Accessoire als Overlay-Ebene daraufgelegt; Roboter, Alien & Co. sind
 * eigenständige Sprites. Nur Junge/Mädchen sind Starter (immer wählbar, auch
 * als Gast); alle anderen schaltet man über eine aufsteigende Level-Kurve
 * (3–40) bzw. Erfolge/Pokal/Prestige frei — siehe DESIGN-AVATARS.md.
 */

export type AvatarUnlock =
  | { kind: 'starter' }
  | { kind: 'level'; level: number }
  | { kind: 'badge'; badgeId: BadgeId; tier?: number }
  | { kind: 'trophy' }
  /** Prestige: alle Abzeichen auf Diamant (Stufe 5). */
  | { kind: 'allDiamond' }
  /** Zeitlich befristetes Dankeschön (Phase I-Folge, Nutzer-Wunsch): wer bis
   *  zum Stichtag mindestens eine Runde/einen Cup gespielt hat, behält den
   *  Avatar für immer (`player_stats.beta_tester`, Migration 0015). */
  | { kind: 'betaTester' }

export interface AvatarSpec {
  id: string
  name: string
  unlock: AvatarUnlock
  /** Fertiges SVG-Markup (<rect>-Liste), gezeichnet auf 16×16. */
  body: string
}

export interface UnlockContext {
  level: number
  badgeTiers: ReadonlyMap<string, number>
  trophyCount: number
  isBetaTester: boolean
}

// --- Palette --------------------------------------------------------------
// Ein Zeichen je Farbe. '.' = transparent.

const P: Record<string, string> = {
  '0': '#12101f', // Umriss / Pupille
  W: '#f7f8ff', // Augenweiß / Glanz
  // Haut (hell + Schatten), zweite dunklere Hautvariante
  '1': '#ffd7a8',
  '2': '#e0a074',
  '3': '#c88a5a',
  '4': '#9c6038',
  q: '#e9e4ee', // blasse Haut (Vampir)
  Q: '#c7bcd0',
  // Haare
  B: '#8a5a2b',
  b: '#5c3418', // braun
  O: '#e8873a',
  o: '#b45f1e', // orange / gold-dunkel
  Y: '#f7d24a',
  y: '#c99a1e', // blond
  D: '#3a3550',
  d: '#26233a', // dunkel/schwarz
  // Metall
  w: '#cbced9',
  g: '#7f8398',
  // Kleidung / Akzente
  E: '#4aa8ff',
  e: '#245fc4', // blau
  K: '#ff9ecb',
  k: '#d75a95', // pink
  G: '#5ad06a',
  n: '#2c8f47', // grün
  M: '#a06be0',
  m: '#623aa0', // lila
  R: '#ff5566',
  r: '#c62a3a', // rot
  C: '#57efe0', // cyan
  J: '#ffe45a', // gelb/gold
  S: '#12183a', // navy (Sonnenbrille / Visier)
}

const WIDTH = 16

/** Zeichen-Raster (16 Zeilen) → SVG-Rechtecke, horizontal lauflängen-kodiert. */
function sprite(rows: string[]): string {
  const out: string[] = []
  for (let y = 0; y < WIDTH; y++) {
    const row = (rows[y] ?? '').padEnd(WIDTH, '.').slice(0, WIDTH)
    let x = 0
    while (x < WIDTH) {
      const ch = row[x]
      if (ch === '.' || !P[ch]) {
        x++
        continue
      }
      let run = 1
      while (x + run < WIDTH && row[x + run] === ch) run++
      out.push(
        `<rect x='${x}' y='${y}' width='${run}' height='1' fill='${P[ch]}'/>`,
      )
      x += run
    }
  }
  return out.join('')
}

// --- Basis-Gesicht (kahler Trainer-Kopf) ----------------------------------
// Platzhalter: '#'=Haut '%'=Hautschatten '@'=Shirt '&'=Shirtschatten.
// Frisuren-Overlays malen 'H'/'h' (Haar hell/dunkel) darüber.

const BASE: string[] = [
  '................',
  '................',
  '....00000000....',
  '...0########0...',
  '..0##########0..',
  '..0##########0..',
  '..0##########0..',
  '..0#WW####WW#0..',
  '..0#0W####W0#0..',
  '..0####%%####0..',
  '..0##########0..',
  '..0###%%%%###0..',
  '...0########0...',
  '.....0####0.....',
  '..0@@@@@@@@@@0..',
  '..0@&@@@@@@&@0..',
]

type Sub = Record<string, string>

/** Overlays über die Basis legen (spätere gewinnen), dann Platzhalter ersetzen. */
function compose(overlays: string[][], subs: Sub): string[] {
  return BASE.map((row, y) =>
    row
      .split('')
      .map((base, x) => {
        let ch = base
        for (const ov of overlays) {
          const o = ov[y]?.[x] ?? '.'
          if (o !== '.') ch = o
        }
        return subs[ch] ?? ch
      })
      .join(''),
  )
}

function human(subs: Sub, ...overlays: string[][]): string {
  return sprite(compose(overlays, subs))
}

// --- Frisuren / Accessoires (Overlays) ------------------------------------
// Haare als 'H'/'h'; Accessoires nutzen echte Palettenfarben direkt.

const HAIR_SHORT: string[] = [
  '................',
  '................',
  '....hhhhhhhh....',
  '...hHHHHHHHHh...',
  '..hHHHHHHHHHHh..',
  '..hHHH....HHHh..',
  '...H........H...',
]

const HAIR_LONG: string[] = [
  '................',
  '................',
  '....hhhhhhhh....',
  '...hHHHHHHHHh...',
  '..hHHHHHHHHHHh..',
  '..hHHH....HHHh..',
  '.hHH........HHh.',
  '.hH..........Hh.',
  '.hH..........Hh.',
  '.hH..........Hh.',
  '.hH..........Hh.',
  '.hHH........HHh.',
  '..hH........Hh..',
]

const HAIR_SPIKY: string[] = [
  '...H..H..H..H...',
  '..HH.HHH.HHH.HH.',
  '.hHHHHHHHHHHHHh.',
  '..hHHHHHHHHHHh..',
  '..hHHHHHHHHHHh..',
  '..hHHH....HHHh..',
  '...H........H...',
]

const CAP: string[] = [
  '................',
  '....RRRRRRRR....',
  '...RRRRRRRRRR...',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRRRr',
  '...r........r...',
]

const SHADES: string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...SSSS..SSSS...',
  '...SSSS..SSSS...',
]

const CROWN: string[] = [
  '................',
  '..J.J.J.J.J.J...',
  '..JJJJJJJJJJJ...',
  '..JRJJJRJJJRJ...',
]

const WIZHAT: string[] = [
  '.......MM.......',
  '......MMMM......',
  '......MmmM......',
  '.....MMJMMM.....',
  '.....MmmmmM.....',
  '....MMMMMMMM....',
  '..mMMMMMMMMMMm..',
]

const HEADBAND: string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..RRRRRRRRRRRR..',
  '..RrRRRRRRRRrR..',
]

// Superhelden-Maske: Domino-Maske um die Augen (Augen bleiben frei).
const MASK: string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...R..RRRR..R...',
  '...R..RRRR..R...',
]

// Gelbes Brust-Emblem auf dem Anzug (Superheld).
const EMBLEM: string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......JJ.......',
]

// Prinzessinnen-Tiara: goldenes Band mit pinkem Edelstein — sitzt aufs Haar.
const TIARA: string[] = [
  '................',
  '.....J..K..J....',
  '.....JJJJJJJ....',
]

// Vampir: glatt zurückgekämmtes Haar mit Witwenspitze auf der Stirn.
const VAMPHAIR: string[] = [
  '................',
  '................',
  '....hhhhhhhh....',
  '...hHHHHHHHHh...',
  '..hHHHHHHHHHHh..',
  '..hHHHHHHHHHHh..',
  '...H..HHHH..H...',
]

// Bauhelm des Geologen (gelb, mit Krempe) — sitzt über der Frisur.
const HARDHAT: string[] = [
  '................',
  '.....JJJJJJ.....',
  '....JJJJJJJJ....',
  '...JJoJJJJoJJ...',
  '..JJJJJJJJJJJJ..',
  '..oooooooooooo..',
]

// --- Eigenständige Sprites ------------------------------------------------

const ROBOT: string[] = [
  '.......00.......',
  '......0RR0......',
  '.......ww.......',
  '..000000000000..',
  '.0wwwwwwwwwwww0.',
  '.0wwwwwwwwwwww0.',
  '.0wwCCwwwwCCww0.',
  '.0wwCCwwwwCCww0.',
  '.0wwwwwwwwwwww0.',
  '.0wwwwwwwwwwww0.',
  '.0wwww0000wwww0.',
  '.0wwww0ww0wwww0.',
  '.0wwwwwwwwwwww0.',
  '..0wwwwwwwww0...',
  '..0RRRRRRRRRR0..',
  '..0RrRRRRRRrR0..',
]

const ROBOGIRL: string[] = [
  '.....CC..CC.....',
  '....CwwwwwwC....',
  '...wwwwwwwwww...',
  '..0wwwwwwwwww0..',
  '.0wwwwwwwwwwww0.',
  '.0wCCwwwwwwCCw0.',
  '.0wCCwwwwwwCCw0.',
  '.0wwwwwwwwwwww0.',
  '.0wwwwRRRRwwww0.',
  '.0wwwwwwwwwwww0.',
  '..0wwwwwwwwww0..',
  '...wwwwwwwwww...',
  '....Cww..wwC....',
  '..0MMMMMMMMMM0..',
  '..0MmMMMMMMmM0..',
  '..0MMMMMMMMMM0..',
]

const NINJA: string[] = [
  '................',
  '....dddddddd....',
  '...dDDDDDDDDd...',
  '..dDDDDDDDDDDd..',
  '..dDDDDDDDDDDd..',
  '..RRRRRRRRRRRR..',
  '..RrRRRRRRRRrR..',
  '..dD11111111Dd..',
  '..dD1WW11WW1Dd..',
  '..dD10W11W01Dd..',
  '..dDDDDDDDDDDd..',
  '..dDDDDDDDDDDd..',
  '...dDDDDDDDDd...',
  '....dddddddd....',
  '..0DDDDDDDDDD0..',
  '..0DdDDDDDDdD0..',
]

const ASTRO: string[] = [
  '................',
  '....wwwwwwww....',
  '..wwwwwwwwwwww..',
  '.wwwwwwwwwwwwww.',
  '.wwSSSSSSSSSSww.',
  '.wwSSCCSSSSSSww.',
  '.wwSSSSSSSSSSww.',
  '.wwSSSSSSSSSSww.',
  '.wwwwwwwwwwwwww.',
  '..wwwwwwwwwwww..',
  '...wwwwwwwwww...',
  '....wwwwwwww....',
  '................',
  '..0RRRRRRRRRR0..',
  '..0RrRRRRRRrR0..',
  '..0RRRRRRRRRR0..',
]

const KNIGHT: string[] = [
  '.......RR.......',
  '.......RR.......',
  '......RRRR......',
  '...wwwwwwwwww...',
  '..wwwwwwwwwwww..',
  '..wwwww00wwwww..',
  '..ww00000000ww..',
  '..ww0C0000C0ww..',
  '..wwwww00wwwww..',
  '..wwwww00wwwww..',
  '..wwwwwwwwwwww..',
  '..wwww0000wwww..',
  '...wwwwwwwwww...',
  '....wwwwwwww....',
  '..0wwwwwwwwww0..',
  '..0wggggggggw0..',
]

const ALIEN: string[] = [
  '..R..........R..',
  '..G..........G..',
  '...G........G...',
  '....GGGGGGGG....',
  '...GGGGGGGGGG...',
  '..GGGGGGGGGGGG..',
  '..GGGGGGGGGGGG..',
  '..GG000GG000GG..',
  '..GG000GG000GG..',
  '..GG000GG000GG..',
  '..GGGGGGGGGGGG..',
  '...GGGGGGGGGG...',
  '....GGGGGGGG....',
  '.....GGGGGG.....',
  '......GGGG......',
  '................',
]

// Kanarienvogel Sora: komplett orange, heller Bauch, gelber Schnabel.
const SORA: string[] = [
  '................',
  '.......oo.......',
  '.....OOOOOO.....',
  '....OOOOOOOO....',
  '...OOOOOOOOOO...',
  '...OO0OOOO0OO...',
  '...OOOOOOOOOO...',
  '....OOOJJOOO....',
  '.....OOJJOO.....',
  '..oOOOOOOOOOOo..',
  '.oOOOOOOOOOOOOo.',
  '.oOOWWWWWWWWOOo.',
  '.oOOWWWWWWWWOOo.',
  '..oOOOOOOOOOOo..',
  '....OOOOOOOO....',
  '.....JJ..JJ.....',
]

// Kanarienvogel Riku: gelb mit schwarzem Schopf und schwarzen Flügeln.
const RIKU: string[] = [
  '................',
  '.......DD.......',
  '.....YYYYYY.....',
  '....YYYYYYYY....',
  '...YYYYYYYYYY...',
  '...YY0YYYY0YY...',
  '...YYYYYYYYYY...',
  '....YYYOOYYY....',
  '.....YYOOYY.....',
  '..DYYYYYYYYYYD..',
  '.DDYYYYYYYYYYDD.',
  '.DDYWWWWWWWWYDD.',
  '.DDYWWWWWWWWYDD.',
  '..DYYYYYYYYYYD..',
  '....YYYYYYYY....',
  '.....OO..OO.....',
]

const DRAGON: string[] = [
  '..Y........Y....',
  '..oY......Yo....',
  '..oY......Yo....',
  '...nGGGGGGn.....',
  '..nGGGGGGGGn....',
  '..GGGGGGGGGG....',
  '..GJJGGGGJJG....',
  '..G0JGGGGJ0G....',
  '.nGGGGGGGGGGn...',
  '.GGGGGGGGGGGGn..',
  '.GG0nGGGG0nGGn..',
  '.nGGGGGGGGGGGn..',
  '..WGWGWGWGWGW...',
  '...nGGGGGGn.....',
  '....nnnnnn......',
  '................',
]

// Käfer ("Bug"): Beta-Tester-Dankeschön — schwarzer Kopf mit Fühlern, runder
// roter Rückenpanzer mit vier Punkten (ohne Mittelnaht, sonst wirkt es wie
// ein Gesicht), kleine Beinchen die seitlich rausschauen.
const BUG: string[] = [
  '................',
  '....0......0....',
  '.....0....0.....',
  '.....000000.....',
  '....00000000....',
  '...RRRRRRRRRR...',
  '..RRRRRRRRRRRR..',
  '.RR0RRRRRRRR0RR.',
  '.RRRRRRRRRRRRRR.',
  '.RR0RRRRRRRR0RR.',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '..0..RRRRRR..0..',
  '...0..RRRR..0...',
  '................',
]

const GHOST: string[] = [
  '....wwwwwwww....',
  '..wwwwwwwwwwww..',
  '.wwwwwwwwwwwwww.',
  '.wwwwwwwwwwwwww.',
  '.wwCCwwwwwwCCww.',
  '.wwCCwwwwwwCCww.',
  '.ww00wwwwww00ww.',
  '.wwwwwwwwwwwwww.',
  '.wwwwww00wwwwww.',
  '.wwwww0ww0wwwww.',
  '.wwwww0ww0wwwww.',
  '.wwwwww00wwwwww.',
  '.wwwwwwwwwwwwww.',
  '.wwwwwwwwwwwwww.',
  '.ww00ww00ww00ww.',
  '.w..ww..ww..ww..',
]

// --- Katalog --------------------------------------------------------------

const skinA = { '#': '1', '%': '2' }
const skinB = { '#': '3', '%': '4' }

export const AVATARS: readonly AvatarSpec[] = [
  {
    id: 'boy',
    name: 'Junge',
    unlock: { kind: 'starter' },
    body: human({ ...skinA, '@': 'E', '&': 'e', H: 'B', h: 'b' }, HAIR_SHORT),
  },
  {
    id: 'girl',
    name: 'Mädchen',
    unlock: { kind: 'starter' },
    body: human({ ...skinA, '@': 'K', '&': 'k', H: 'O', h: 'o' }, HAIR_LONG),
  },
  // --- Freischaltbar (aufsteigend nach benötigtem Level/Erfolg) ---
  {
    id: 'ninja',
    name: 'Ninja',
    unlock: { kind: 'level', level: 3 },
    body: sprite(NINJA),
  },
  {
    id: 'wizard',
    name: 'Magier',
    unlock: { kind: 'level', level: 6 },
    body: human({ ...skinA, '@': 'M', '&': 'm' }, WIZHAT),
  },
  {
    id: 'punk',
    name: 'Punk',
    unlock: { kind: 'level', level: 7 },
    body: human({ ...skinA, '@': 'D', '&': 'd', H: 'C', h: 'g' }, HAIR_SPIKY),
  },
  {
    id: 'cool',
    name: 'Cool',
    unlock: { kind: 'level', level: 8 },
    body: human({ ...skinB, '@': 'G', '&': 'n' }, CAP, SHADES),
  },
  {
    id: 'robot',
    name: 'Robo',
    unlock: { kind: 'level', level: 9 },
    body: sprite(ROBOT),
  },
  {
    id: 'knight',
    name: 'Ritter',
    unlock: { kind: 'level', level: 10 },
    body: sprite(KNIGHT),
  },
  {
    id: 'ghost',
    name: 'Geist',
    unlock: { kind: 'level', level: 12 },
    body: sprite(GHOST),
  },
  {
    id: 'sora',
    name: 'Sora',
    unlock: { kind: 'level', level: 14 },
    body: sprite(SORA),
  },
  {
    id: 'riku',
    name: 'Riku',
    unlock: { kind: 'level', level: 15 },
    body: sprite(RIKU),
  },
  {
    id: 'astro',
    name: 'Astronaut',
    unlock: { kind: 'level', level: 17 },
    body: sprite(ASTRO),
  },
  {
    id: 'robogirl',
    name: 'Cyra',
    unlock: { kind: 'level', level: 20 },
    body: sprite(ROBOGIRL),
  },
  {
    id: 'princess',
    name: 'Mira',
    unlock: { kind: 'level', level: 23 },
    body: human({ ...skinB, '@': 'K', '&': 'k', H: 'D', h: 'd' }, HAIR_LONG, TIARA),
  },
  {
    id: 'vampire',
    name: 'Vampir',
    unlock: { kind: 'level', level: 26 },
    body: human({ '#': 'q', '%': 'Q', '@': 'R', '&': 'r', H: 'D', h: 'd' }, VAMPHAIR),
  },
  {
    id: 'king',
    name: 'König',
    unlock: { kind: 'level', level: 30 },
    body: human({ ...skinA, '@': 'M', '&': 'm', H: 'B', h: 'b' }, HAIR_SHORT, CROWN),
  },
  {
    id: 'hero',
    name: 'Superheld',
    unlock: { kind: 'level', level: 34 },
    body: human({ ...skinA, '@': 'E', '&': 'e', H: 'D', h: 'd' }, HAIR_SHORT, MASK, EMBLEM),
  },
  {
    id: 'dragon',
    name: 'Drache',
    unlock: { kind: 'level', level: 40 },
    body: sprite(DRAGON),
  },
  {
    id: 'alien',
    name: 'Alien',
    unlock: { kind: 'badge', badgeId: 'globetrotter', tier: 1 },
    body: sprite(ALIEN),
  },
  {
    id: 'champion',
    name: 'Champion',
    unlock: { kind: 'trophy' },
    body: human({ ...skinB, '@': 'J', '&': 'o', H: 'D', h: 'd' }, HAIR_SHORT, HEADBAND),
  },
  {
    id: 'geologe',
    name: 'Geologe',
    unlock: { kind: 'allDiamond' },
    body: human({ '#': '1', '%': '2', '@': 'o', '&': '4', H: 'B', h: 'b' }, HAIR_SHORT, HARDHAT),
  },
  {
    id: 'bug',
    name: 'Bug',
    unlock: { kind: 'betaTester' },
    body: sprite(BUG),
  },
] as const

/**
 * Sortierschlüssel nach Freischalt-Schwierigkeit: Starter zuerst (0), dann
 * Level aufsteigend, dann Erfolg/Pokal/Prestige (unabhängig vom Level, daher
 * feste hohe Werte weit hinter dem Level-Cap von 99).
 */
function unlockKey(u: AvatarUnlock): number {
  switch (u.kind) {
    case 'starter':
      return 0
    case 'level':
      return u.level
    case 'badge':
      return 10000
    case 'trophy':
      return 20000
    case 'allDiamond':
      return 30000
    case 'betaTester':
      return 40000
  }
}

/**
 * Picker-Reihenfolge: Starter zuerst, dann aufsteigend nach Freischalt-
 * Schwierigkeit (Level, dann Erfolg/Pokal/Prestige). `AVATARS` ist bereits so
 * einsortiert — diese abgeleitete Liste ist der robuste Anzeige-Vertrag, falls
 * der Katalog künftig unsortiert erweitert wird.
 */
export const AVATARS_BY_LEVEL: readonly AvatarSpec[] = AVATARS.slice().sort((a, b) => {
  const ka = unlockKey(a.unlock)
  const kb = unlockKey(b.unlock)
  if (ka !== kb) return ka - kb
  return a.name.localeCompare(b.name)
})

export const AVATAR_BY_ID: ReadonlyMap<string, AvatarSpec> = new Map(
  AVATARS.map((a) => [a.id, a]),
)

export const DEFAULT_AVATAR_ID = 'boy'

export function avatarById(id: string): AvatarSpec {
  return AVATAR_BY_ID.get(id) ?? AVATARS[0]
}

export function isAvatarUnlocked(spec: AvatarSpec, ctx: UnlockContext): boolean {
  switch (spec.unlock.kind) {
    case 'starter':
      return true
    case 'level':
      return ctx.level >= spec.unlock.level
    case 'badge':
      return (ctx.badgeTiers.get(spec.unlock.badgeId) ?? 0) >= (spec.unlock.tier ?? 1)
    case 'trophy':
      return ctx.trophyCount >= 1
    case 'allDiamond':
      return BADGES.every((b) => (ctx.badgeTiers.get(b.id) ?? 0) >= 5)
    case 'betaTester':
      return ctx.isBetaTester
  }
}

export function unlockLabel(spec: AvatarSpec): string {
  switch (spec.unlock.kind) {
    case 'starter':
      return 'Startavatar'
    case 'level':
      return `Ab Level ${spec.unlock.level}`
    case 'badge':
      return 'Durch ein Abzeichen'
    case 'trophy':
      return 'Mit einem Pokal'
    case 'allDiamond':
      return 'Alle Abzeichen auf Diamant'
    case 'betaTester':
      return 'Beta-Tester — gespielt bis 31.08.2026'
  }
}
