import { useMemo, useState } from 'react'
import {
  saveFeaturedItems,
  type FeaturedItem,
} from '../api/gamificationApi'
import {
  BADGE_BY_ID,
  formatTrophyPeriod,
  TIER_COLORS,
  TIER_NAMES,
  trophyTitle,
} from '../features/gamification/badgeCatalog'
import { useGamificationStore } from '../state/gamificationStore'
import { useUserStore } from '../state/userStore'
import { TrophySymbol } from './TrophyIcon'

/**
 * Pokalregal (Phase I5, DESIGN-GAMIFICATION.md): 6 feste Regal-Plätze auf der
 * Spielerkarte, frei bestückbar mit eigenen Abzeichen und Pokalen (gemischt,
 * Nutzer-Entscheid 2026-07-18). Ohne Kuration zeigt die Karte wie bisher die
 * Top-Abzeichen — das Regal erscheint erst, wenn mindestens ein Slot belegt ist.
 */

export const SHELF_SLOTS = 6

function slotTitle(item: FeaturedItem): string {
  if (item.itemType === 'badge') {
    const spec = BADGE_BY_ID.get(item.badgeId)
    return spec ? `${spec.name} — ${TIER_NAMES[item.tier - 1]}` : item.badgeId
  }
  return `${trophyTitle(item.periodType, item.rank)} — ${formatTrophyPeriod(item.periodType, item.periodStart)}`
}

function SlotContent({ item }: { item: FeaturedItem | undefined }) {
  if (!item) return <span className="dim">·</span>
  if (item.itemType === 'badge') {
    const spec = BADGE_BY_ID.get(item.badgeId)
    return <span style={{ fontSize: 22 }}>{spec?.emoji ?? '❔'}</span>
  }
  return (
    <TrophySymbol
      period={item.periodType}
      rank={item.rank}
      size={item.periodType === 'year' ? 32 : item.periodType === 'month' ? 26 : 22}
    />
  )
}

/** Rahmenfarbe eines Slots: Badge = Stufenfarbe, Pokal = Rangfarbe. */
function slotBorderColor(item: FeaturedItem | undefined): string | undefined {
  if (!item) return undefined
  if (item.itemType === 'badge') return TIER_COLORS[item.tier - 1]
  return ['var(--yellow)', '#c2c3c7', 'var(--orange)'][item.rank - 1]
}

/** Reine Regal-Anzeige — auf der eigenen wie auf fremden Spielerkarten. */
export function TrophyShelf({ featured }: { featured: FeaturedItem[] }) {
  const bySlot = new Map(featured.map((f) => [f.slot, f]))
  return (
    <div className="shelf-row">
      {Array.from({ length: SHELF_SLOTS }, (_, i) => {
        const item = bySlot.get(i + 1)
        return (
          <span
            key={i + 1}
            className={`shelf-slot${item ? '' : ' shelf-slot--empty'}`}
            title={item ? slotTitle(item) : 'Leerer Regal-Platz'}
            style={{ borderColor: slotBorderColor(item) }}
          >
            <SlotContent item={item} />
          </span>
        )
      })}
    </div>
  )
}

function sameItem(a: FeaturedItem, b: FeaturedItem): boolean {
  if (a.itemType === 'badge' && b.itemType === 'badge') return a.badgeId === b.badgeId
  if (a.itemType === 'trophy' && b.itemType === 'trophy') return a.trophyId === b.trophyId
  return false
}

/**
 * Regal-Editor im Profil: Slot antippen → aus eigenen Abzeichen/Pokalen
 * wählen oder den Platz leeren. Speichert das komplette Regal per RPC
 * (set_featured_items) und zieht den lokalen Store nach.
 */
export function TrophyShelfEditor() {
  const status = useUserStore((s) => s.status)
  const isAnonymous = useUserStore((s) => s.isAnonymous)
  const gStatus = useGamificationStore((s) => s.status)
  const badges = useGamificationStore((s) => s.badges)
  const trophies = useGamificationStore((s) => s.trophies)
  const featured = useGamificationStore((s) => s.featured)
  const setFeatured = useGamificationStore((s) => s.setFeatured)

  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Höchste Stufe je Abzeichen als Auswahl-Kandidaten.
  const badgeOptions = useMemo(() => {
    const tiers = new Map<string, number>()
    for (const b of badges) {
      tiers.set(b.badgeId, Math.max(tiers.get(b.badgeId) ?? 0, b.tier))
    }
    return [...tiers.entries()]
      .map(([badgeId, tier]) => ({ badgeId, tier: tier as 1 | 2 | 3 | 4 | 5 }))
      .sort((a, b) => b.tier - a.tier)
  }, [badges])

  // Pokale brauchen ihre Server-ID (0014) — ohne Migration nicht wählbar.
  const trophyOptions = useMemo(
    () => trophies.filter((t) => t.trophyId !== null),
    [trophies],
  )

  // Regal nur für registrierte Accounts mit geladenem Stand.
  if (status !== 'online' || isAnonymous || gStatus !== 'ready') return null

  const bySlot = new Map(featured.map((f) => [f.slot, f]))

  const save = async (next: FeaturedItem[]) => {
    setBusy(true)
    setMessage(null)
    const ok = await saveFeaturedItems(next)
    setBusy(false)
    if (ok) {
      setFeatured(next)
      setActiveSlot(null)
    } else {
      setMessage(
        'Speichern fehlgeschlagen — Server nicht erreichbar oder noch nicht aktualisiert.',
      )
    }
  }

  const assign = (item: FeaturedItem | null) => {
    if (activeSlot === null) return
    // Slot ersetzen; dasselbe Item verschwindet aus jedem anderen Slot.
    let next = featured.filter((f) => f.slot !== activeSlot)
    if (item) {
      next = next.filter((f) => !sameItem(f, item))
      next.push({ ...item, slot: activeSlot })
    }
    next.sort((a, b) => a.slot - b.slot)
    void save(next)
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20, gap: 12 }}>
      <h3 className="glow-yellow">🏅 Pokalregal</h3>
      <p className="dim" style={{ margin: 0, fontSize: 18 }}>
        Bestücke die 6 Plätze deiner Spielerkarte mit deinen Lieblings-Erfolgen
        — Abzeichen und Pokale, frei gemischt. Tippe einen Platz an.
        {featured.length === 0 &&
          ' Ohne Auswahl zeigt die Karte automatisch deine besten Abzeichen.'}
      </p>

      <div className="shelf-row">
        {Array.from({ length: SHELF_SLOTS }, (_, i) => {
          const slot = i + 1
          const item = bySlot.get(slot)
          const active = activeSlot === slot
          return (
            <button
              key={slot}
              type="button"
              className={`shelf-slot shelf-slot--btn${item ? '' : ' shelf-slot--empty'}${active ? ' shelf-slot--active' : ''}`}
              title={item ? slotTitle(item) : `Platz ${slot} belegen`}
              disabled={busy}
              onClick={() => {
                setMessage(null)
                setActiveSlot(active ? null : slot)
              }}
              style={active ? undefined : { borderColor: slotBorderColor(item) }}
            >
              <SlotContent item={item} />
            </button>
          )
        })}
      </div>

      {activeSlot !== null && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <span className="display glow-cyan" style={{ fontSize: 10 }}>
              PLATZ {activeSlot}
            </span>
            {bySlot.has(activeSlot) && (
              <button
                type="button"
                className="pixel-btn pixel-btn--small"
                disabled={busy}
                onClick={() => assign(null)}
              >
                Leeren
              </button>
            )}
            <button
              type="button"
              className="pixel-btn pixel-btn--small"
              onClick={() => setActiveSlot(null)}
            >
              X
            </button>
          </div>

          {badgeOptions.length === 0 && trophyOptions.length === 0 ? (
            <p className="dim" style={{ margin: 0, fontSize: 17 }}>
              Noch nichts zum Ausstellen — spiel ein paar Runden für Abzeichen
              oder gewinne einen Pokal im 🏆 Geo Cup!
            </p>
          ) : (
            <div className="shelf-options">
              {trophyOptions.map((t) => (
                <button
                  key={`t-${t.trophyId}`}
                  type="button"
                  className="shelf-option"
                  disabled={busy}
                  title={`${trophyTitle(t.periodType, t.rank)} — ${formatTrophyPeriod(t.periodType, t.periodStart)}`}
                  onClick={() =>
                    assign({
                      slot: activeSlot,
                      itemType: 'trophy',
                      trophyId: t.trophyId as number,
                      periodType: t.periodType,
                      periodStart: t.periodStart,
                      rank: t.rank,
                      totalScore: t.totalScore,
                    })
                  }
                >
                  <TrophySymbol period={t.periodType} rank={t.rank} size={24} />
                  <span className="shelf-option-name">
                    {trophyTitle(t.periodType, t.rank)}
                    <br />
                    <span className="dim">
                      {formatTrophyPeriod(t.periodType, t.periodStart)}
                    </span>
                  </span>
                </button>
              ))}
              {badgeOptions.map((b) => {
                const spec = BADGE_BY_ID.get(b.badgeId)
                if (!spec) return null
                return (
                  <button
                    key={`b-${b.badgeId}`}
                    type="button"
                    className="shelf-option"
                    disabled={busy}
                    title={`${spec.name} — ${TIER_NAMES[b.tier - 1]}`}
                    onClick={() =>
                      assign({
                        slot: activeSlot,
                        itemType: 'badge',
                        badgeId: b.badgeId,
                        tier: b.tier,
                      })
                    }
                  >
                    <span
                      style={{ fontSize: 22, color: TIER_COLORS[b.tier - 1] }}
                    >
                      {spec.emoji}
                    </span>
                    <span className="shelf-option-name">
                      {spec.name}
                      <br />
                      <span style={{ color: TIER_COLORS[b.tier - 1] }}>
                        {TIER_NAMES[b.tier - 1]}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {message && (
        <p className="glow-yellow" style={{ margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  )
}
