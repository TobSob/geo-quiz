import { useEffect, useState, type ReactNode } from 'react'
import { useProgressStore } from '../state/progressStore'
import { MODE_TITLES } from './PlayScreen'
import {
  fetchLeaderboardCups,
  fetchLeaderboardScores,
  PERIOD_LABELS,
  type LeaderboardCup,
  type LeaderboardPeriod,
  type LeaderboardScore,
} from '../api/leaderboardApi'
import { isOnlineEnabled } from '../api/supabaseClient'
import { listMyGroups, type FriendGroup } from '../api/groupApi'
import { useUserStore } from '../state/userStore'
import type { GameMode } from '../features/quiz-engine/types'
import { Link } from 'react-router-dom'

const MODE_LABEL: Record<string, string> = {
  ...MODE_TITLES,
  cup: '🏆 Geo Cup',
  training: '🎯 Training',
}

const GAME_MODES = Object.keys(MODE_TITLES) as GameMode[]
const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'year', 'all']

type Tab = 'local' | 'global' | 'cups'

function formatDate(ts: number | string): string {
  return new Date(ts).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ScoresScreen() {
  const [tab, setTab] = useState<Tab>('local')

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h2 className="glow-yellow center">🥇 Bestenliste</h2>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button
          type="button"
          className={`pixel-btn${tab === 'local' ? ' pixel-btn--cyan' : ''}`}
          onClick={() => setTab('local')}
        >
          Lokal
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
      </div>

      {tab === 'local' && <LocalScores />}
      {tab === 'global' && <RequireAccount render={() => <GlobalScores />} />}
      {tab === 'cups' && <RequireAccount render={() => <CupScores />} />}
    </div>
  )
}

/**
 * Global lists are registered-accounts-only (server enforces it via RLS —
 * this is just the friendly explanation instead of an empty table).
 */
function RequireAccount({ render }: { render: () => ReactNode }) {
  const status = useUserStore((s) => s.status)
  const isAnonymous = useUserStore((s) => s.isAnonymous)

  if (status === 'connecting') return <p className="dim center blink">VERBINDE…</p>
  if (status === 'online' && !isAnonymous) return <>{render()}</>

  return (
    <div className="stack center" style={{ gap: 16, padding: '24px 0' }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <p className="dim" style={{ margin: 0, maxWidth: 480 }}>
        Die globalen Bestenlisten sind Spielern mit Account vorbehalten.
        Spielen kannst du jederzeit ohne — aber um dich einzutragen oder die
        Rangliste zu sehen, sichere kurz deinen Account.
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

function LocalScores() {
  const scores = useProgressStore((s) => s.scores)
  const resetProgress = useProgressStore((s) => s.resetProgress)
  const [confirmReset, setConfirmReset] = useState(false)

  // Arcade-Scores sind Rohpunkte — sortiert wird schlicht nach Punktzahl.
  const sorted = [...scores].sort((a, b) => b.score - a.score)

  return (
    <>
      {sorted.length === 0 ? (
        <p className="dim center">
          Noch keine Ergebnisse — spiel eine Runde, dann taucht sie hier auf!
        </p>
      ) : (
        <table className="summary-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Modus</th>
              <th>Punkte</th>
              <th>Fragen</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 25).map((s, i) => (
              <tr key={`${s.playedAt}-${i}`}>
                <td className="dim">{i + 1}</td>
                <td>{MODE_LABEL[s.mode] ?? s.mode}</td>
                <td className="glow-yellow">{s.score}</td>
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
            {rows.map((r, i) => (
              <tr key={`${r.display_name}-${r.played_at}-${i}`}>
                <td className="dim">{i + 1}</td>
                <td className="glow-cyan">{r.display_name}</td>
                <td className="glow-yellow">{r.score}</td>
                <td className="dim">{r.question_count}</td>
                <td className="dim">{formatDate(r.played_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CupScores() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [groupId, setGroupId] = useState<number | null>(null)
  const groups = useMyGroups()
  const [rows, setRows] = useState<LeaderboardCup[] | null | 'loading'>('loading')

  useEffect(() => {
    let stale = false
    setRows('loading')
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
            {rows.map((r, i) => (
              <tr key={`${r.display_name}-${r.played_at}-${i}`}>
                <td className="dim">{i + 1}</td>
                <td className="glow-cyan">{r.display_name}</td>
                <td className="glow-yellow">{r.total_score}</td>
                <td className="dim">{formatDate(r.played_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
