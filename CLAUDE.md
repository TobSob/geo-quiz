# CLAUDE.md — Einstiegspunkt für Agenten

GEOQUIZ ARCADE: 8-Bit-Geografie-Quiz. React 18 + TypeScript + Vite im Web
(Cloudflare Pages), dieselbe `dist/` als Android-App über Capacitor. Backend
ist Supabase (Postgres + Auth + RLS). Vor dem Play-Store-Release, technisch
fertig, es fehlen Console-Schritte und der E-Mail-Versand.

**Lies zuerst [docs/wiki/README.md](docs/wiki/README.md)** — dort steht in
kurzen Seiten, was gerade wahr ist. Die langen Dokumente unten begründen,
*warum* etwas so gebaut ist; sie sind Nachschlagewerk, nicht Einstieg.

## Wo steht was

| Frage | Datei |
|---|---|
| Was ist gerade wahr? Welcher Dienst ist wie konfiguriert? | `docs/wiki/` |
| Wie baue/starte/deploye ich? | [docs/RUNNING.md](docs/RUNNING.md) |
| Wie ist der Code aufgebaut, wie erweitere ich ihn? | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Warum ist Feature X so gebaut? | `DESIGN-*.md` im Repo-Wurzelverzeichnis |
| Was ist abgehakt, was offen? | [ROADMAP.md](ROADMAP.md) (Phasen A–K) + [STATUS.md](STATUS.md) |
| Store-Texte, Data-Safety, IARC | [docs/STORE-LISTING.md](docs/STORE-LISTING.md) |

## Befehle

Alles läuft aus `frontend/`:

```bash
npm run dev
```

```bash
npm run test
```

```bash
npm run release
```

`release` macht Checks + Web-Deploy + signierte APK/AAB aus **einem** Build.
`--no-deploy` für den Trockenlauf, `--android-only` / `--web-only` zum Teilen.
Details: [docs/wiki/android-und-release.md](docs/wiki/android-und-release.md).

## Regeln, die dieses Projekt teuer gelernt hat

- **Jede Umsetzung bekommt ein `DESIGN-*.md`**, danach README/STATUS/ROADMAP
  **und die betroffene Wiki-Seite** nachziehen. Kein Code ohne Herleitung.
  Nicht um Erlaubnis fragen — aber **kurz ankündigen**, was nachgezogen wird,
  damit der Mensch widersprechen kann.
- **Keine vollflächigen Paint-Animationen** — hat hier einen ganzen CPU-Kern
  gekostet, siehe [DESIGN-PERF-MOBILE.md](DESIGN-PERF-MOBILE.md).
- **`npm run release` bricht ab**, wenn `TODO_ANBIETER_*` in einem Rechtstext
  steht. Absicht, nicht Bug.
- **`versionCode` zählt das Release-Skript selbst hoch.** Nicht von Hand
  anfassen.
- **HashRouter.** Neue öffentlich erreichbare Seiten (Datenschutz, Impressum)
  gehören als statisches HTML nach `frontend/public/<name>/index.html`, nicht
  als React-Route.
- **Zahlen im Wiki tragen ein Prüfdatum.** Wer eine übernimmt, ohne sie neu zu
  prüfen, übernimmt auch ihr Alter — im Zweifel den angegebenen Prüfbefehl
  noch einmal laufen lassen.
- **Keine Secrets in den Chat.** SMTP-Keys, Keystore-Passwörter und der
  Supabase-Service-Key gehören ins Dashboard bzw. in gitignorte Dateien.
