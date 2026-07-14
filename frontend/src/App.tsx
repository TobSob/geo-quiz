import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { HomeScreen } from './routes/HomeScreen'
import { PlayScreen } from './routes/PlayScreen'
import { CupScreen } from './routes/CupScreen'
import { TrainingScreen } from './routes/TrainingScreen'
import { ScoresScreen } from './routes/ScoresScreen'
import { ProfileScreen } from './routes/ProfileScreen'
import { AchievementsScreen } from './routes/AchievementsScreen'
import { ensureSession } from './api/authApi'
import { isOnlineEnabled } from './api/supabaseClient'
import { flushProgress } from './features/progress/progressSync'
import { useUserStore } from './state/userStore'
import { useSettingsStore } from './state/settingsStore'
import { useGamificationStore } from './state/gamificationStore'
import { levelForXp } from './features/gamification/levels'

function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const status = useUserStore((s) => s.status)
  const isAnonymous = useUserStore((s) => s.isAnonymous)
  const muted = useSettingsStore((s) => s.muted)
  const toggleMuted = useSettingsStore((s) => s.toggleMuted)
  const gamificationStatus = useGamificationStore((s) => s.status)
  const xp = useGamificationStore((s) => s.xp)

  // Anonymous sign-in on launch, then push any progress queued while offline.
  useEffect(() => {
    if (!isOnlineEnabled) return
    const { setOnline, setOffline, setConnecting } = useUserStore.getState()
    const gamification = useGamificationStore.getState()
    setConnecting()
    ensureSession().then((auth) => {
      if (auth) {
        setOnline(auth)
        void flushProgress()
        // XP/Badges/Pokale gibt es nur für registrierte Accounts (Phase G).
        if (!auth.isAnonymous) void gamification.load()
        else gamification.reset()
      } else {
        setOffline()
        gamification.reset()
      }
    })
  }, [])

  const showLevel =
    status === 'online' && !isAnonymous && gamificationStatus === 'ready'

  return (
    <div className="crt">
      <div className="stars" />
      <header className="row" style={{ marginBottom: 28 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span className="display glow-green" style={{ fontSize: 18 }}>
            GEO<span className="glow-cyan">QUIZ</span>
          </span>
        </Link>
        <div className="spacer" />
        <button
          type="button"
          onClick={toggleMuted}
          title={muted ? 'Sound einschalten' : 'Sound ausschalten'}
          aria-label={muted ? 'Sound einschalten' : 'Sound ausschalten'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            marginRight: 16,
            padding: 0,
            opacity: muted ? 0.5 : 1,
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {showLevel && (
          <Link
            to="/achievements"
            className="display glow-yellow"
            style={{ fontSize: 12, marginRight: 16, textDecoration: 'none' }}
            title="Erfolge: Abzeichen, Pokale & Level"
          >
            LV {levelForXp(xp)}
          </Link>
        )}
        <Link
          to="/profile"
          className="dim"
          style={{ fontSize: 18, marginRight: 16, textDecoration: 'none' }}
          title={
            status === 'online'
              ? 'Mit dem Leaderboard verbunden — zum Profil'
              : status === 'connecting'
                ? 'Verbinde…'
                : 'Offline — Scores werden nur lokal gespeichert'
          }
        >
          {status === 'online' ? '● ONLINE' : status === 'connecting' ? '○ …' : '○ OFFLINE'}
        </Link>
        {!isHome && (
          <Link to="/" className="dim" style={{ fontSize: 20 }}>
            ◀ Menü
          </Link>
        )}
      </header>

      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/play/:mode" element={<PlayScreen />} />
        <Route path="/cup" element={<CupScreen />} />
        <Route path="/training" element={<TrainingScreen />} />
        <Route path="/scores" element={<ScoresScreen />} />
        <Route path="/achievements" element={<AchievementsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>
    </div>
  )
}

export default App
