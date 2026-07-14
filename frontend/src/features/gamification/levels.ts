/**
 * Level-Kurve (Phase G, DESIGN-GAMIFICATION.md): kumulierte XP für Level n
 * = 50·n·(n−1). Schnelle erste Level, dann linear wachsende Abstände.
 * Der Server speichert nur XP — Level rechnet ausschließlich der Client.
 */

export const LEVEL_CAP = 99

/** Kumulierte XP, die Level n insgesamt erfordert (Level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const n = Math.min(Math.max(1, Math.floor(level)), LEVEL_CAP)
  return 50 * n * (n - 1)
}

/** Level zu einem XP-Stand (1 … LEVEL_CAP). */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1
  // Umkehrung von 50·n·(n−1) ≤ xp
  const n = Math.floor(0.5 + Math.sqrt(2500 + 200 * xp) / 100)
  return Math.min(Math.max(1, n), LEVEL_CAP)
}

export interface LevelProgress {
  level: number
  /** XP seit dem Erreichen des aktuellen Levels. */
  intoLevel: number
  /** XP-Abstand vom aktuellen zum nächsten Level (0 am Cap). */
  neededForNext: number
  /** Fortschritt 0–1 zum nächsten Level (1 am Cap). */
  ratio: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp)
  if (level >= LEVEL_CAP) {
    return { level, intoLevel: 0, neededForNext: 0, ratio: 1 }
  }
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const intoLevel = Math.max(0, xp - base)
  const neededForNext = next - base
  return {
    level,
    intoLevel,
    neededForNext,
    ratio: Math.min(1, intoLevel / neededForNext),
  }
}

/** Gameplay-XP einer Score-Abgabe — Spiegel der Serverformel (0008). */
export function xpForScore(score: number): number {
  return Math.max(1, Math.ceil(score / 100))
}
