# Recht & Nachweise

> **Stand:** 2026-09-14 · **Verifiziert:** `frontend/public/*/index.html`,
> `src/routes/CreditsScreen.tsx`, HTTP-Prüfung der Live-URLs

## Die drei öffentlichen Rechtsseiten

`frontend/public/datenschutz/` · `konto-loeschen/` · `impressum/` — statisches
HTML, **ohne JavaScript**, mit eigenem Mini-CSS.

Warum statisch und nicht als React-Route: Sie müssen ohne installierte App
erreichbar sein (die Löschanleitung richtet sich ausdrücklich an Leute, die die
App nicht mehr haben), und der HashRouter bedient `/datenschutz` gar nicht. Als
Ordner mit `index.html`, damit die URL in der Play Console ohne Endung sauber
aussieht.

Alle drei stehen auf **`noindex`**: Verlangt ist „erreichbar" bzw. „leicht
erkennbar, unmittelbar erreichbar" — nicht „über Google auffindbar". Die Seiten
nennen eine Privatanschrift.

Anbieter: Tobias Sobek, Kontakt `geoquizsupport@gmail.com`.

**Live-Adressen seit 2026-09-14:** `https://geoquiz.tobsob.dev/datenschutz/`
und `/konto-loeschen/` (so in der Play Console). `pages.dev` liefert dieselben
Seiten weiter aus.

**Auftragsverarbeiter laut Datenschutzerklärung §5** (Stand der Erklärung:
14. September 2026): Supabase (EU, Stockholm), Cloudflare Pages, **Resend**
(Mailversand, Region EU/Irland). Herleitung und was bewusst fehlt:
[DESIGN-MAIL-DOMAIN.md](../../DESIGN-MAIL-DOMAIN.md) §7. **Offen:** ob mit
Resend ein DPA besteht.
`npm run release` bricht ab, solange irgendwo `TODO_ANBIETER_*` steht.

## Nachweise in der App (`/credits`)

Ein lazy geladener Screen, im Profil als „Nachweise" verlinkt, mit drei
Blöcken:

1. **129 Landmark-Fotos** — Urheber + Lizenz je Bild aus
   `landmark-credits.json`. CC-BY(-SA) verlangt beides; für vier Altdateien
   ohne `Artist`-Feld zieht das Skript den Erst-Uploader.
2. **Schriften** — Press Start 2P und VT323 liegen als `.woff2` im Bundle und
   in der APK. Das ist **Weitergabe** der Font Software, und die SIL OFL 1.1
   verlangt dafür den Hinweis. Dass sie „von Google Fonts" stammen, ändert
   nichts.
3. **Bibliotheken** — MIT/BSD/ISC verlangen den Hinweis „in all copies or
   substantial portions". Enthält React, **MapLibre GL JS (BSD 3-Clause)**,
   d3-geo, topojson-client, React Router, Zustand, supabase-js, Capacitor.

> Historie: Solange Leaflet im Einsatz war, stand hier **react-leaflet unter
> der Hippocratic License 2.1** (nicht MIT, von der OSI nicht als Open Source
> anerkannt, mit ausdrücklichem Notice-Abschnitt). Mit dem MapLibre-Umbau vom
> 2026-08-29 ist diese Abhängigkeit **weg** — der Credits-Screen ist
> entsprechend nachgezogen.

**Regel:** Wer eine Abhängigkeit hinzufügt, prüft ihr Lizenzfeld und trägt sie
im Credits-Screen nach. Lizenz-URLs vor dem Ausliefern per HTTP prüfen — ein
toter Link in einem Lizenzhinweis ist kein Lizenzhinweis.

**Bewusst kein EU-ODR-Link:** Die Streitschlichtungsplattform hat ihren Betrieb
im Juli 2025 eingestellt.

## Vertiefung

- [../../DESIGN-PLAYSTORE.md](../../DESIGN-PLAYSTORE.md) §2, §6, §7 — Herleitung aller Rechtstexte
- [../IMAGE_CREDITS.md](../IMAGE_CREDITS.md) — vollständige Bildnachweise
