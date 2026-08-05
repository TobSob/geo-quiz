import { useEffect, useState } from 'react'

/**
 * Bildnachweise (DESIGN-PLAYSTORE.md, ROADMAP K15).
 *
 * CC-BY(-SA) verlangt Urheber UND Lizenz beim Bild — ein Link auf den
 * Wikipedia-Artikel, wie ihn `docs/IMAGE_CREDITS.md` bisher als einzige Quelle
 * hatte, genügt dafür nicht. Bei 129 Fotos ist eine Bildunterschrift im Spiel
 * keine Option (im Pin-Modus ist das Foto auf dem Handy 88 px breit, und das
 * Choice-Layout ist auf „360×640 ohne Scrollen" getrimmt), deshalb hier ein
 * eigener Nachweis-Screen — die für Spiele übliche und akzeptierte Form.
 *
 * Die Daten (~38 KB) kommen per `import()` erst beim Öffnen dieses Screens:
 * sie werden sonst nirgends gebraucht und haben im Startbundle nichts verloren
 * (gleiche Überlegung wie beim Umriss-Atlas).
 */

interface LandmarkCredit {
  id: string
  name: string
  file: string
  author: string
  license: string
  licenseUrl: string | null
  url: string | null
}

export function CreditsScreen() {
  const [credits, setCredits] = useState<LandmarkCredit[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    import('../data/landmark-credits.json')
      .then((m) => {
        if (active) setCredits(m.default as LandmarkCredit[])
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <h2 className="glow-cyan center">© Nachweise</h2>

      <div className="pixel-panel stack" style={{ padding: 20 }}>
        <h3 className="glow-yellow">Daten</h3>
        <ul className="dim" style={{ margin: 0, fontSize: 19, lineHeight: 1.4, paddingLeft: '1.2em' }}>
          <li>
            Länderdaten:{' '}
            <a href="https://github.com/mledoze/countries" target="_blank" rel="noreferrer">
              mledoze/countries
            </a>{' '}
            (ODbL)
          </li>
          <li>
            Flaggen:{' '}
            <a href="https://github.com/lipis/flag-icons" target="_blank" rel="noreferrer">
              flag-icons
            </a>{' '}
            (MIT)
          </li>
          <li>
            Länderumrisse:{' '}
            <a href="https://github.com/topojson/world-atlas" target="_blank" rel="noreferrer">
              world-atlas
            </a>{' '}
            (Natural Earth, gemeinfrei)
          </li>
          <li>
            Kartenkacheln: ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            -Mitwirkende, ©{' '}
            <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">
              CARTO
            </a>
          </li>
        </ul>
      </div>

      <div className="pixel-panel stack" style={{ padding: 20 }}>
        <h3 className="glow-yellow">Fotos der Sehenswürdigkeiten</h3>
        <p className="dim" style={{ margin: 0, fontSize: 19, lineHeight: 1.4 }}>
          Alle Fotos stammen von Wikimedia Commons bzw. Wikipedia. Urheber und
          Lizenz stehen jeweils dahinter; der Name verlinkt auf die Dateiseite
          mit den vollständigen Angaben.
        </p>

        {failed && (
          <p className="glow-yellow" style={{ margin: 0 }}>
            Nachweise konnten nicht geladen werden — bitte erneut versuchen.
          </p>
        )}
        {!failed && !credits && <p className="dim blink">LADE…</p>}

        {credits && (
          <ul className="credit-list">
            {credits.map((c) => (
              <li key={c.id}>
                <a href={c.url ?? undefined} target="_blank" rel="noreferrer">
                  {c.name}
                </a>
                <span className="dim">
                  {' — '}
                  {c.author}
                  {' · '}
                  {c.licenseUrl ? (
                    <a href={c.licenseUrl} target="_blank" rel="noreferrer">
                      {c.license}
                    </a>
                  ) : (
                    c.license
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
