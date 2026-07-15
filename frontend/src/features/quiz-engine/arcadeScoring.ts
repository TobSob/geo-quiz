/**
 * Arcade-Scoring (Phase E, Regelwerk: DESIGN-ARCADE.md).
 *
 * Feste Zeit statt fester Fragenzahl: 60-s-Sessions (Cup-Legs 30 s), Score =
 * Summe aller Antwortpunkte. Kein Punkte-Zeitbonus — Tempo zahlt sich über
 * mehr Fragen pro Session und schnelleren Streak-Aufbau aus.
 *
 * Konventionen:
 * - Der Multiplikator nutzt die Streak VOR der aktuellen Antwort
 *   (Streak 7 → die nächste richtige Antwort bringt 170 Punkte).
 * - Streaks sind durch die Pin-Stufen Bruchzahlen (z. B. 4,4 → 144 %) und
 *   werden nach jedem Update auf eine Nachkommastelle gerundet, damit sich
 *   keine Float-Drift ansammelt (0,1 + 0,1 + ... ≠ 0,300000004).
 * - Ersetzt `scoring.ts`, sobald die Aufrufer umgestellt sind (E2/E3).
 */

export const BASE_POINTS = 100
/** +10 % Punkte je Streak-Punkt, unbegrenzt (DESIGN-ARCADE O2). */
export const STREAK_STEP = 0.1
/** Je RECLAIM_EVERY volle Streak-Punkte gibt es RECLAIM_SECONDS zurück (O3). */
export const RECLAIM_EVERY = 10
export const RECLAIM_SECONDS = 5

/**
 * Mindest-Budgetverbrauch pro Frage (Playtest-Feedback R3, ersetzt die
 * Strafsekunden). Jede beantwortete Frage kostet mindestens so viel Zeit —
 * blindes Tasten-Spammen (1–4) frisst dadurch trotzdem Budget, ganz ohne
 * sichtbaren „Strafabzug". Liegt bewusst über der Server-Plausibilitätsgrenze
 * von 400 ms/Frage (Migration 0001/0005), damit echte Läufe nie abgelehnt
 * werden. Eine gelesene Multiple-Choice-Frage dauert real ohnehin länger.
 */
export const MIN_QUESTION_MS = 500

export const SESSION_SECONDS = 60
export const CUP_LEG_SECONDS = 30

export type PinTierId = 'volltreffer' | 'stark' | 'knapp' | 'naja' | 'verpeilt'

export interface PinTier {
  id: PinTierId
  /** Retro-Label fürs Feedback-HUD (Arbeitsstand, Feinschliff in E6). */
  label: string
  /** Obere Distanzgrenze in km (inklusive); Infinity für die Fehlstufe. */
  maxKm: number
  points: number
  /** Streak-Zuwachs; die Fehlstufe setzt stattdessen auf 0 zurück. */
  streakDelta: number
  breaksStreak: boolean
  /** Zurückgeholte Sekunden allein für diese Stufe (Volltreffer-Bonus, R3). */
  timeBonusSeconds: number
}

/**
 * Einheitliche Stufen für beide Pin-Modi (DESIGN-ARCADE O1).
 *
 * Zonen bewusst großzügig (Playtest-Feedback R3): präzises Klicken auf der
 * niedrig gezoomten Weltkarte ist schwer, darum zählt schon „grob richtig".
 * Nur der Volltreffer bleibt eng (≤ 100 km) und gibt dafür +3 s Zeit zurück —
 * das belohnt Präzision und verlängert die (langsamere) Pin-Session spürbar.
 */
export const VOLLTREFFER_TIME_BONUS = 3

export const PIN_TIERS: readonly PinTier[] = [
  { id: 'volltreffer', label: 'VOLLTREFFER!', maxKm: 100, points: 100, streakDelta: 1, breaksStreak: false, timeBonusSeconds: VOLLTREFFER_TIME_BONUS },
  { id: 'stark', label: 'STARK!', maxKm: 350, points: 50, streakDelta: 0.5, breaksStreak: false, timeBonusSeconds: 0 },
  { id: 'knapp', label: 'KNAPP VORBEI', maxKm: 1000, points: 10, streakDelta: 0.1, breaksStreak: false, timeBonusSeconds: 0 },
  { id: 'naja', label: 'NAJA…', maxKm: 2500, points: 1, streakDelta: 0, breaksStreak: false, timeBonusSeconds: 0 },
  { id: 'verpeilt', label: 'VÖLLIG VERPEILT', maxKm: Infinity, points: 0, streakDelta: 0, breaksStreak: true, timeBonusSeconds: 0 },
] as const

/** Obere Grenze (km), bis zu der eine Pin-Antwort als „richtig" zählt (STARK! oder besser). */
export const PIN_CORRECT_MAX_KM = 350

export function pinTierFor(distanceKm: number): PinTier {
  const tier = PIN_TIERS.find((t) => distanceKm <= t.maxKm)
  // Unreachable (letzte Stufe deckt Infinity ab), hält TS ohne non-null ruhig.
  return tier ?? PIN_TIERS[PIN_TIERS.length - 1]
}

/** Auf eine Nachkommastelle runden — einzige zulässige Streak-Darstellung. */
export function roundStreak(streak: number): number {
  return Math.round(streak * 10) / 10
}

export function streakMultiplier(streak: number): number {
  return 1 + roundStreak(streak) * STREAK_STEP
}

/** Choice-Modi: richtig = 100 × Multiplikator, falsch = 0. */
export function scoreChoiceArcade(correct: boolean, streak: number): number {
  if (!correct) return 0
  return Math.round(BASE_POINTS * streakMultiplier(streak))
}

/** Pin-Modi: Stufenpunkte × Multiplikator (gilt einheitlich für alle Stufen). */
export function scorePinArcade(distanceKm: number, streak: number): number {
  const tier = pinTierFor(distanceKm)
  return Math.round(tier.points * streakMultiplier(streak))
}

export function nextStreakChoice(streak: number, correct: boolean): number {
  return correct ? roundStreak(streak + 1) : 0
}

export function nextStreakPin(streak: number, distanceKm: number): number {
  const tier = pinTierFor(distanceKm)
  if (tier.breaksStreak) return 0
  return roundStreak(streak + tier.streakDelta)
}

/**
 * Zurückgeholte Sekunden beim Streak-Übergang: +5 s je überschrittenem vollen
 * Zehner (9,8 → 10,3 löst aus; 10,0 → 11,0 nicht mehr). Bei Streak-Verlust 0.
 */
export function reclaimedSeconds(prevStreak: number, newStreak: number): number {
  const prev = roundStreak(prevStreak)
  const next = roundStreak(newStreak)
  if (next <= prev) return 0
  const crossed =
    Math.floor(next / RECLAIM_EVERY) - Math.floor(prev / RECLAIM_EVERY)
  return Math.max(0, crossed) * RECLAIM_SECONDS
}
