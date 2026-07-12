import { useNavigate } from 'react-router-dom'

const MODES = [
  {
    path: '/play/flags',
    icon: '🚩',
    name: 'Flaggen',
    desc: 'Welches Land gehört zur Flagge?',
  },
  {
    path: '/play/capitals',
    icon: '🏛️',
    name: 'Hauptstädte',
    desc: 'Nenne die Hauptstadt des Landes.',
  },
  {
    path: '/play/countries',
    icon: '🌍',
    name: 'Länder',
    desc: 'Zu welchem Land gehört die Hauptstadt?',
  },
  {
    path: '/play/outline',
    icon: '🗺️',
    name: 'Umrisse',
    desc: 'Erkenne das markierte Land auf der Karte.',
  },
  {
    path: '/play/city-pin',
    icon: '📍',
    name: 'Städte-Pin',
    desc: 'Wo liegt die Stadt? Tippe auf die Weltkarte.',
  },
  {
    path: '/play/landmark-pin',
    icon: '🗿',
    name: 'Landmark-Pin',
    desc: 'Wo steht das Wahrzeichen? Tippe auf die Weltkarte.',
  },
] as const

export function HomeScreen() {
  const navigate = useNavigate()

  return (
    <div className="stack" style={{ gap: 32 }}>
      <div className="center" style={{ padding: '18px 0 6px' }}>
        <h1>
          <span className="glow-green">GEO</span>
          <span className="glow-cyan">QUIZ</span>
        </h1>
        <p className="dim" style={{ marginTop: 10 }}>
          Flaggen · Hauptstädte · Karten — wie gut kennst du die Welt?
        </p>
        <p className="dim" style={{ marginTop: 6, fontSize: 18 }}>
          ⏱ Du hast 60 Sekunden — schaff so viele Fragen, wie du kannst!
        </p>
        <p className="display blink glow-yellow" style={{ fontSize: 11 }}>
          ▼ WÄHLE EINEN MODUS ▼
        </p>
      </div>

      <div className="mode-grid">
        <button
          type="button"
          className="mode-card mode-card--wide"
          onClick={() => navigate('/cup')}
        >
          <span className="mode-icon">🏆</span>
          <span className="stack" style={{ gap: 6 }}>
            <span className="mode-name glow-yellow">GEO CUP</span>
            <span className="mode-desc">
              Alle 6 Disziplinen hintereinander — je 30 Sekunden.
            </span>
          </span>
        </button>

        {MODES.map((m) => (
          <button
            key={m.path}
            type="button"
            className="mode-card"
            onClick={() => navigate(m.path)}
          >
            <span className="mode-icon">{m.icon}</span>
            <span className="mode-name">{m.name}</span>
            <span className="mode-desc">{m.desc}</span>
          </button>
        ))}

        <button
          type="button"
          className="mode-card"
          onClick={() => navigate('/training')}
        >
          <span className="mode-icon">🎯</span>
          <span className="mode-name glow-pink">Training</span>
          <span className="mode-desc">
            Üben ohne Zeitdruck — was du oft falsch hattest, kommt öfter dran.
          </span>
        </button>

        <button
          type="button"
          className="mode-card"
          onClick={() => navigate('/scores')}
        >
          <span className="mode-icon">🥇</span>
          <span className="mode-name">Bestenliste</span>
          <span className="mode-desc">Lokal &amp; global — wer kennt die Welt am besten?</span>
        </button>

        <button
          type="button"
          className="mode-card"
          onClick={() => navigate('/profile')}
        >
          <span className="mode-icon">👤</span>
          <span className="mode-name">Profil</span>
          <span className="mode-desc">Name ändern, Account sichern, anmelden.</span>
        </button>
      </div>
    </div>
  )
}
