import type { GameMode } from '../quiz-engine/types'

/**
 * Badge-Katalog (Phase G, DESIGN-GAMIFICATION.md): Anzeige-Copy und
 * Schwellen-Spiegel. Quelle der Wahrheit für die Schwellen ist der Seed in
 * supabase/migrations/0008_gamification.sql (badge_definitions) — der
 * Katalog-Test pinnt die Werte gegen Drift. Vergeben wird serverseitig;
 * hier lebt nur, was der Spieler sieht: Namen, Emojis und die Sprüche je
 * Stufe (jede Stufe hat ihren eigenen — Nutzer-Wunsch).
 */

export type BadgeTier = 1 | 2 | 3 | 4 | 5

export const TIER_NAMES = ['Normal', 'Bronze', 'Silber', 'Gold', 'Diamant'] as const

/** Stufen-Farben auf der PICO-8-Palette (index.css). */
export const TIER_COLORS: readonly string[] = [
  '#ffffff', // Normal
  'var(--orange)', // Bronze
  '#c2c3c7', // Silber (PICO-8 hellgrau)
  'var(--yellow)', // Gold
  'var(--cyan)', // Diamant
]

/** XP je freigeschalteter Badge-Stufe — Spiegel der Serverwerte (0008). */
export const BADGE_TIER_XP = [25, 50, 100, 250, 500] as const

/** XP für den Cup-Abschluss — Spiegel der Serverwerte (0008). */
export const CUP_FINISH_XP = 50

export type TrophyPeriod = 'week' | 'month' | 'year'

export type TrophyRank = 1 | 2 | 3

/** XP je Pokal nach Rang (Platz 1/2/3) — Spiegel der Serverwerte (0009). */
export const TROPHY_XP: Record<TrophyPeriod, readonly [number, number, number]> = {
  week: [200, 100, 50],
  month: [500, 250, 125],
  year: [1500, 750, 375],
}

export const TROPHY_PERIOD_LABELS: Record<TrophyPeriod, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
}

/** 🥇/🥈/🥉 nach Rang (Index rank−1). */
export const RANK_EMOJI = ['🥇', '🥈', '🥉'] as const

/** „Wochenbester" für Platz 1, sonst „Woche · Platz 2/3". */
export function trophyTitle(period: TrophyPeriod, rank: TrophyRank): string {
  if (rank === 1) {
    return { week: 'Wochenbester', month: 'Monatsbester', year: 'Jahresbester' }[period]
  }
  return `${TROPHY_PERIOD_LABELS[period]} · Platz ${rank}`
}

export type BadgeId =
  | 'globetrotter'
  | 'besserwisser'
  | 'punktesauger'
  | 'dauerzocker'
  | 'highscorer'
  | 'serientaeter'
  | 'sniper'
  | 'cupkaempfer'
  | 'stammgast'
  | 'pokalregal'
  | 'flaggen_fan'
  | 'kontinental'
  | 'hauptstadt_held'
  | 'silhouetten'
  | 'staedte_sniper'
  | 'landmark_magier'

export interface BadgeSpec {
  id: BadgeId
  name: string
  emoji: string
  /** Metrik wie im SQL-Seed: player_stats-Spalte oder `mode_correct:<mode>`. */
  metric: string
  /** Lesbare Beschreibung der Metrik für die Fortschrittszeile. */
  metricLabel: string
  /** Aufsteigend: Normal, Bronze, Silber, Gold, Diamant. */
  thresholds: readonly [number, number, number, number, number]
  /** Ein Spruch je Stufe. */
  subtitles: readonly [string, string, string, string, string]
}

export const BADGES: readonly BadgeSpec[] = [
  {
    id: 'globetrotter',
    name: 'Weltenbummler',
    emoji: '🌍',
    metric: 'questions_answered',
    metricLabel: 'beantwortete Fragen',
    thresholds: [50, 250, 1000, 5000, 20000],
    subtitles: [
      'Einmal um den Block.',
      'Der Reisepass hat erste Stempel.',
      'Einmal um den Globus, bitte.',
      'Du kennst Länder, die dein Atlas nicht kennt.',
      'Die Erde ruft an: Sie will ihren Job zurück.',
    ],
  },
  {
    id: 'besserwisser',
    name: 'Besserwisser',
    emoji: '🧠',
    metric: 'questions_correct',
    metricLabel: 'richtige Antworten',
    thresholds: [25, 150, 750, 3000, 12000],
    subtitles: [
      'Du hattest recht. Zufall?',
      'Du hattest recht. Schon wieder.',
      'Klugscheißen ist jetzt offiziell ein Hobby.',
      'Das wandelnde Lexikon.',
      'Google fragt inzwischen dich.',
    ],
  },
  {
    id: 'punktesauger',
    name: 'Punkte-Staubsauger',
    emoji: '🧹',
    metric: 'total_points',
    metricLabel: 'Gesamtpunkte',
    thresholds: [10000, 50000, 250000, 1000000, 5000000],
    subtitles: [
      'Krümel? Nein. Punkte. Alle.',
      'Saugt zuverlässig jede Punktedecke leer.',
      'Beutel voll. Weitersaugen.',
      'PUNKTE-MILLIONÄR! Der Automat weint.',
      'Es gibt nichts mehr zu holen. Du holst trotzdem.',
    ],
  },
  {
    id: 'dauerzocker',
    name: 'Dauerzocker',
    emoji: '🕹️',
    metric: 'rounds_played',
    metricLabel: 'gespielte Runden',
    thresholds: [10, 50, 200, 1000, 5000],
    subtitles: [
      'Nur noch EINE Runde. Ehrlich.',
      'Okay, noch ZEHN Runden. Letztes Angebot.',
      'Dein Daumen hat jetzt Muskelkater.',
      'Der Highscore-Bildschirm kennt dich beim Vornamen.',
      'Der Automat zahlt dir langsam Miete.',
    ],
  },
  {
    id: 'highscorer',
    name: 'Highscore-Jäger',
    emoji: '🚀',
    metric: 'solo_best_score',
    metricLabel: 'beste Einzelrunde',
    thresholds: [1500, 2500, 3500, 4500, 6000],
    subtitles: [
      'Warmgespielt.',
      'Die Tastatur glüht leicht.',
      'Streak-Maschine im Serienbetrieb.',
      'Fast schon unheimlich.',
      'Bitte einmal die Hände zeigen. Nur zur Kontrolle.',
    ],
  },
  {
    id: 'serientaeter',
    name: 'Serientäter',
    emoji: '⚡',
    metric: 'best_streak',
    metricLabel: 'längste Streak',
    thresholds: [5, 10, 15, 20, 30],
    subtitles: [
      'Combo!',
      'Combo! Combo!',
      'C-C-C-COMBO!',
      'Die Streak-Anzeige braucht mehr Stellen.',
      'Fehler sind für dich nur ein Gerücht.',
    ],
  },
  {
    id: 'sniper',
    name: 'Pixel-Sniper',
    emoji: '🎯',
    metric: 'volltreffer_count',
    metricLabel: 'Volltreffer',
    thresholds: [10, 50, 250, 1000, 5000],
    subtitles: [
      'Zielwasser genippt.',
      'Zielwasser: literweise.',
      'Trifft Städte mit verbundenen Augen.',
      'Das Fadenkreuz ist reine Deko.',
      'GPS fragt dich nach dem Weg.',
    ],
  },
  {
    id: 'cupkaempfer',
    name: 'Cup-Kämpfer',
    emoji: '🏆',
    metric: 'cup_count',
    metricLabel: 'beendete Cups',
    thresholds: [1, 10, 50, 250, 1000],
    subtitles: [
      'Sechs Disziplinen, null Gnade.',
      'Der Pokal kennt deinen Händedruck.',
      'Sechskampf ist dein Cardio.',
      'Cup-Modus? Du nennst es Feierabend.',
      'Der Cup hat jetzt Angst vor DIR.',
    ],
  },
  {
    id: 'stammgast',
    name: 'Stammgast',
    emoji: '📅',
    metric: 'play_days',
    metricLabel: 'Spieltage',
    thresholds: [3, 14, 60, 180, 365],
    subtitles: [
      'Man sieht sich wieder!',
      'Der Automat hat dich vermisst.',
      'Dein Stammplatz ist reserviert.',
      'Halbes Jahr, ganzes Herz.',
      '365 Tage. Die Erde hat eine Runde gedreht — du auch.',
    ],
  },
  {
    id: 'pokalregal',
    name: 'Pokal-Regal',
    emoji: '🏅',
    metric: 'trophy_count',
    metricLabel: 'gewonnene Pokale',
    thresholds: [1, 3, 10, 25, 60],
    subtitles: [
      'Der erste Pokal. Noch glänzt er.',
      'Ein Brett reicht nicht mehr.',
      'Staubwedel nicht vergessen.',
      'Statiker wegen Regal-Last kontaktiert.',
      'Das Regal ist jetzt ein Museum.',
    ],
  },
  {
    id: 'flaggen_fan',
    name: 'Flaggen-Fanatiker',
    emoji: '🚩',
    metric: 'mode_correct:flags',
    metricLabel: 'richtige in Flaggen',
    thresholds: [25, 100, 500, 2000, 10000],
    subtitles: [
      'Streifen? Sterne? Alles klar.',
      'Du winkst zurück.',
      'Du träumst in Fahnenstoff.',
      'Vexillologe ehrenhalber.',
      'Flaggen hissen sich vor dir von selbst.',
    ],
  },
  {
    id: 'kontinental',
    name: 'Kontinental-Kenner',
    emoji: '🗺️',
    metric: 'mode_correct:countries',
    metricLabel: 'richtige in Länder',
    thresholds: [25, 100, 500, 2000, 10000],
    subtitles: [
      'Grenzen? Grob bekannt.',
      'Der Atlas nickt anerkennend.',
      'Du liest Landkarten wie Comics.',
      'Kein Land bleibt unerkannt.',
      'Die UNO holt sich bei dir Rat.',
    ],
  },
  {
    id: 'hauptstadt_held',
    name: 'Hauptstadt-Held',
    emoji: '🏛️',
    metric: 'mode_correct:capitals',
    metricLabel: 'richtige in Hauptstädte',
    thresholds: [25, 100, 500, 2000, 10000],
    subtitles: [
      'Paris, London — läuft.',
      'Auch Bern statt Zürich. Respekt.',
      'Naypyidaw. Ohne zu googeln.',
      'Jede Hauptstadt grüßt zurück.',
      'Bürgermeister kennen DICH.',
    ],
  },
  {
    id: 'silhouetten',
    name: 'Silhouetten-Seher',
    emoji: '👁️',
    metric: 'mode_correct:outline',
    metricLabel: 'richtige in Umrisse',
    thresholds: [25, 100, 500, 2000, 10000],
    subtitles: [
      'Der Stiefel war einfach. Zugegeben.',
      'Umrisse sind dein Sudoku.',
      'Erkennt Länder am Schattenriss.',
      'Schattenspiele auf Weltniveau.',
      'Dir reicht ein Pixel Küstenlinie.',
    ],
  },
  {
    id: 'staedte_sniper',
    name: 'Städte-Scharfschütze',
    emoji: '📍',
    metric: 'mode_correct:city-pin',
    metricLabel: 'richtige in Städte-Pin',
    thresholds: [15, 75, 300, 1200, 6000],
    subtitles: [
      'Pin rein, Daumen drauf.',
      'Meistens die richtige Stadt. Meistens.',
      'Navi? Brauchst du nicht.',
      'Du pinnst Städte im Schlaf.',
      'Stadtpläne zeichnen sich nach dir.',
    ],
  },
  {
    id: 'landmark_magier',
    name: 'Monumenten-Magier',
    emoji: '🗿',
    metric: 'mode_correct:landmark-pin',
    metricLabel: 'richtige in Sehenswürdigkeiten',
    thresholds: [15, 75, 300, 1200, 6000],
    subtitles: [
      'Eiffelturm erkannt. Guter Start.',
      'Weltwunder? Wochenendausflug.',
      'Du grüßt Statuen mit Vornamen.',
      'Moai drehen sich nach dir um.',
      'Museen fragen dich nach Leihgaben.',
    ],
  },
]

export const BADGE_BY_ID: ReadonlyMap<string, BadgeSpec> = new Map(
  BADGES.map((b) => [b.id, b]),
)

/** Minimaler Stats-Ausschnitt, den die Metrik-Auflösung braucht. */
export interface BadgeMetricStats {
  rounds_played: number
  solo_best_score: number
  cup_count: number
  questions_answered: number
  questions_correct: number
  total_points: number
  best_streak: number
  volltreffer_count: number
  trophy_count: number
  play_days: number
  mode_correct: Partial<Record<GameMode, number>>
}

/** Aktueller Metrik-Wert eines Badges — Spiegel der Server-Logik (award_badges). */
export function badgeMetricValue(spec: BadgeSpec, stats: BadgeMetricStats): number {
  if (spec.metric.startsWith('mode_correct:')) {
    const mode = spec.metric.slice('mode_correct:'.length) as GameMode
    return stats.mode_correct[mode] ?? 0
  }
  const value = stats[spec.metric as keyof BadgeMetricStats]
  return typeof value === 'number' ? value : 0
}

/** Höchste erreichte Stufe (0 = noch keine) zu einem Metrik-Wert. */
export function tierForValue(spec: BadgeSpec, value: number): number {
  let tier = 0
  for (let t = 0; t < spec.thresholds.length; t++) {
    if (value >= spec.thresholds[t]) tier = t + 1
    else break
  }
  return tier
}

/** ISO-Kalenderwoche (Mo–So) — für die Pokal-Beschriftung „KW 28 2026". */
function isoWeekParts(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

/** Periodenbeschriftung: „KW 28 2026" / „Juli 2026" / „2026". */
export function formatTrophyPeriod(type: TrophyPeriod, periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00`)
  if (Number.isNaN(d.getTime())) return periodStart
  if (type === 'year') return String(d.getFullYear())
  if (type === 'month') {
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }
  const { week, year } = isoWeekParts(d)
  return `KW ${week} ${year}`
}
