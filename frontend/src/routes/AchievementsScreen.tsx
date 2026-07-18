import { useEffect, useMemo, useState } from 'react'
import {
  BADGE_TIER_XP,
  BADGES,
  badgeMetricValue,
  CUP_FINISH_XP,
  formatTrophyPeriod,
  TIER_COLORS,
  TIER_NAMES,
  tierForValue,
  TROPHY_PERIOD_LABELS,
  trophyTitle,
  TROPHY_XP,
  type BadgeSpec,
  type TrophyPeriod,
} from '../features/gamification/badgeCatalog'
import { listPeriodStarts } from '../features/gamification/trophyPeriods'
import { TrophySymbol } from '../components/TrophyIcon'
import {
  LEVEL_CAP,
  levelProgress,
  xpForLevel,
} from '../features/gamification/levels'
import {
  fetchHallOfFame,
  type HallOfFameEntry,
} from '../api/gamificationApi'
import { isOnlineEnabled } from '../api/supabaseClient'
import { useGamificationStore } from '../state/gamificationStore'
import { RequireAccount } from './ScoresScreen'

type Tab = 'badges' | 'trophies' | 'level'

const TEASER =
  'Abzeichen, Pokale und Level hängen an deinem Account — so bleiben sie ' +
  'auch beim Gerätewechsel erhalten. Sichere kurz deinen Account, dann ' +
  'füllt sich die Vitrine.'

/**
 * „🏅 Erfolge" (Phase G): Schaukasten für Abzeichen, Pokale und Level.
 * Nur für registrierte Accounts — Gäste sehen den Account-Teaser.
 */
export function AchievementsScreen() {
  const [tab, setTab] = useState<Tab>('badges')
  const load = useGamificationStore((s) => s.load)

  // Beim Öffnen frisch laden — get_gamification finalisiert dabei auch
  // abgelaufene Pokal-Perioden serverseitig.
  useEffect(() => {
    if (isOnlineEnabled) void load()
  }, [load])

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h2 className="glow-yellow center">🏅 Erfolge</h2>

      <div className="tab-row tab-row--three">
        <button
          type="button"
          className={`pixel-btn${tab === 'badges' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('badges')}
        >
          Abzeichen
        </button>
        <button
          type="button"
          className={`pixel-btn${tab === 'trophies' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('trophies')}
        >
          Pokale
        </button>
        <button
          type="button"
          className={`pixel-btn${tab === 'level' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('level')}
        >
          Level
        </button>
      </div>

      {tab === 'badges' && (
        <RequireAccount message={TEASER} render={() => <BadgesTab />} />
      )}
      {tab === 'trophies' && (
        <RequireAccount message={TEASER} render={() => <TrophiesTab />} />
      )}
      {tab === 'level' && (
        <RequireAccount message={TEASER} render={() => <LevelTab />} />
      )}
    </div>
  )
}

/** Höchste erreichte Stufe je Badge aus den Server-Awards. */
function useOwnedTiers(): Map<string, number> {
  const badges = useGamificationStore((s) => s.badges)
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const b of badges) {
      map.set(b.badgeId, Math.max(map.get(b.badgeId) ?? 0, b.tier))
    }
    return map
  }, [badges])
}

function BadgeCard({ spec, ownedTier }: { spec: BadgeSpec; ownedTier: number }) {
  const stats = useGamificationStore((s) => s.stats)
  const value = stats ? badgeMetricValue(spec, stats) : 0
  // Server-Awards sind die Wahrheit; der lokale Wert deckt nur die Anzeige
  // zwischen zwei Loads ab (z. B. direkt nach einer Runde).
  const tier = Math.max(ownedTier, tierForValue(spec, value))
  const unlocked = tier > 0
  const color = unlocked ? TIER_COLORS[tier - 1] : undefined
  const nextThreshold = tier < 5 ? spec.thresholds[tier] : null

  return (
    <div
      className="pixel-panel stack"
      style={{ padding: 14, gap: 8, opacity: unlocked ? 1 : 0.55 }}
    >
      <div className="row" style={{ gap: 10 }}>
        <span style={{ fontSize: 28, filter: unlocked ? 'none' : 'grayscale(1)' }}>
          {spec.emoji}
        </span>
        <div className="stack" style={{ gap: 4 }}>
          <span className="display" style={{ fontSize: 10, color }}>
            {spec.name}
          </span>
          <span className="display dim" style={{ fontSize: 8, color }}>
            {unlocked ? TIER_NAMES[tier - 1] : 'GESPERRT'}
          </span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 17, minHeight: 38 }}>
        {unlocked ? (
          `„${spec.subtitles[tier - 1]}"`
        ) : (
          <span className="dim">???</span>
        )}
      </p>
      <p className="dim" style={{ margin: 0, fontSize: 16 }}>
        {nextThreshold !== null
          ? `Nächste Stufe (${TIER_NAMES[tier]}): ${value.toLocaleString('de-DE')} / ${nextThreshold.toLocaleString('de-DE')} ${spec.metricLabel}`
          : `MAX! ${value.toLocaleString('de-DE')} ${spec.metricLabel}`}
      </p>
    </div>
  )
}

function BadgesTab() {
  const status = useGamificationStore((s) => s.status)
  const owned = useOwnedTiers()

  if (status !== 'ready') return <p className="dim center blink">LADE…</p>

  const unlockedCount = BADGES.filter((b) => (owned.get(b.id) ?? 0) > 0).length

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="dim center" style={{ margin: 0, fontSize: 18 }}>
        {unlockedCount} von {BADGES.length} Abzeichen freigeschaltet — jede
        Stufe gibt XP ({BADGE_TIER_XP.join(' / ')}).
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {BADGES.map((spec) => (
          <BadgeCard key={spec.id} spec={spec} ownedTier={owned.get(spec.id) ?? 0} />
        ))}
      </div>
    </div>
  )
}

const TROPHY_FILTERS: Array<TrophyPeriod | 'all'> = ['all', 'week', 'month', 'year']

function TrophiesTab() {
  const trophies = useGamificationStore((s) => s.trophies)
  const status = useGamificationStore((s) => s.status)
  const [hall, setHall] = useState<HallOfFameEntry[] | null | 'loading'>('loading')
  const [filter, setFilter] = useState<TrophyPeriod | 'all'>('all')
  // Blätter-Index in die Perioden-Liste des gewählten Typs (0 = neueste).
  const [periodIdx, setPeriodIdx] = useState(0)

  useEffect(() => {
    let stale = false
    fetchHallOfFame().then((rows) => {
      if (!stale) setHall(rows)
    })
    return () => {
      stale = true
    }
  }, [])

  const periodStarts = useMemo(
    () =>
      hall !== 'loading' && hall !== null && filter !== 'all'
        ? listPeriodStarts(hall, filter)
        : [],
    [hall, filter],
  )

  if (status !== 'ready') return <p className="dim center blink">LADE…</p>

  // Beim Datenwechsel nie über das Perioden-Ende hinaus zeigen.
  const idx = Math.min(periodIdx, Math.max(0, periodStarts.length - 1))
  const currentPeriod = filter !== 'all' ? periodStarts[idx] : undefined

  const hallRows =
    hall === 'loading' || hall === null
      ? hall
      : hall.filter(
          (h) =>
            filter === 'all' ||
            (h.periodType === filter && h.periodStart === currentPeriod),
        )

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="pixel-panel stack" style={{ padding: 16, gap: 10 }}>
        <span className="display glow-yellow" style={{ fontSize: 11 }}>
          DEINE POKALE
        </span>
        {trophies.length === 0 ? (
          <p className="dim" style={{ margin: 0 }}>
            Noch keine Pokale. Die drei besten Cup-Läufe einer Kalenderwoche,
            eines Monats oder Jahres gewinnen — spiel den 🏆 Geo Cup!
          </p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {trophies.map((t) => (
              <div
                key={`${t.periodType}-${t.periodStart}`}
                className="row"
                style={{ gap: 10, alignItems: 'center' }}
              >
                <TrophySymbol period={t.periodType} rank={t.rank} />
                <span className="display" style={{ fontSize: 10 }}>
                  {trophyTitle(t.periodType, t.rank)}
                </span>
                <span className="dim">
                  {formatTrophyPeriod(t.periodType, t.periodStart)} ·{' '}
                  {t.totalScore.toLocaleString('de-DE')} Punkte · +
                  {TROPHY_XP[t.periodType][t.rank - 1]} XP
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <span className="display glow-cyan center" style={{ fontSize: 11 }}>
          HALL OF FAME
        </span>
        <p className="dim center" style={{ margin: 0, fontSize: 16 }}>
          Die Top 3 jeder Periode — gewertet erst nach ihrem Ende, den
          aktuellen Stand zeigt die Bestenliste.
        </p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {TROPHY_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`pixel-btn pixel-btn--small${filter === f ? ' pixel-btn--cyan' : ''}`}
              onClick={() => {
                setFilter(f)
                setPeriodIdx(0)
              }}
            >
              {f === 'all' ? 'Alle' : TROPHY_PERIOD_LABELS[f]}
            </button>
          ))}
        </div>

        {filter !== 'all' && currentPeriod !== undefined && (
          <div
            className="row"
            style={{ justifyContent: 'center', alignItems: 'center', gap: 12 }}
          >
            <button
              type="button"
              className="pixel-btn pixel-btn--small"
              aria-label="Ältere Periode"
              disabled={idx >= periodStarts.length - 1}
              onClick={() => setPeriodIdx(idx + 1)}
            >
              ◀
            </button>
            <span
              className="display glow-yellow"
              style={{ fontSize: 11, minWidth: 150, textAlign: 'center' }}
            >
              {formatTrophyPeriod(filter, currentPeriod)}
            </span>
            <button
              type="button"
              className="pixel-btn pixel-btn--small"
              aria-label="Neuere Periode"
              disabled={idx <= 0}
              onClick={() => setPeriodIdx(idx - 1)}
            >
              ▶
            </button>
          </div>
        )}

        {hallRows === 'loading' ? (
          <p className="dim center blink">LADE…</p>
        ) : hallRows === null ? (
          <p className="dim center">Hall of Fame nicht erreichbar.</p>
        ) : hallRows.length === 0 ? (
          <p className="dim center">
            Noch keine vergebenen Pokale — die erste abgeschlossene Periode
            mit einem Cup-Lauf kürt den ersten Champion!
          </p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th>Pokal</th>
                <th>Periode</th>
                <th>Spieler</th>
                <th>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {hallRows.map((h) => (
                <tr key={`${h.periodType}-${h.periodStart}-${h.rank}`}>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <TrophySymbol period={h.periodType} rank={h.rank} />
                      {trophyTitle(h.periodType, h.rank)}
                    </span>
                  </td>
                  <td className="dim">{formatTrophyPeriod(h.periodType, h.periodStart)}</td>
                  <td className="glow-cyan">{h.displayName}</td>
                  <td className="glow-yellow">{h.totalScore.toLocaleString('de-DE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function LevelTab() {
  const status = useGamificationStore((s) => s.status)
  const xp = useGamificationStore((s) => s.xp)

  if (status !== 'ready') return <p className="dim center blink">LADE…</p>

  const p = levelProgress(xp)
  const nextLevels = Array.from({ length: 5 }, (_, i) => p.level + 1 + i).filter(
    (n) => n <= LEVEL_CAP,
  )

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="pixel-panel stack center" style={{ padding: 20, gap: 12 }}>
        <span className="display glow-yellow" style={{ fontSize: 32 }}>
          LVL {p.level}
        </span>
        <span className="dim" style={{ fontSize: 18 }}>
          {xp.toLocaleString('de-DE')} XP gesamt
        </span>
        {/* XP-Balken im Pixel-Look */}
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            height: 18,
            border: '3px solid var(--shadow)',
            background: 'var(--panel-light, #333)',
          }}
        >
          <div
            style={{
              width: `${Math.round(p.ratio * 100)}%`,
              height: '100%',
              background: 'var(--green)',
            }}
          />
        </div>
        <span className="dim" style={{ fontSize: 16 }}>
          {p.level >= LEVEL_CAP
            ? 'Maximum erreicht — Respekt!'
            : `${p.intoLevel.toLocaleString('de-DE')} / ${p.neededForNext.toLocaleString('de-DE')} XP bis Level ${p.level + 1}`}
        </span>
      </div>

      {nextLevels.length > 0 && (
        <table className="summary-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>XP gesamt</th>
              <th>fehlen noch</th>
            </tr>
          </thead>
          <tbody>
            {nextLevels.map((n) => (
              <tr key={n}>
                <td className="glow-cyan">LVL {n}</td>
                <td className="dim">{xpForLevel(n).toLocaleString('de-DE')}</td>
                <td className="glow-yellow">
                  {Math.max(0, xpForLevel(n) - xp).toLocaleString('de-DE')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pixel-panel stack" style={{ padding: 16, gap: 8 }}>
        <span className="display glow-green" style={{ fontSize: 11 }}>
          SO GIBT ES XP
        </span>
        <ul className="dim" style={{ margin: 0, paddingLeft: 22, fontSize: 17 }}>
          <li>Jede gewertete Runde: 1 XP je angefangene 100 Punkte</li>
          <li>Cup abgeschlossen: +{CUP_FINISH_XP} XP</li>
          <li>
            Abzeichen-Stufen: {BADGE_TIER_XP.join(' / ')} XP (
            {TIER_NAMES.join(' → ')})
          </li>
          <li>
            Pokale (Platz 1/2/3): Woche {TROPHY_XP.week.join('/')} · Monat{' '}
            {TROPHY_XP.month.join('/')} · Jahr {TROPHY_XP.year.join('/')} XP
          </li>
        </ul>
      </div>
    </div>
  )
}
