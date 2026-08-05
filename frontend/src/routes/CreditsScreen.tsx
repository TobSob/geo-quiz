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

interface SoftwareCredit {
  name: string
  url: string
  copyright: string
  license: string
  licenseUrl: string
}

const MIT = 'https://opensource.org/license/mit'
const ISC = 'https://opensource.org/license/isc-license-txt'
const OFL = 'https://openfontlicense.org/open-font-license-official-text/'

/**
 * Schriften: liegen als .woff2 im Bundle und in der APK — das ist Weitergabe,
 * und die OFL 1.1 verlangt dafür Copyright- und Lizenzhinweis. Die Angaben
 * stammen aus den LICENSE-Dateien der @fontsource-Pakete, nicht aus dem Kopf.
 */
const FONTS: SoftwareCredit[] = [
  {
    name: 'Press Start 2P',
    url: 'https://fonts.google.com/specimen/Press+Start+2P',
    copyright: '© 2012 The Press Start 2P Project Authors',
    license: 'SIL Open Font License 1.1',
    licenseUrl: OFL,
  },
  {
    name: 'VT323',
    url: 'https://fonts.google.com/specimen/VT323',
    copyright: '© 2011 The VT323 Project Authors',
    license: 'SIL Open Font License 1.1',
    licenseUrl: OFL,
  },
]

/**
 * Bibliotheken, die minifiziert im ausgelieferten Bundle stecken. MIT und
 * BSD verlangen den Hinweis „in all copies"; die Hippocratic-Lizenz von
 * react-leaflet sagt es in ihrem Notice-Abschnitt sogar ausdrücklich.
 * Reihenfolge: nach Sichtbarkeit im Spiel, nicht alphabetisch.
 */
const LIBRARIES: SoftwareCredit[] = [
  {
    name: 'React & React DOM',
    url: 'https://react.dev',
    copyright: '© Meta Platforms, Inc. und Beitragende',
    license: 'MIT',
    licenseUrl: MIT,
  },
  {
    name: 'Leaflet',
    url: 'https://leafletjs.com',
    copyright: '© 2010–2023 Volodymyr Agafonkin',
    license: 'BSD 2-Clause',
    licenseUrl: 'https://opensource.org/license/bsd-2-clause',
  },
  {
    name: 'React Leaflet',
    url: 'https://react-leaflet.js.org',
    copyright: '© 2020 Paul Le Cam und Beitragende',
    license: 'Hippocratic License 2.1',
    licenseUrl: 'https://firstdonoharm.dev/version/2/1/license/',
  },
  {
    name: 'd3-geo',
    url: 'https://d3js.org/d3-geo',
    copyright: '© 2010–2024 Mike Bostock',
    license: 'ISC',
    licenseUrl: ISC,
  },
  {
    name: 'topojson-client',
    url: 'https://github.com/topojson/topojson-client',
    copyright: '© 2012–2019 Michael Bostock',
    license: 'ISC',
    licenseUrl: ISC,
  },
  {
    name: 'React Router',
    url: 'https://reactrouter.com',
    copyright: '© React Training LLC / Remix Software',
    license: 'MIT',
    licenseUrl: MIT,
  },
  {
    name: 'Zustand',
    url: 'https://github.com/pmndrs/zustand',
    copyright: '© 2019 Paul Henschel',
    license: 'MIT',
    licenseUrl: MIT,
  },
  {
    name: 'supabase-js',
    url: 'https://github.com/supabase/supabase-js',
    copyright: '© 2020 Supabase',
    license: 'MIT',
    licenseUrl: MIT,
  },
  {
    name: 'Capacitor',
    url: 'https://capacitorjs.com',
    copyright: '© 2017–heute Drifty Co.',
    license: 'MIT',
    licenseUrl: MIT,
  },
]

function SoftwareList({ items }: { items: SoftwareCredit[] }) {
  return (
    <ul className="credit-list">
      {items.map((s) => (
        <li key={s.name}>
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.name}
          </a>
          <span className="dim">
            {' — '}
            {s.copyright}
            {' · '}
            <a href={s.licenseUrl} target="_blank" rel="noreferrer">
              {s.license}
            </a>
          </span>
        </li>
      ))}
    </ul>
  )
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

      <div className="pixel-panel stack" style={{ padding: 20 }}>
        <h3 className="glow-yellow">Schriften</h3>
        <p className="dim" style={{ margin: 0, fontSize: 19, lineHeight: 1.4 }}>
          Beide Pixel-Schriften sind im Spiel eingebettet und stehen unter der
          SIL Open Font License 1.1.
        </p>
        <SoftwareList items={FONTS} />
      </div>

      <div className="pixel-panel stack" style={{ padding: 20 }}>
        <h3 className="glow-yellow">Open-Source-Bibliotheken</h3>
        <p className="dim" style={{ margin: 0, fontSize: 19, lineHeight: 1.4 }}>
          Ohne diese Projekte gäbe es das Spiel nicht — sie stecken im
          ausgelieferten Programm und werden hier mit Rechteinhaber und Lizenz
          genannt.
        </p>
        <SoftwareList items={LIBRARIES} />
      </div>
    </div>
  )
}
