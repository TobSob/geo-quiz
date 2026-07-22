/**
 * Header-Wordmark im Attract-Mode: blendet zwischen „GEOQUIZ" und „ARCADE"
 * hin und her, wie ein Automaten-Titelbildschirm im Leerlauf.
 *
 * Wie beim Original läuft der Wechsel NUR im Leerlauf — sobald eine Runde
 * läuft (`frozen`), steht dauerhaft „GEOQUIZ". Etwas, das während einer
 * Runde unter Zeitdruck in der Ecke blinkt, zieht sonst Aufmerksamkeit von
 * der Frage ab.
 *
 * Beide Wörter liegen übereinander in derselben Grid-Zelle, damit die
 * Kopfzeile beim Wechsel nicht springt (GEOQUIZ ist breiter als ARCADE).
 * Der Zyklus steckt komplett in CSS (`.wordmark`), damit er ohne Timer und
 * ohne Re-Render läuft und `prefers-reduced-motion` ihn abschalten kann.
 */
export function Wordmark({ frozen = false, fontSize = 18 }: { frozen?: boolean; fontSize?: number }) {
  return (
    <span
      className={`wordmark display${frozen ? ' wordmark--frozen' : ''}`}
      style={{ fontSize }}
      // Für Screenreader ist es EIN Name, keine zwei wechselnden Wörter.
      role="img"
      aria-label="GEOQUIZ ARCADE"
    >
      <span className="wordmark__word wordmark__word--title" aria-hidden="true">
        <span className="glow-green">GEO</span>
        <span className="glow-cyan">QUIZ</span>
      </span>
      <span className="wordmark__word wordmark__word--sub glow-yellow" aria-hidden="true">
        ARCADE
      </span>
    </span>
  )
}
