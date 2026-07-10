import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/press-start-2p/index.css'
import '@fontsource/vt323/index.css'
import 'flag-icons/css/flag-icons.min.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

// HashRouter: works identically on static hosting and inside the Capacitor
// WebView (no server-side rewrites needed).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
