import { useEffect, useState, type ReactNode } from 'react'
import { useProgressStore } from '../state/progressStore'
import { MODE_TITLES } from './PlayScreen'
import {
  fetchLeaderboardCups,
  fetchLeaderboardScores,
  type LeaderboardCup,
  type LeaderboardScore,
} from '../api/leaderboardApi'
import { isOnlineEnabled } from '../api/supabaseClient'
import { useUserStore } from '../state/userStore'
import { Link } from 'react-router-dom'

const MODE_LABEL: Record<string, string> = {
  ...MODE_TITLES,
  cup: '🏆 Geo Cup',
  training: '🎯 Training',
}

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

function LocalScores() {
  const scores = useProgressStore((s) => s.scores)
  const resetProgress = useProgressStore((s) => s.resetProgress)
  const [confirmReset, setConfirmReset] = useState(false)

  const sorted = [...scores].sort((a, b) => {
    const pctA = a.maxPossible ? a.score / a.maxPossible : 0
    const pctB = b.maxPossible ? b.score / b.maxPossible : 0
    return pctB - pctA
  })

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
              <th>%</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 25).map((s, i) => (
              <tr key={`${s.playedAt}-${i}`}>
                <td className="dim">{i + 1}</td>
                <td>{MODE_LABEL[s.mode] ?? s.mode}</td>
                <td className="glow-yellow">
                  {s.score}
                  <span className="dim">/{s.maxPossible}</span>
                </td>
                <td>
                  {s.maxPossible ? Math.round((100 * s.score) / s.maxPossible) : 0}%
                </td>
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
  const [rows, setRows] = useState<LeaderboardScore[] | null | 'loading'>('loading')

  useEffect(() => {
    fetchLeaderboardScores().then(setRows)
  }, [])

  if (rows === 'loading') return <p className="dim center blink">LADE…</p>
  if (rows === null)
    return <p className="dim center">Leaderboard nicht erreichbar.</p>
  if (rows.length === 0)
    return <p className="dim center">Noch keine globalen Einträge — sei die/der Erste!</p>

  return (
    <table className="summary-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Spieler</th>
          <th>Modus</th>
          <th>Punkte</th>
          <th>%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.display_name}-${r.played_at}-${i}`}>
            <td className="dim">{i + 1}</td>
            <td className="glow-cyan">{r.display_name}</td>
            <td>{MODE_LABEL[r.mode] ?? r.mode}</td>
            <td className="glow-yellow">
              {r.score}
              <span className="dim">/{r.max_possible}</span>
            </td>
            <td>{r.percent}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CupScores() {
  const [rows, setRows] = useState<LeaderboardCup[] | null | 'loading'>('loading')

  useEffect(() => {
    fetchLeaderboardCups().then(setRows)
  }, [])

  if (rows === 'loading') return <p className="dim center blink">LADE…</p>
  if (rows === null)
    return <p className="dim center">Leaderboard nicht erreichbar.</p>
  if (rows.length === 0)
    return <p className="dim center">Noch keine Cup-Läufe — spiel den ersten!</p>

  return (
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
            <td className="glow-yellow">{r.total_score}/100</td>
            <td className="dim">{formatDate(r.played_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
