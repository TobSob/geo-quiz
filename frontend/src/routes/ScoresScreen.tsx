import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useProgressStore } from '../state/progressStore'
import { MODE_TITLES } from './PlayScreen'
import {
  fetchCupRunLegs,
  fetchLeaderboardCups,
  fetchLeaderboardScores,
  PERIOD_LABELS,
  type CupRunLeg,
  type LeaderboardCup,
  type LeaderboardPeriod,
  type LeaderboardScore,
} from '../api/leaderboardApi'
import { isOnlineEnabled } from '../api/supabaseClient'
import {
  fetchLeaderboardLevels,
  type LeaderboardLevelEntry,
} from '../api/gamificationApi'
import { levelForXp } from '../features/gamification/levels'
import { listMyGroups, type FriendGroup } from '../api/groupApi'
import { useUserStore } from '../state/userStore'
import { useAvatarStore } from '../state/avatarStore'
import { fetchAvatars } from '../api/avatarApi'
import { PixelAvatar } from '../components/PixelAvatar'
import { PlayerCardOverlay } from '../components/PlayerCard'
import type { GameMode } from '../features/quiz-engine/types'
import type { CupLegBreakdown } from '../state/progressStore'
import { Link } from 'react-router-dom'

const MODE_LABEL: Record<string, string> = {
  ...MODE_TITLES,
  cup: '🏆 Geo Cup',
  training: '🎯 Training',
}

const GAME_MODES = Object.keys(MODE_TITLES) as GameMode[]
const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'year', 'all']

type Tab = 'local' | 'global' | 'cups' | 'level'

function formatDate(ts: number | string): string {
  return new Date(ts).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Spielerkarten-Overlay als wiederverwendbarer Baustein je Tabelle. Merkt
 * sich, WESSEN Karte gerade offen ist — Klick auf eine beliebige Zeile öffnet
 * die Karte dieser Person, nicht immer die eigene.
 */
function useCardOverlay() {
  const [target, setTarget] = useState<{ name: string; avatarId: string | undefined } | null>(
    null,
  )
  return {
    openCard: (name: string, avatarId: string | undefined) => setTarget({ name, avatarId }),
    node: target ? (
      <PlayerCardOverlay
        displayName={target.name}
        fallbackAvatarId={target.avatarId}
        onClose={() => setTarget(null)}
      />
    ) : null,
  }
}

/**
 * Avatar-Zuordnung (Anzeigename → Avatar-ID) für die gerade geladenen Zeilen.
 * Braucht Migration 0010; ohne sie bleibt die Map leer (dann nur Namen).
 */
function useAvatarMap(names: string[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => new Map())
  const key = names.join('|')
  useEffect(() => {
    if (names.length === 0) {
      setMap(new Map())
      return
    }
    let stale = false
    fetchAvatars(names).then((m) => {
      if (!stale) setMap(m)
    })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

/**
 * Spielername in der Bestenliste — mit Avatar, sodass man Mitspieler erkennt.
 * Jede Zeile ist anklickbar und öffnet die Karte GENAU dieser Person (nicht
 * immer die eigene) — Nutzer-Feedback 2026-07-16.
 */
function LeaderName({
  name,
  isMe,
  avatarId,
  onOpen,
}: {
  name: string
  isMe: boolean
  avatarId: string | undefined
  onOpen: (name: string, avatarId: string | undefined) => void
}) {
  const avatar = avatarId ? <PixelAvatar id={avatarId} size={22} /> : null
  return (
    <button
      type="button"
      className="leader-me"
      onClick={() => onOpen(name, avatarId)}
      title={isMe ? 'Deine Karte ansehen' : `Karte von ${name} ansehen`}
    >
      {avatar}
      <span className="glow-cyan">{name}</span>
    </button>
  )
}

/** Cup-Punkte mit Aufschlüsselung je Disziplin im Hover (R3). */
function CupScoreCell({
  score,
  legs,
}: {
  score: number
  legs: CupLegBreakdown[] | undefined
}) {
  if (!legs || legs.length === 0) {
    return <span className="glow-yellow">{score.toLocaleString('de-DE')}</span>
  }
  return (
    <span className="cup-cell" tabIndex={0}>
      <span className="glow-yellow">{score.toLocaleString('de-DE')}</span>
      <span className="cup-cell-hint">ℹ</span>
      <span className="cup-tip" role="tooltip">
        {legs.map((l) => (
          <span key={l.mode} className="cup-tip-row">
            <span className="dim">{MODE_TITLES[l.mode] ?? l.mode}</span>
            <span className="glow-yellow">{l.score.toLocaleString('de-DE')}</span>
          </span>
        ))}
      </span>
    </span>
  )
}

/**
 * Score-Button in der globalen Cup-Bestenliste (Nutzer-Wunsch): Klick öffnet
 * die Punkte je Disziplin darunter (Migration 0011, `get_cup_run_legs`).
 * Klick statt Hover, damit es auch am Handy funktioniert.
 */
function CupScoreButton({
  score,
  open,
  onToggle,
}: {
  score: number
  open: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" className="cup-score-btn" onClick={onToggle}>
      <span className="glow-yellow">{score.toLocaleString('de-DE')}</span>
      <span className="cup-score-hint">{open ? '▲' : '▼'}</span>
    </button>
  )
}

/** Aufklappzeile mit den sechs Disziplin-Scores eines Cup-Laufs. */
function CupLegBreakdownRow({ cupRunId, colSpan }: { cupRunId: number; colSpan: number }) {
  const [legs, setLegs] = useState<CupRunLeg[] | null | 'loading'>('loading')

  useEffect(() => {
    let stale = false
    setLegs('loading')
    fetchCupRunLegs(cupRunId).then((l) => {
      if (!stale) setLegs(l)
    })
    return () => {
      stale = true
    }
  }, [cupRunId])

  return (
    <tr className="cup-legs-row">
      <td colSpan={colSpan}>
        {legs === 'loading' ? (
          <p className="dim center blink" style={{ margin: 0 }}>
            LADE…
          </p>
        ) : legs === null || legs.length === 0 ? (
          <p className="dim center" style={{ margin: 0 }}>
            Keine Aufschlüsselung verfügbar.
          </p>
        ) : (
          <div className="cup-legs-grid">
            {legs.map((l) => (
              <div key={l.mode} className="cup-legs-item">
                <span className="dim">{MODE_TITLES[l.mode] ?? l.mode}</span>
                <span className="glow-yellow">{l.score.toLocaleString('de-DE')}</span>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  )
}

export function ScoresScreen() {
  const [tab, setTab] = useState<Tab>('local')

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h2 className="glow-yellow center">🥇 Bestenliste</h2>

      <div className="tab-row">
        <button
          type="button"
          className={`pixel-btn${tab === 'local' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('local')}
        >
          Meine Rekorde
        </button>
        <button
          type="button"
          className={`pixel-btn${tab === 'global' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('global')}
          disabled={!isOnlineEnabled}
        >
          Global
        </button>
        <button
          type="button"
          className={`pixel-btn${tab === 'cups' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('cups')}
          disabled={!isOnlineEnabled}
        >
          Cups
        </button>
        <button
          type="button"
          className={`pixel-btn${tab === 'level' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('level')}
          disabled={!isOnlineEnabled}
        >
          Level
        </button>
      </div>

      {tab === 'local' && <LocalScores />}
      {tab === 'global' && <RequireAccount render={() => <GlobalScores />} />}
      {tab === 'cups' && <RequireAccount render={() => <CupScores />} />}
      {tab === 'level' && <RequireAccount render={() => <LevelScores />} />}
    </div>
  )
}

/**
 * Global lists are registered-accounts-only (server enforces it via RLS —
 * this is just the friendly explanation instead of an empty table).
 * Auch vom Erfolge-Screen genutzt (Phase G) — mit eigenem Teaser-Text.
 */
export function RequireAccount({
  render,
  message,
}: {
  render: () => ReactNode
  message?: string
}) {
  const status = useUserStore((s) => s.status)
  const isAnonymous = useUserStore((s) => s.isAnonymous)

  if (status === 'connecting') return <p className="dim center blink">VERBINDE…</p>
  if (status === 'online' && !isAnonymous) return <>{render()}</>

  return (
    <div className="stack center" style={{ gap: 16, padding: '24px 0' }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <p className="dim" style={{ margin: 0, maxWidth: 480 }}>
        {message ??
          'Die globalen Bestenlisten sind Spielern mit Account vorbehalten. ' +
            'Spielen kannst du jederzeit ohne — aber um dich einzutragen oder ' +
            'die Rangliste zu sehen, sichere kurz deinen Account.'}
      </p>
      <div>
        <Link to="/profile">
          <button type="button" className="pixel-btn pixel-btn--primary">
            Account sichern
          </button>
        </Link>
      </div>
    </div>
  )
}

/** Eigene Gruppen für den Global/Gruppe-Umschalter (nur registriert gerendert). */
function useMyGroups(): FriendGroup[] {
  const [groups, setGroups] = useState<FriendGroup[]>([])
  useEffect(() => {
    listMyGroups().then((g) => setGroups(g ?? []))
  }, [])
  return groups
}

/** Umschalter „🌍 Global / 👥 Gruppe" — erscheint erst, wenn Gruppen existieren. */
function ScopePicker({
  groups,
  groupId,
  onChange,
}: {
  groups: FriendGroup[]
  groupId: number | null
  onChange: (id: number | null) => void
}) {
  if (groups.length === 0) return null
  return (
    <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
      <button
        type="button"
        className={`pixel-btn pixel-btn--small${groupId === null ? ' pixel-btn--cyan' : ''}`}
        onClick={() => onChange(null)}
      >
        🌍 Global
      </button>
      {groups.map((g) => (
        <button
          key={g.group_id}
          type="button"
          className={`pixel-btn pixel-btn--small${groupId === g.group_id ? ' pixel-btn--cyan' : ''}`}
          onClick={() => onChange(g.group_id)}
        >
          👥 {g.name}
        </button>
      ))}
    </div>
  )
}

/** Zeitraum-Auswahl: rollierende Fenster (7/30/365 Tage) oder alles. */
function PeriodPicker({
  period,
  onChange,
}: {
  period: LeaderboardPeriod
  onChange: (p: LeaderboardPeriod) => void
}) {
  return (
    <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          className={`pixel-btn pixel-btn--small${period === p ? ' pixel-btn--cyan' : ''}`}
          onClick={() => onChange(p)}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  )
}

/** Lokal gespeicherte Modi inkl. Cup & Training — Reihenfolge der Filter-Chips. */
const LOCAL_FILTERS = [...(Object.keys(MODE_TITLES) as GameMode[]), 'cup', 'training'] as const
type LocalFilter = (typeof LOCAL_FILTERS)[number] | 'all'

/**
 * „Meine Rekorde": Allzeit-Top-10 je Kategorie auf diesem Gerät.
 * „Alle" zeigt die Bestmarke jeder Kategorie, ein Kategorie-Chip die Top 10.
 */
function LocalScores() {
  const bests = useProgressStore((s) => s.bests)
  const resetProgress = useProgressStore((s) => s.resetProgress)
  const [confirmReset, setConfirmReset] = useState(false)
  const [filter, setFilter] = useState<LocalFilter>('all')

  const showRank = filter !== 'all'
  const rows =
    filter === 'all'
      ? LOCAL_FILTERS.flatMap((f) => (bests[f]?.[0] ? [bests[f][0]] : []))
      : bests[filter] ?? []

  return (
    <>
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`pixel-btn pixel-btn--small${filter === 'all' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setFilter('all')}
        >
          Alle
        </button>
        {LOCAL_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`pixel-btn pixel-btn--small${filter === f ? ' pixel-btn--cyan' : ''}`}
            onClick={() => setFilter(f)}
          >
            {MODE_LABEL[f] ?? f}
          </button>
        ))}
      </div>

      <p className="dim center" style={{ margin: 0, fontSize: 18 }}>
        {filter === 'all'
          ? 'Deine Bestmarke in jeder Kategorie — nur auf diesem Gerät.'
          : 'Deine 10 besten Runden dieser Kategorie — nur auf diesem Gerät.'}
      </p>

      {rows.length === 0 ? (
        <p className="dim center">
          {filter === 'all'
            ? 'Noch keine Rekorde — spiel eine Runde, dann geht es hier los!'
            : 'In dieser Kategorie ist noch nichts — spiel eine Runde!'}
        </p>
      ) : (
        <table className="summary-table">
          <thead>
            <tr>
              <th>{showRank ? '#' : 'Modus'}</th>
              {showRank && <th>Modus</th>}
              <th>Punkte</th>
              <th>Fragen</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={`${s.mode}-${s.playedAt}-${i}`}>
                {showRank && <td className="dim">{i + 1}</td>}
                <td>{MODE_LABEL[s.mode] ?? s.mode}</td>
                <td className={s.mode === 'cup' ? undefined : 'glow-yellow'}>
                  {s.mode === 'cup' ? (
                    <CupScoreCell score={s.score} legs={s.cupLegs} />
                  ) : (
                    s.score
                  )}
                </td>
                <td className="dim">{s.questionCount}</td>
                <td className="dim">{formatDate(s.playedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row" style={{ justifyContent: 'center' }}>
        {confirmReset ? (
          <>
            <span className="dim">Wirklich alles löschen?</span>
            <button
              type="button"
              className="pixel-btn pixel-btn--danger"
              onClick={() => {
                resetProgress()
                setConfirmReset(false)
              }}
            >
              Ja, löschen
            </button>
            <button
              type="button"
              className="pixel-btn"
              onClick={() => setConfirmReset(false)}
            >
              Abbrechen
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pixel-btn"
            onClick={() => setConfirmReset(true)}
          >
            Fortschritt zurücksetzen
          </button>
        )}
      </div>
    </>
  )
}

function GlobalScores() {
  const [mode, setMode] = useState<GameMode>('flags')
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [groupId, setGroupId] = useState<number | null>(null)
  const groups = useMyGroups()
  const [rows, setRows] = useState<LeaderboardScore[] | null | 'loading'>('loading')
  const myName = useUserStore((s) => s.displayName)
  const avatarId = useAvatarStore((s) => s.avatarId)
  const { openCard, node } = useCardOverlay()
  const avatarMap = useAvatarMap(Array.isArray(rows) ? rows.map((r) => r.display_name) : [])

  useEffect(() => {
    let stale = false
    setRows('loading')
    fetchLeaderboardScores(mode, period, 25, groupId).then((r) => {
      if (!stale) setRows(r)
    })
    return () => {
      stale = true
    }
  }, [mode, period, groupId])

  return (
    <div className="stack" style={{ gap: 16 }}>
      <ScopePicker groups={groups} groupId={groupId} onChange={setGroupId} />
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {GAME_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`pixel-btn pixel-btn--small${mode === m ? ' pixel-btn--cyan' : ''}`}
            onClick={() => setMode(m)}
          >
            {MODE_TITLES[m]}
          </button>
        ))}
      </div>
      <PeriodPicker period={period} onChange={setPeriod} />

      {rows === 'loading' ? (
        <p className="dim center blink">LADE…</p>
      ) : rows === null ? (
        <p className="dim center">Leaderboard nicht erreichbar.</p>
      ) : rows.length === 0 ? (
        <p className="dim center">
          Noch keine Einträge in diesem Zeitraum — sei die/der Erste!
        </p>
      ) : (
        <table className="summary-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spieler</th>
              <th>Punkte</th>
              <th>Fragen</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = !!myName && r.display_name === myName
              return (
                <tr
                  key={`${r.display_name}-${r.played_at}-${i}`}
                  className={isMe ? 'leader-row-me' : undefined}
                >
                  <td className="dim">{i + 1}</td>
                  <td>
                    <LeaderName
                      name={r.display_name}
                      isMe={isMe}
                      avatarId={isMe ? avatarId : avatarMap.get(r.display_name)}
                      onOpen={openCard}
                    />
                  </td>
                  <td className="glow-yellow">{r.score}</td>
                  <td className="dim">{r.question_count}</td>
                  <td className="dim">{formatDate(r.played_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {node}
    </div>
  )
}

/** Level-Bestenliste (Phase G): XP-Konten absteigend, Level rechnet der Client. */
function LevelScores() {
  const [groupId, setGroupId] = useState<number | null>(null)
  const groups = useMyGroups()
  const [rows, setRows] = useState<LeaderboardLevelEntry[] | null | 'loading'>('loading')
  const myName = useUserStore((s) => s.displayName)
  const avatarId = useAvatarStore((s) => s.avatarId)
  const { openCard, node } = useCardOverlay()
  const avatarMap = useAvatarMap(Array.isArray(rows) ? rows.map((r) => r.display_name) : [])

  useEffect(() => {
    let stale = false
    setRows('loading')
    fetchLeaderboardLevels(25, groupId).then((r) => {
      if (!stale) setRows(r)
    })
    return () => {
      stale = true
    }
  }, [groupId])

  return (
    <div className="stack" style={{ gap: 16 }}>
      <ScopePicker groups={groups} groupId={groupId} onChange={setGroupId} />
      <p className="dim center" style={{ margin: 0, fontSize: 18 }}>
        XP aus Runden, Abzeichen und Pokalen — alle Zeiträume zusammen.
      </p>

      {rows === 'loading' ? (
        <p className="dim center blink">LADE…</p>
      ) : rows === null ? (
        <p className="dim center">Leaderboard nicht erreichbar.</p>
      ) : rows.length === 0 ? (
        <p className="dim center">
          Noch keine Level — spiel eine gewertete Runde, dann geht es los!
        </p>
      ) : (
        <table className="summary-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spieler</th>
              <th>Level</th>
              <th>XP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = !!myName && r.display_name === myName
              return (
                <tr
                  key={`${r.display_name}-${i}`}
                  className={isMe ? 'leader-row-me' : undefined}
                >
                  <td className="dim">{i + 1}</td>
                  <td>
                    <LeaderName
                      name={r.display_name}
                      isMe={isMe}
                      avatarId={isMe ? avatarId : avatarMap.get(r.display_name)}
                      onOpen={openCard}
                    />
                  </td>
                  <td className="glow-yellow">LVL {levelForXp(r.xp)}</td>
                  <td className="dim">{r.xp.toLocaleString('de-DE')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {node}
    </div>
  )
}

function CupScores() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [groupId, setGroupId] = useState<number | null>(null)
  const groups = useMyGroups()
  const [rows, setRows] = useState<LeaderboardCup[] | null | 'loading'>('loading')
  const myName = useUserStore((s) => s.displayName)
  const avatarId = useAvatarStore((s) => s.avatarId)
  const { openCard, node } = useCardOverlay()
  const avatarMap = useAvatarMap(Array.isArray(rows) ? rows.map((r) => r.display_name) : [])
  // Nur ein aufgeklappter Lauf gleichzeitig — erneuter Klick schließt ihn wieder.
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null)

  useEffect(() => {
    let stale = false
    setRows('loading')
    setExpandedRunId(null)
    fetchLeaderboardCups(period, 25, groupId).then((r) => {
      if (!stale) setRows(r)
    })
    return () => {
      stale = true
    }
  }, [period, groupId])

  return (
    <div className="stack" style={{ gap: 16 }}>
      <ScopePicker groups={groups} groupId={groupId} onChange={setGroupId} />
      <PeriodPicker period={period} onChange={setPeriod} />

      {rows === 'loading' ? (
        <p className="dim center blink">LADE…</p>
      ) : rows === null ? (
        <p className="dim center">Leaderboard nicht erreichbar.</p>
      ) : rows.length === 0 ? (
        <p className="dim center">
          Noch keine Cup-Läufe in diesem Zeitraum — spiel den ersten!
        </p>
      ) : (
        <table className="summary-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spieler</th>
              <th>Cup-Score</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = !!myName && r.display_name === myName
              // Ohne Migration 0011 fehlt cup_run_id noch — dann bleibt der
              // Score wie bisher reiner Text statt Aufklapp-Button.
              const hasRunId = typeof r.cup_run_id === 'number'
              const isOpen = hasRunId && expandedRunId === r.cup_run_id
              return (
                <Fragment key={`${r.display_name}-${r.played_at}-${i}`}>
                  <tr className={isMe ? 'leader-row-me' : undefined}>
                    <td className="dim">{i + 1}</td>
                    <td>
                      <LeaderName
                        name={r.display_name}
                        isMe={isMe}
                        avatarId={isMe ? avatarId : avatarMap.get(r.display_name)}
                        onOpen={openCard}
                      />
                    </td>
                    <td>
                      {hasRunId ? (
                        <CupScoreButton
                          score={r.total_score}
                          open={isOpen}
                          onToggle={() => setExpandedRunId(isOpen ? null : r.cup_run_id)}
                        />
                      ) : (
                        <span className="glow-yellow">{r.total_score}</span>
                      )}
                    </td>
                    <td className="dim">{formatDate(r.played_at)}</td>
                  </tr>
                  {isOpen && <CupLegBreakdownRow cupRunId={r.cup_run_id} colSpan={4} />}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
      {node}
    </div>
  )
}
