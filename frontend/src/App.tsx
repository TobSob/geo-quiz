import { useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { HomeScreen } from './routes/HomeScreen'
import { PlayScreen } from './routes/PlayScreen'
import { CupScreen } from './routes/CupScreen'
import { TrainingScreen } from './routes/TrainingScreen'
import { ScoresScreen } from './routes/ScoresScreen'
import { ProfileScreen } from './routes/ProfileScreen'
import { AchievementsScreen } from './routes/AchievementsScreen'
import { ensureSession } from './api/authApi'
import { isOnlineEnabled } from './api/supabaseClient'
import { applyAuthSession } from './features/auth/applySession'
import { useUserStore } from './state/userStore'
import { useSettingsStore } from './state/settingsStore'
import { useAvatarStore } from './state/avatarStore'
import { PixelAvatar } from './components/PixelAvatar'
import { useGamificationStore } from './state/gamificationStore'
import { levelForXp } from './features/gamification/levels'

function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const status = useUserStore((s) => s.status)
  const isAnonymous = useUserStore((s) => s.isAnonymous)
  const muted = useSettingsStore((s) => s.muted)
  const toggleMuted = useSettingsStore((s) => s.toggleMuted)
  const avatarId = useAvatarStore((s) => s.avatarId)
  const gamificationStatus = useGamificationStore((s) => s.status)
  const xp = useGamificationStore((s) => s.xp)

  // Beim Screenwechsel immer nach oben — sonst startet z. B. eine Runde noch
  // an der weit unten gescrollten Menü-Position.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Android-System-Back: überall zurück ins Menü statt App schließen; nur auf
  // dem Home-Screen behält er sein Systemverhalten (App beenden). Der Listener
  // hängt genau einmal und liest die Route zur Event-Zeit aus dem Hash —
  // die Hash-Zuweisung reicht dem HashRouter als Navigation.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = CapacitorApp.addListener('backButton', () => {
      const onHome = window.location.hash === '' || window.location.hash === '#/'
      if (onHome) void CapacitorApp.exitApp()
      else window.location.hash = '#/'
    })
    return () => {
      void handle.then((h) => h.remove())
    }
  }, [])

  // Anonymous sign-in on launch, then restore the full account state
  // (progress queue, avatar, gamification) via the shared session helper.
  useEffect(() => {
    if (!isOnlineEnabled) return
    useUserStore.getState().setConnecting()
    ensureSession().then((auth) => void applyAuthSession(auth))
  }, [])

  const showLevel =
    status === 'online' && !isAnonymous && gamificationStatus === 'ready'

  return (
    <div className="crt">
      <div className="stars" />
      <header className="row app-header">
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
            LVL {levelForXp(xp)}
          </Link>
        )}
        <Link
          to="/profile"
          title={
            status === 'online'
              ? 'Mit dem Leaderboard verbunden — zum Profil'
              : status === 'connecting'
                ? 'Verbinde… — zum Profil'
                : 'Offline — Scores nur lokal · zum Profil'
          }
          style={{ marginRight: 12, display: 'flex', textDecoration: 'none' }}
        >
          {/* Status steckt jetzt im Punkt am Avatar — spart Platz auf Handys. */}
          <span className={`header-avatar header-avatar--${status}`}>
            <PixelAvatar id={avatarId} size={30} />
          </span>
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
        {/* Fängt u. a. den kurzen Moment ab, bevor supabase-js einen
            OAuth-Erfolgs-Redirect (#access_token=…) aus der URL entfernt —
            sonst würde der HashRouter das als unbekannten Pfad leer rendern. */}
        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Routes>
    </div>
  )
}

export default App
