import { useEffect, useMemo, useState } from 'react'
import { useAvatarStore } from '../state/avatarStore'
import { useUserStore } from '../state/userStore'
import { useGamificationStore } from '../state/gamificationStore'
import { useProgressStore } from '../state/progressStore'
import { fetchPlayerCard } from '../api/gamificationApi'
import { levelProgress } from '../features/gamification/levels'
import {
  BADGE_BY_ID,
  TIER_COLORS,
  TIER_NAMES,
  type BadgeSpec,
} from '../features/gamification/badgeCatalog'
import { PixelAvatar } from './PixelAvatar'
import { MODE_TITLES } from '../routes/PlayScreen'
import { DEFAULT_AVATAR_ID } from '../features/avatars/avatarCatalog'

/** Kategorien-Reihenfolge für die Bestpunkte-Liste (inkl. Cup). */
const BEST_ORDER = [
  ...(Object.keys(MODE_TITLES) as (keyof typeof MODE_TITLES)[]),
  'cup',
] as const

const BEST_LABEL: Record<string, string> = { ...MODE_TITLES, cup: '🏆 Cup' }

interface BestRow {
  key: string
  score: number
}

/** Höchste Stufe je Abzeichen-ID → Embleme, Gold zuerst. */
function emblemsFromTiers(tiers: Map<string, number>) {
  const list: { spec: BadgeSpec; tier: number }[] = []
  for (const [id, tier] of tiers) {
    const spec = BADGE_BY_ID.get(id)
    if (spec) list.push({ spec, tier })
  }
  return list.sort((a, b) => b.tier - a.tier)
}

/**
 * Reine Anzeige der Spielerkarte — Avatar, Level, Erfolgs-Embleme, Bestpunkte.
 * Kennt nicht, ob es die eigene oder eine fremde Karte ist; das entscheiden
 * `PlayerCard` (eigen, aus lokalen Stores) bzw. `OtherPlayerCardBody` (fremd,
 * server-geladen über `get_player_card`).
 */
function PlayerCardView({
  avatarId,
  displayName,
  xp,
  badgeTiers,
  bestRows,
  badgesEmptyText,
  bestsEmptyText,
}: {
  avatarId: string
  displayName: string
  xp: number
  badgeTiers: Map<string, number>
  bestRows: BestRow[]
  badgesEmptyText: string
  bestsEmptyText: string
}) {
  const p = levelProgress(xp)
  const emblems = useMemo(() => emblemsFromTiers(badgeTiers), [badgeTiers])

  return (
    <div className="player-card">
      <div className="player-card-head">
        <span className="player-card-avatar">
          <PixelAvatar id={avatarId} size={72} />
        </span>
        <div className="stack" style={{ gap: 6 }}>
          <span className="display glow-cyan" style={{ fontSize: 14 }}>
            {displayName}
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
            {badgesEmptyText}
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
            {bestsEmptyText}
          </p>
        ) : (
          <div className="player-card-bests">
            {bestRows.map((r) => (
              <div key={r.key} className="player-best-row">
                <span className="dim">{BEST_LABEL[r.key] ?? r.key}</span>
                <span className="glow-yellow">{r.score.toLocaleString('de-DE')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * „Spielerkarte" (Feature-Idee R3): Avatar, Level, Erfolgs-Embleme und die
 * Bestpunkte des EIGENEN Accounts. Level/Abzeichen kommen aus der
 * Gamification (nur mit Account); die Bestpunkte sind lokal (dieses Gerät).
 */
export function PlayerCard() {
  const avatarId = useAvatarStore((s) => s.avatarId)
  const displayName = useUserStore((s) => s.displayName)
  const xp = useGamificationStore((s) => s.xp)
  const badges = useGamificationStore((s) => s.badges)
  const status = useGamificationStore((s) => s.status)
  const bests = useProgressStore((s) => s.bests)

  const badgeTiers = useMemo(() => {
    const tiers = new Map<string, number>()
    for (const b of badges) {
      tiers.set(b.badgeId, Math.max(tiers.get(b.badgeId) ?? 0, b.tier))
    }
    return tiers
  }, [badges])

  const bestRows: BestRow[] = BEST_ORDER.flatMap((mode) => {
    const top = bests[mode]?.[0]
    return top ? [{ key: mode, score: top.score }] : []
  })

  const hasAccount = status === 'ready' && (xp > 0 || badges.length > 0)

  return (
    <PlayerCardView
      avatarId={avatarId}
      displayName={displayName ?? 'Spieler'}
      xp={xp}
      badgeTiers={badgeTiers}
      bestRows={bestRows}
      badgesEmptyText={
        hasAccount
          ? 'Noch keine Abzeichen — spiel ein paar Runden!'
          : 'Mit Account gibt es hier Level & Abzeichen.'
      }
      bestsEmptyText="Noch keine Rekorde — leg los!"
    />
  )
}

/**
 * Spielerkarte eines FREMDEN Accounts — lädt Level/Abzeichen/Bestpunkte
 * server-seitig über `get_player_card` (Migration 0012). `fallbackAvatarId`
 * kommt von der schon geladenen Bestenlisten-Zeile, damit der Avatar sofort
 * da ist, statt auf die (redundante) Server-Antwort zu warten.
 */
function OtherPlayerCardBody({
  displayName,
  fallbackAvatarId,
}: {
  displayName: string
  fallbackAvatarId: string | undefined
}) {
  const [card, setCard] = useState<
    Awaited<ReturnType<typeof fetchPlayerCard>> | 'loading'
  >('loading')

  useEffect(() => {
    let stale = false
    setCard('loading')
    fetchPlayerCard(displayName).then((c) => {
      if (!stale) setCard(c)
    })
    return () => {
      stale = true
    }
  }, [displayName])

  if (card === 'loading') {
    return <p className="dim center blink">LADE…</p>
  }

  if (card === null) {
    // Migration 0012 fehlt noch, offline, oder (selten) Namenskollision.
    return (
      <div className="player-card">
        <div className="player-card-head">
          <span className="player-card-avatar">
            <PixelAvatar id={fallbackAvatarId ?? DEFAULT_AVATAR_ID} size={72} />
          </span>
          <span className="display glow-cyan" style={{ fontSize: 14 }}>
            {displayName}
          </span>
        </div>
        <p className="dim" style={{ margin: 0, fontSize: 16 }}>
          Karte gerade nicht verfügbar.
        </p>
      </div>
    )
  }

  const badgeTiers = new Map(card.badges.map((b) => [b.badgeId, b.tier]))
  const bestRows: BestRow[] = [
    ...card.modeBests.map((m) => ({ key: m.mode, score: m.score })),
    ...(card.cupBestScore > 0 ? [{ key: 'cup', score: card.cupBestScore }] : []),
  ]

  return (
    <PlayerCardView
      avatarId={card.avatarId ?? fallbackAvatarId ?? DEFAULT_AVATAR_ID}
      displayName={card.displayName}
      xp={card.xp}
      badgeTiers={badgeTiers}
      bestRows={bestRows}
      badgesEmptyText="Noch keine Abzeichen."
      bestsEmptyText="Noch keine Rekorde."
    />
  )
}

/**
 * Spielerkarte als Overlay. Ohne `displayName` (bzw. mit dem eigenen Namen)
 * zeigt es die eigene Karte aus lokalen Stores; für jeden anderen Namen lädt
 * es die Karte server-seitig (Klick auf eine fremde Bestenlisten-Zeile).
 */
export function PlayerCardOverlay({
  displayName,
  fallbackAvatarId,
  onClose,
}: {
  /** Undefined/eigener Name = eigene Karte. */
  displayName?: string
  fallbackAvatarId?: string
  onClose: () => void
}) {
  const myName = useUserStore((s) => s.displayName)
  const isOwn = !displayName || displayName === myName

  return (
    <div
      className="card-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="card-overlay-inner" onClick={(e) => e.stopPropagation()}>
        {isOwn ? (
          <PlayerCard />
        ) : (
          <OtherPlayerCardBody displayName={displayName} fallbackAvatarId={fallbackAvatarId} />
        )}
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
