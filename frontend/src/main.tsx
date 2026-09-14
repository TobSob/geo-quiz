import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/press-start-2p/index.css'
import '@fontsource/vt323/index.css'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'
import App from './App.tsx'
import {
  captureEmailLink,
  captureRecoveryRedirect,
  resolveOAuthRedirectError,
} from './api/authApi'

// Alle drei müssen VOR dem ersten Render laufen, weil der HashRouter den Hash
// gleich umschreibt:
// 1. Recovery-Rücksprung (#…&type=recovery) als Marker festhalten — die Tokens
//    bleiben liegen, die löst supabase-js selbst ein.
// 2. Link aus einer Auth-Mail (?token_hash=…&type=…) festhalten und aus der
//    URL entfernen; eingelöst wird er in ensureSession(). Nach 1., weil 1.
//    `type=recovery` aus derselben Query liest (DESIGN-MAIL-DOMAIN.md).
// 3. OAuth-Fehler-Redirect (z. B. "#error=identity_already_exists&...")
//    aufräumen, bevor der Router darin einen ungültigen Pfad sieht und eine
//    leere Seite rendert.
captureRecoveryRedirect()
captureEmailLink()
resolveOAuthRedirectError()

// HashRouter: works identically on static hosting and inside the Capacitor
// WebView (no server-side rewrites needed).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
