import { useMemo } from 'react'
import { useAvatarStore } from '../state/avatarStore'
import { useUserStore } from '../state/userStore'
import { useGamificationStore } from '../state/gamificationStore'
import { useProgressStore } from '../state/progressStore'
import { levelProgress } from '../features/gamification/levels'
import {
  BADGE_BY_ID,
  TIER_COLORS,
  TIER_NAMES,
  type BadgeSpec,
} from '../features/gamification/badgeCatalog'
import { PixelAvatar } from './PixelAvatar'
import { MODE_TITLES } from '../routes/PlayScreen'

/** Kategorien-Reihenfolge für die Bestpunkte-Liste (inkl. Cup). */
const BEST_ORDER = [
  ...(Object.keys(MODE_TITLES) as (keyof typeof MODE_TITLES)[]),
  'cup',
] as const

const BEST_LABEL: Record<string, string> = { ...MODE_TITLES, cup: '🏆 Cup' }

/**
 * „Spielerkarte" (Feature-Idee R3): Avatar, Level, Erfolgs-Embleme und die
 * Bestpunkte des eigenen Accounts auf einen Blick. Level/Abzeichen kommen aus
 * der Gamification (nur mit Account); die Bestpunkte sind lokal (dieses Gerät).
 */
export function PlayerCard() {
  const avatarId = useAvatarStore((s) => s.avatarId)
  const displayName = useUserStore((s) => s.displayName)
  const xp = useGamificationStore((s) => s.xp)
  const badges = useGamificationStore((s) => s.badges)
  const status = useGamificationStore((s) => s.status)
  const bests = useProgressStore((s) => s.bests)

  const p = levelProgress(xp)

  // Höchste Stufe je Abzeichen → Embleme.
  const emblems = useMemo(() => {
    const byId = new Map<string, number>()
    for (const b of badges) {
      byId.set(b.badgeId, Math.max(byId.get(b.badgeId) ?? 0, b.tier))
    }
    const list: { spec: BadgeSpec; tier: number }[] = []
    for (const [id, tier] of byId) {
      const spec = BADGE_BY_ID.get(id)
      if (spec) list.push({ spec, tier })
    }
    return list.sort((a, b) => b.tier - a.tier)
  }, [badges])

  const bestRows = BEST_ORDER.flatMap((mode) => {
    const top = bests[mode]?.[0]
    return top ? [{ mode, score: top.score }] : []
  })

  const hasAccount = status === 'ready' && (xp > 0 || badges.length > 0)

  return (
    <div className="player-card">
      <div className="player-card-head">
        <span className="player-card-avatar">
          <PixelAvatar id={avatarId} size={72} />
        </span>
        <div className="stack" style={{ gap: 6 }}>
          <span className="display glow-cyan" style={{ fontSize: 14 }}>
            {displayName ?? 'Spieler'}
          </span>
          <span className="display glow-yellow" style={{ fontSize: 11 }}>
            LVL {p.level}
          </span>
          <div className="player-card-xp">
            <div style={{ width: `${Math.round(p.ratio * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="display glow-green" style={{ fontSize: 10 }}>
          ERFOLGE
        </span>
        {emblems.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 16 }}>
            {hasAccount
              ? 'Noch keine Abzeichen — spiel ein paar Runden!'
              : 'Mit Account gibt es hier Level & Abzeichen.'}
          </p>
        ) : (
          <div className="player-card-emblems">
            {emblems.map(({ spec, tier }) => (
              <span
                key={spec.id}
                className="player-emblem"
                title={`${spec.name} — ${TIER_NAMES[tier - 1]}`}
                style={{ borderColor: TIER_COLORS[tier - 1] }}
              >
                <span style={{ fontSize: 20 }}>{spec.emoji}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="display glow-green" style={{ fontSize: 10 }}>
          BESTPUNKTE
        </span>
        {bestRows.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 16 }}>
            Noch keine Rekorde — leg los!
          </p>
        ) : (
          <div className="player-card-bests">
            {bestRows.map((r) => (
              <div key={r.mode} className="player-best-row">
                <span className="dim">{BEST_LABEL[r.mode] ?? r.mode}</span>
                <span className="glow-yellow">{r.score.toLocaleString('de-DE')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Spielerkarte als Overlay — z. B. beim Klick auf die eigene Bestenlisten-Zeile. */
export function PlayerCardOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="card-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="card-overlay-inner" onClick={(e) => e.stopPropagation()}>
        <PlayerCard />
        <button
          type="button"
          className="pixel-btn pixel-btn--primary"
          onClick={onClose}
        >
          Schließen
        </button>
      </div>
    </div>
  )
}
