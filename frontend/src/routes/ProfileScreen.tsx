import { useState, type CSSProperties } from 'react'
import {
  ensureSession,
  signInWithEmail,
  signOutUser,
  updateDisplayName,
  upgradeToAccount,
} from '../api/authApi'
import { isOnlineEnabled } from '../api/supabaseClient'
import { flushProgress } from '../features/progress/progressSync'
import { useUserStore } from '../state/userStore'

const inputStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 20,
  background: 'var(--bg-deep)',
  color: 'var(--ink)',
  border: '4px solid var(--shadow)',
  padding: '10px 12px',
  width: '100%',
  maxWidth: 340,
}

export function ProfileScreen() {
  const { status, displayName, isAnonymous, email } = useUserStore()

  if (!isOnlineEnabled) {
    return (
      <p className="dim center">
        Kein Backend konfiguriert — das Spiel läuft im Offline-Modus.
      </p>
    )
  }

  if (status !== 'online') {
    return (
      <p className="dim center blink">
        {status === 'connecting' ? 'VERBINDE…' : 'OFFLINE — Server nicht erreichbar.'}
      </p>
    )
  }

  return (
    <div className="stack" style={{ gap: 28, maxWidth: 560, margin: '0 auto', width: '100%' }}>
      <h2 className="glow-cyan center">👤 Profil</h2>

      <div className="pixel-panel stack" style={{ padding: 20 }}>
        <NameEditor />
        <div className="dim" style={{ fontSize: 19 }}>
          Status:{' '}
          {isAnonymous ? (
            <span className="glow-yellow">Gast (anonym)</span>
          ) : (
            <span className="glow-green">Registriert{email ? ` — ${email}` : ''}</span>
          )}
        </div>
      </div>

      {isAnonymous ? <UpgradePanel /> : <LogoutPanel />}
      {isAnonymous && <LoginPanel />}

      <p className="dim" style={{ fontSize: 18, lineHeight: 1.3 }}>
        Als Gast kannst du alles spielen — Scores und Lernfortschritt bleiben
        aber an dieses Gerät gebunden. Mit Account kommst du auf die globalen
        Bestenlisten, kannst sie einsehen und dich auf jedem Gerät anmelden
        ({displayName ?? 'dein Name'} bleibt dabei erhalten).
      </p>
    </div>
  )
}

function NameEditor() {
  const displayName = useUserStore((s) => s.displayName)
  const setDisplayName = useUserStore((s) => s.setDisplayName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const ok = await updateDisplayName(draft)
    setSaving(false)
    if (ok) {
      setDisplayName(draft.trim().slice(0, 24))
      setEditing(false)
    }
  }

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            maxLength={24}
            style={{ ...inputStyle, fontFamily: 'var(--font-display)', fontSize: 12, width: 240 }}
          />
          <button
            type="button"
            className="pixel-btn pixel-btn--primary"
            disabled={saving || draft.trim().length < 2}
            onClick={save}
          >
            OK
          </button>
          <button type="button" className="pixel-btn" onClick={() => setEditing(false)}>
            X
          </button>
        </>
      ) : (
        <>
          <span className="display glow-cyan" style={{ fontSize: 14 }}>
            {displayName}
          </span>
          <button
            type="button"
            className="pixel-btn"
            style={{ fontSize: 9, padding: '8px 10px' }}
            onClick={() => {
              setDraft(displayName ?? '')
              setEditing(true)
            }}
          >
            Ändern
          </button>
        </>
      )}
    </div>
  )
}

function UpgradePanel() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    const result = await upgradeToAccount(email.trim(), password)
    setBusy(false)
    setMessage(result.message)
    if (result.ok) {
      const auth = await ensureSession()
      if (auth) useUserStore.getState().setOnline(auth)
    }
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20 }}>
      <h3 className="glow-green">Account sichern</h3>
      <p className="dim" style={{ margin: 0, fontSize: 19 }}>
        Macht deinen Gast-Zugang dauerhaft und schaltet die globalen
        Bestenlisten frei — gleicher Fortschritt, gleicher Name.
      </p>
      <input
        type="email"
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Passwort (min. 6 Zeichen)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      />
      <div>
        <button
          type="button"
          className="pixel-btn pixel-btn--primary"
          disabled={busy || !email.includes('@') || password.length < 6}
          onClick={submit}
        >
          {busy ? '…' : 'Upgrade'}
        </button>
      </div>
      {message && <p className="glow-yellow" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}

function LoginPanel() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    const result = await signInWithEmail(email.trim(), password)
    setBusy(false)
    if (result.ok) {
      const auth = await ensureSession()
      if (auth) useUserStore.getState().setOnline(auth)
      void flushProgress()
      setMessage('Angemeldet — Fortschritt dieses Geräts wird deinem Account zugerechnet.')
    } else {
      setMessage(result.message)
    }
  }

  if (!open) {
    return (
      <button type="button" className="pixel-btn" onClick={() => setOpen(true)}>
        Ich habe schon einen Account
      </button>
    )
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20 }}>
      <h3 className="glow-cyan">Anmelden</h3>
      <input
        type="email"
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Passwort"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      />
      <div className="row">
        <button
          type="button"
          className="pixel-btn pixel-btn--cyan"
          disabled={busy || !email.includes('@') || password.length < 6}
          onClick={submit}
        >
          {busy ? '…' : 'Login'}
        </button>
        <button type="button" className="pixel-btn" onClick={() => setOpen(false)}>
          X
        </button>
      </div>
      {message && <p className="glow-yellow" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}

function LogoutPanel() {
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    setBusy(true)
    await signOutUser()
    // next ensureSession() call starts a fresh anonymous identity
    const auth = await ensureSession()
    if (auth) useUserStore.getState().setOnline(auth)
    else useUserStore.getState().setOffline()
    setBusy(false)
  }

  return (
    <div>
      <button type="button" className="pixel-btn pixel-btn--danger" disabled={busy} onClick={logout}>
        {busy ? '…' : 'Abmelden'}
      </button>
    </div>
  )
}
