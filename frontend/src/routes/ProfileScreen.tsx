import { useEffect, useState, type CSSProperties } from 'react'
import {
  ensureSession,
  signInWithEmail,
  signOutUser,
  updateDisplayName,
  upgradeToAccount,
} from '../api/authApi'
import {
  createGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  listMyGroups,
  type FriendGroup,
} from '../api/groupApi'
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

      {!isAnonymous && <GroupsPanel />}
      {isAnonymous ? <UpgradePanel /> : <LogoutPanel />}
      {isAnonymous && <LoginPanel />}

      <p className="dim" style={{ fontSize: 18, lineHeight: 1.3 }}>
        Als Gast kannst du alles spielen — Scores und Lernfortschritt bleiben
        aber an dieses Gerät gebunden. Mit Account kommst du auf die globalen
        Bestenlisten, kannst Freundesgruppen erstellen und dich auf jedem
        Gerät anmelden ({displayName ?? 'dein Name'} bleibt dabei erhalten).
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

/**
 * Freundesgruppen (Phase F): erstellen (Code teilen), per Code beitreten,
 * verlassen; Ersteller können löschen. Nur für registrierte Accounts.
 */
function GroupsPanel() {
  const [groups, setGroups] = useState<FriendGroup[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)

  const reload = () => listMyGroups().then((g) => setGroups(g ?? []))
  useEffect(() => {
    void reload()
  }, [])

  const shareCode = async (g: FriendGroup) => {
    const text = `Tritt meiner GeoQuiz-Gruppe „${g.name}" bei! Code: ${g.code}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // Nutzer hat das Share-Sheet abgebrochen — kein Fehler
        return
      }
    }
    await navigator.clipboard.writeText(g.code)
    setMessage(`Code ${g.code} kopiert!`)
  }

  const submitCreate = async () => {
    setBusy(true)
    setMessage(null)
    const result = await createGroup(createName)
    setBusy(false)
    setMessage(result.message)
    if (result.ok) {
      setCreateName('')
      void reload()
    }
  }

  const submitJoin = async () => {
    setBusy(true)
    setMessage(null)
    const result = await joinGroup(joinCode)
    setBusy(false)
    setMessage(result.message)
    if (result.ok) {
      setJoinCode('')
      void reload()
    }
  }

  const remove = async (g: FriendGroup) => {
    setBusy(true)
    const ok = g.is_owner ? await deleteGroup(g.group_id) : await leaveGroup(g.group_id)
    setBusy(false)
    setConfirmRemove(null)
    setMessage(
      ok
        ? g.is_owner
          ? `Gruppe „${g.name}" gelöscht.`
          : `Du hast „${g.name}" verlassen.`
        : 'Etwas ist schiefgelaufen — bitte versuche es erneut.',
    )
    void reload()
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20 }}>
      <h3 className="glow-yellow">👥 Freundesgruppen</h3>
      <p className="dim" style={{ margin: 0, fontSize: 19 }}>
        Erstelle eine Gruppe und teile den Code — in der Bestenliste könnt ihr
        dann eure Bestleistungen vergleichen.
      </p>

      {groups.length > 0 && (
        <div className="stack" style={{ gap: 10 }}>
          {groups.map((g) => (
            <div key={g.group_id} className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <span className="display glow-cyan" style={{ fontSize: 11 }}>
                {g.name}
              </span>
              <span className="dim" style={{ fontSize: 18 }}>
                {g.code} · {g.member_count}{' '}
                {g.member_count === 1 ? 'Mitglied' : 'Mitglieder'}
              </span>
              <div className="spacer" />
              <button
                type="button"
                className="pixel-btn pixel-btn--small"
                onClick={() => shareCode(g)}
              >
                Code teilen
              </button>
              {confirmRemove === g.group_id ? (
                <>
                  <button
                    type="button"
                    className="pixel-btn pixel-btn--small pixel-btn--danger"
                    disabled={busy}
                    onClick={() => remove(g)}
                  >
                    {g.is_owner ? 'Wirklich löschen?' : 'Wirklich verlassen?'}
                  </button>
                  <button
                    type="button"
                    className="pixel-btn pixel-btn--small"
                    onClick={() => setConfirmRemove(null)}
                  >
                    X
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="pixel-btn pixel-btn--small"
                  onClick={() => setConfirmRemove(g.group_id)}
                >
                  {g.is_owner ? 'Löschen' : 'Verlassen'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input
          placeholder="Neue Gruppe (Name)"
          value={createName}
          maxLength={24}
          onChange={(e) => setCreateName(e.target.value)}
          style={{ ...inputStyle, maxWidth: 220 }}
        />
        <button
          type="button"
          className="pixel-btn pixel-btn--primary"
          disabled={busy || createName.trim().length < 2}
          onClick={submitCreate}
        >
          Erstellen
        </button>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input
          placeholder="Beitritts-Code"
          value={joinCode}
          maxLength={32}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          style={{ ...inputStyle, maxWidth: 220, fontFamily: 'var(--font-display)', fontSize: 12 }}
        />
        <button
          type="button"
          className="pixel-btn pixel-btn--cyan"
          disabled={busy || joinCode.trim().length < 4}
          onClick={submitJoin}
        >
          Beitreten
        </button>
      </div>

      {message && <p className="glow-yellow" style={{ margin: 0 }}>{message}</p>}
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
        Bestenlisten und Freundesgruppen frei — gleicher Fortschritt,
        gleicher Name.
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
          {busy ? '…' : 'Account erstellen'}
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
          {busy ? '…' : 'Anmelden'}
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
