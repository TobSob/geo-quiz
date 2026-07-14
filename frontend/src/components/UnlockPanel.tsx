import { useEffect } from 'react'
import type { UnlockPayload } from '../api/gamificationApi'
import {
  BADGE_BY_ID,
  TIER_COLORS,
  TIER_NAMES,
} from '../features/gamification/badgeCatalog'
import { levelForXp } from '../features/gamification/levels'
import { sfx } from '../features/audio/sfx'

/**
 * Unlock-Anzeige am Rundenende (Phase G): XP-Gewinn, Levelaufstieg und neu
 * freigeschaltete Abzeichen aus der Server-Payload. Erscheint asynchron,
 * sobald die Abgabe beantwortet ist — offline/Gast gibt es keine Payload
 * und damit kein Panel.
 */
export function UnlockPanel({ unlocks }: { unlocks: UnlockPayload | null }) {
  const leveledUp =
    unlocks !== null &&
    levelForXp(unlocks.xpTotal) > levelForXp(unlocks.xpTotal - unlocks.xpGained)

  useEffect(() => {
    if (leveledUp) sfx.levelup()
  }, [leveledUp])

  if (!unlocks) return null

  return (
    <div
      className="pixel-panel stack center"
      style={{ padding: 14, gap: 10, maxWidth: 560, margin: '0 auto', width: '100%' }}
      aria-live="polite"
    >
      <span className="display glow-green" style={{ fontSize: 14 }}>
        +{unlocks.xpGained.toLocaleString('de-DE')} XP
      </span>

      {leveledUp && (
        <span className="display glow-yellow blink" style={{ fontSize: 16 }}>
          LEVEL UP! LVL {levelForXp(unlocks.xpTotal)}
        </span>
      )}

      {unlocks.newBadges.map((b) => {
        const spec = BADGE_BY_ID.get(b.badgeId)
        if (!spec) return null
        return (
          <div key={`${b.badgeId}:${b.tier}`} className="stack center" style={{ gap: 2 }}>
            <span
              className="display"
              style={{ fontSize: 11, color: TIER_COLORS[b.tier - 1] }}
            >
              {spec.emoji} {spec.name.toUpperCase()} — {TIER_NAMES[b.tier - 1].toUpperCase()}
            </span>
            <span className="dim" style={{ fontSize: 16 }}>
              „{spec.subtitles[b.tier - 1]}"
            </span>
          </div>
        )
      })}
    </div>
  )
}
