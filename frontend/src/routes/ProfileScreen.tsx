import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  consumeEmailLinkMessage,
  consumePendingOAuthMessage,
  consumeRecoveryFlag,
  continueWithProvider,
  deleteOwnAccount,
  ensureSession,
  OAUTH_PROVIDER_LABELS,
  onPasswordRecovery,
  requestPasswordReset,
  setNewPassword,
  signInWithEmail,
  signOutUser,
  updateDisplayName,
  upgradeToAccount,
  type OAuthProvider,
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
import { applyAuthSession } from '../features/auth/applySession'
import {
  MIN_PASSWORD_LENGTH,
  passwordProblemMessage,
  validateNewPassword,
} from '../features/auth/recovery'
import { DEFAULT_AVATAR_ID } from '../features/avatars/avatarCatalog'
import { useAvatarStore } from '../state/avatarStore'
import { useProgressStore } from '../state/progressStore'
import { useUserStore } from '../state/userStore'
import { PlayerCard } from '../components/PlayerCard'
import { AvatarPicker } from '../components/AvatarPicker'
import { TrophyShelfEditor } from '../components/TrophyShelf'

/**
 * Absolut, nicht relativ: in der Android-App ist der Origin `https://localhost`
 * (Capacitor-WebView), ein „/datenschutz/" liefe dort ins Leere. Die Seiten
 * liegen statisch in `public/` und werden von Cloudflare Pages ausgeliefert.
 */
const PRIVACY_URL = 'https://geoquiz.tobsob.dev/datenschutz/'
const IMPRINT_URL = 'https://geoquiz.tobsob.dev/impressum/'

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
  return (
    <div className="stack" style={{ gap: 28, maxWidth: 560, margin: '0 auto', width: '100%' }}>
      <h2 className="glow-cyan center">👤 Profil</h2>
      <PasswordRecoveryPanel />
      <PlayerCard />
      <TrophyShelfEditor />
      <AvatarPicker />
      <AccountSection />
      <LegalFooter />
    </div>
  )
}

/**
 * Neues Passwort setzen, nachdem der Reset-Link geöffnet wurde
 * (DESIGN-PASSWORD-RESET.md). Steht ganz oben im Profil — wer über den Link
 * kommt, will genau eine Sache tun.
 *
 * Der Modus wird über ZWEI unabhängige Wege erkannt: den synchron in
 * `main.tsx` gesetzten Marker (falls der Router schneller war als supabase-js)
 * und das `PASSWORD_RECOVERY`-Event (falls die Seite schon stand). Welcher
 * zuerst greift, hängt vom Timing ab; zusammen sind sie robust.
 */
function PasswordRecoveryPanel() {
  const [active, setActive] = useState(false)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (consumeRecoveryFlag()) setActive(true)
    return onPasswordRecovery(() => setActive(true))
  }, [])

  if (!active) return null

  const problem = validateNewPassword(password, repeat)

  // Der Speichern-Knopf ist bei einem Problem deaktiviert — dann muss daneben
  // stehen, WARUM, sonst hängt man vor einem toten Knopf. Die Meldung kommt
  // aber erst, wenn das jeweilige Feld überhaupt angefasst wurde: „mindestens
  // 6 Zeichen" beim ersten Tastendruck wäre Meckern, nicht Hilfe.
  const showHint =
    (problem === 'too-short' && password.length > 0) ||
    (problem === 'mismatch' && repeat.length > 0)
  const hint = showHint ? passwordProblemMessage(problem) : null

  const submit = async () => {
    if (problem) {
      setMessage(passwordProblemMessage(problem))
      return
    }
    setBusy(true)
    setMessage(null)
    const result = await setNewPassword(password)
    if (result.ok) {
      // Wie beim normalen Login: kompletter Zustand, nicht nur die Sitzung.
      const auth = await ensureSession()
      await applyAuthSession(auth)
      setDone(true)
    }
    setBusy(false)
    setMessage(result.message)
    setPassword('')
    setRepeat('')
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20 }}>
      <h3 className="glow-yellow">🔑 Neues Passwort setzen</h3>
      {done ? (
        <>
          <p style={{ margin: 0, fontSize: 19 }}>{message}</p>
          <div>
            <button type="button" className="pixel-btn" onClick={() => setActive(false)}>
              Weiter
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="dim" style={{ margin: 0, fontSize: 19 }}>
            Vergib ein neues Passwort für deinen Account — mindestens{' '}
            {MIN_PASSWORD_LENGTH} Zeichen.
          </p>
          <input
            type="password"
            placeholder="Neues Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Noch einmal"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            style={inputStyle}
          />
          <div>
            <button
              type="button"
              className="pixel-btn pixel-btn--cyan"
              disabled={busy || problem !== null}
              onClick={submit}
            >
              {busy ? '…' : 'Passwort speichern'}
            </button>
          </div>
          {(hint ?? message) && (
            <p className="glow-yellow" style={{ margin: 0 }}>
              {hint ?? message}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Rechtliche Links — der Datenschutz-Link ist Pflichtangabe für den
 * Play-Store-Eintrag, das Impressum muss „leicht erkennbar und unmittelbar
 * erreichbar" sein (§ 5 DDG); beides gehört an die Stelle, an der Leute danach
 * suchen. Bewusst außerhalb der AccountSection, damit sie auch im
 * Offline-Modus da sind. `target="_blank"` öffnet in der Android-App den
 * System-Browser (Capacitor lädt externe URLs nicht in die WebView), im Web
 * einen neuen Tab.
 */
function LegalFooter() {
  return (
    <p className="dim center" style={{ fontSize: 17, margin: 0 }}>
      <a href={IMPRINT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
        Impressum
      </a>
      {' · '}
      <a href={PRIVACY_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
        Datenschutzerklärung
      </a>
      {' · '}
      <Link to="/credits" style={{ color: 'var(--cyan)' }}>
        Nachweise
      </Link>
    </p>
  )
}

/** Account-Teil (Name, Gruppen, An-/Abmelden) — nur mit erreichbarem Server. */
function AccountSection() {
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
    <>
      <EmailLinkNotice />
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
      {isAnonymous ? <LoginPanel /> : <LogoutPanel />}
      {isAnonymous && <RegisterToggle />}

      <p className="dim" style={{ fontSize: 18, lineHeight: 1.3 }}>
        Als Gast kannst du alles spielen — Scores und Lernfortschritt bleiben
        aber an dieses Gerät gebunden. Mit Account kommst du auf die globalen
        Bestenlisten, kannst Freundesgruppen erstellen und dich auf jedem
        Gerät anmelden ({displayName ?? 'dein Name'} bleibt dabei erhalten).
      </p>

      <DangerZone />
    </>
  )
}

/**
 * Rückmeldung zum Link aus einer Auth-Mail (DESIGN-MAIL-DOMAIN.md). Wird erst
 * im Online-Zweig gemountet: Die Meldung entsteht in ensureSession() und liegt
 * damit sicher bereit, sobald der Status auf „online" steht — beim Mount des
 * Profils wäre sie noch nicht da.
 */
function EmailLinkNotice() {
  const [message, setMessage] = useState<string | null>(null)
  // Im Effekt statt als useState-Initialisierer: StrictMode ruft beides
  // doppelt auf, und der zweite Aufruf fände die schon abgeholte Meldung
  // nicht mehr. `if (msg)` verhindert, dass er sie mit null überschreibt.
  useEffect(() => {
    const msg = consumeEmailLinkMessage()
    if (msg) setMessage(msg)
  }, [])
  if (!message) return null
  return (
    <p className="pixel-panel glow-yellow center" style={{ padding: 16, margin: 0 }}>
      {message}
    </p>
  )
}

/**
 * Konto löschen (DESIGN-PLAYSTORE.md) — Play verlangt den Weg in der App.
 * Auch für Gäste sichtbar: an einer anonymen Sitzung hängen serverseitig
 * Profil und Lernfortschritt.
 *
 * Reihenfolge ist wichtig: erst der Server, dann lokal. Bei einem Serverfehler
 * bleibt lokal alles stehen — sonst wäre der Fortschritt hier weg und dort
 * noch da. Danach sofort eine frische anonyme Sitzung, sonst stünde die App
 * ohne Identität da und die nächste Runde liefe ins Leere.
 */
function DangerZone() {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setMessage(null)
    const result = await deleteOwnAccount()
    if (!result.ok) {
      setBusy(false)
      setConfirming(false)
      setMessage(result.message)
      return
    }

    useProgressStore.getState().resetProgress()
    // setState statt setAvatar(): setAvatar würde den Default gleich wieder
    // ans Profil des frischen Gastkontos schreiben.
    useAvatarStore.setState({ avatarId: DEFAULT_AVATAR_ID })
    await signOutUser()
    const auth = await ensureSession()
    await applyAuthSession(auth)

    setBusy(false)
    setConfirming(false)
    setMessage(result.message)
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20 }}>
      <h3 className="glow-red">⚠ Konto löschen</h3>
      <p className="dim" style={{ margin: 0, fontSize: 19, lineHeight: 1.3 }}>
        Löscht dein Konto endgültig — mit allem, was daran hängt: Spielername,
        Avatar, Lernfortschritt, Bestenlisten-Einträge, Pokale, Abzeichen und
        deine Freundesgruppen. Das lässt sich nicht rückgängig machen, und wir
        können nichts davon wiederherstellen.
      </p>

      {confirming ? (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="pixel-btn pixel-btn--danger"
            disabled={busy}
            onClick={remove}
          >
            {busy ? '…' : 'Ja, alles löschen'}
          </button>
          <button
            type="button"
            className="pixel-btn"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="pixel-btn" onClick={() => setConfirming(true)}>
            Konto löschen
          </button>
        </div>
      )}

      {message && <p className="glow-yellow" style={{ margin: 0 }}>{message}</p>}
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
    const text = `Tritt meiner GEOQUIZ-ARCADE-Gruppe „${g.name}" bei! Code: ${g.code}`
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

/** Offizielles vierfarbiges Google-„G" — Markenrichtlinie verlangt das unveränderte Logo. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  )
}

/** GitHub-Octocat-Mark, currentColor — folgt der Textfarbe des Buttons. */
function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const PROVIDER_ICONS: Record<OAuthProvider, () => JSX.Element> = {
  google: GoogleIcon,
  github: GithubIcon,
}

/**
 * EIN „Mit Google/GitHub"-Button je Provider (Nutzer-Entscheid 2026-07-18:
 * kein getrennter Sichern-/Anmelden-Pfad mehr). Versucht immer zuerst
 * linkIdentity — bei einem frischen Gast bleibt so der Fortschritt erhalten;
 * gehört die Identität schon einem anderen Account, löst
 * resolveOAuthRedirectError() nach dem Rücksprung automatisch einen normalen
 * Login aus. Bei Erfolg verlässt der Browser die App Richtung Provider —
 * busy bleibt deshalb bewusst an.
 */
function OAuthButtons() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const start = async (provider: OAuthProvider) => {
    setBusy(true)
    setMessage(null)
    const result = await continueWithProvider(provider)
    if (!result.ok) {
      setBusy(false)
      setMessage(result.message)
    }
  }

  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {(['google', 'github'] as const).map((p) => {
          const Icon = PROVIDER_ICONS[p]
          return (
            <button
              key={p}
              type="button"
              className="pixel-btn oauth-btn"
              disabled={busy}
              onClick={() => start(p)}
            >
              <Icon />
              {busy ? '…' : `Mit ${OAUTH_PROVIDER_LABELS[p]}`}
            </button>
          )
        })}
      </div>
      {message && <p className="glow-yellow" style={{ margin: 0 }}>{message}</p>}
    </>
  )
}

/**
 * Standard-Ansicht für Gäste (Nutzer-Entscheid 2026-07-18: Login statt
 * Registrierung ist jetzt der Default — Google/GitHub deckt beide Fälle
 * gleichzeitig ab). E-Mail/Passwort bleibt für bestehende Accounts ohne
 * Google/GitHub.
 */
function LoginPanel() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Meldung aus einem vorherigen OAuth-Redirect abholen (z. B. wenn der
  // automatische Fallback-Login in resolveOAuthRedirectError() scheiterte).
  useEffect(() => {
    const pending = consumePendingOAuthMessage()
    if (pending) setMessage(pending)
  }, [])

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    const result = await signInWithEmail(email.trim(), password)
    if (result.ok) {
      // Kompletter Zustand (Level/XP, Avatar, Progress-Queue) — nicht nur der
      // Name (DESIGN-MOBILE-POLISH.md #2).
      const auth = await ensureSession()
      await applyAuthSession(auth)
      setBusy(false)
      setMessage('Angemeldet — Fortschritt dieses Geräts wird deinem Account zugerechnet.')
    } else {
      setBusy(false)
      setMessage(result.message)
    }
  }

  /**
   * Reset-Link anfordern. Nutzt bewusst das Feld oben statt eines zweiten
   * Formulars — die Adresse steht in dem Moment ohnehin schon da, und ein
   * eigener Screen wäre für einen Knopf zu viel Weg.
   */
  const forgotPassword = async () => {
    const address = email.trim()
    if (!address.includes('@')) {
      setMessage('Trag oben deine E-Mail-Adresse ein, dann schicke ich dir einen Link.')
      return
    }
    setBusy(true)
    setMessage(null)
    const result = await requestPasswordReset(address)
    setBusy(false)
    setMessage(result.message)
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20 }}>
      <h3 className="glow-cyan">Anmelden</h3>
      <p className="dim" style={{ margin: 0, fontSize: 19 }}>
        Hast du schon einen Account (oder legst gerade deinen ersten an) —
        mit Google/GitHub geht's am schnellsten.
      </p>
      <OAuthButtons />
      <p className="dim center" style={{ margin: 0, fontSize: 17 }}>
        — oder mit E-Mail —
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
        placeholder="Passwort"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      />
      <div>
        <button
          type="button"
          className="pixel-btn pixel-btn--cyan"
          disabled={busy || !email.includes('@') || password.length < 6}
          onClick={submit}
        >
          {busy ? '…' : 'Anmelden'}
        </button>
      </div>
      <button
        type="button"
        className="dim"
        disabled={busy}
        onClick={forgotPassword}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          fontSize: 18,
          textAlign: 'left',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        Passwort vergessen?
      </button>
      {message && <p className="glow-yellow" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}

/** Aufklappbarer Registrierungs-Weg per E-Mail/Passwort — kein Google/GitHub hier, das deckt der Anmelden-Bereich bereits ab. */
function RegisterToggle() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className="pixel-btn" onClick={() => setOpen(true)}>
        Neuen Account per E-Mail registrieren
      </button>
    )
  }

  return <RegisterPanel onClose={() => setOpen(false)} />
}

function RegisterPanel({ onClose }: { onClose: () => void }) {
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
      await applyAuthSession(auth)
    }
  }

  return (
    <div className="pixel-panel stack" style={{ padding: 20 }}>
      <div className="row">
        <h3 className="glow-green">Account registrieren</h3>
        <div className="spacer" />
        <button type="button" className="pixel-btn pixel-btn--small" onClick={onClose}>
          X
        </button>
      </div>
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

function LogoutPanel() {
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    setBusy(true)
    await signOutUser()
    // next ensureSession() call starts a fresh anonymous identity;
    // applyAuthSession räumt dabei auch XP/Level des alten Accounts weg.
    const auth = await ensureSession()
    await applyAuthSession(auth)
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
