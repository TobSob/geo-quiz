import { useMemo } from 'react'
import { useGamificationStore } from '../../state/gamificationStore'
import { levelForXp } from '../gamification/levels'
import type { UnlockContext } from './avatarCatalog'

/**
 * Unlock-Kontext aus dem Gamification-Stand: Level (aus XP), höchste
 * Badge-Stufen und Pokalzahl. Für Gäste/offline ist alles leer → es bleiben
 * nur die Starter-Avatare wählbar.
 */
export function useUnlockContext(): UnlockContext {
  const xp = useGamificationStore((s) => s.xp)
  const badges = useGamificationStore((s) => s.badges)
  const trophies = useGamificationStore((s) => s.trophies)
  const stats = useGamificationStore((s) => s.stats)

  return useMemo(() => {
    const badgeTiers = new Map<string, number>()
    for (const b of badges) {
      badgeTiers.set(b.badgeId, Math.max(badgeTiers.get(b.badgeId) ?? 0, b.tier))
    }
    return {
      level: levelForXp(xp),
      badgeTiers,
      trophyCount: trophies.length,
      isBetaTester: stats?.beta_tester ?? false,
    }
  }, [xp, badges, trophies, stats])
}
