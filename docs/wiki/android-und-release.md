# Android & Release

> **Stand:** 2026-08-30 · **Verifiziert:** `android/app/build.gradle`,
> `android/variables.gradle`, `capacitor.config.ts`, `scripts/release.mjs`, `release/`

## App-Identität

| Feld | Wert |
|---|---|
| `applicationId` / `appId` | `de.tobsob.geoquizarcade` |
| App-Name | GEOQUIZ ARCADE |
| `versionName` | `1.0` (manuell — das soll eine Release-Entscheidung sein) |
| `versionCode` | **7** (automatisch hochgezählt) |
| `minSdkVersion` | 24 |
| `targetSdkVersion` / `compileSdkVersion` | 36 — erfüllt Googles aktuelle Mindestanforderung |
| `minifyEnabled` | false — Größenoptimierung, **kein** Store-Kriterium |

Neuestes Artefakt: `frontend/release/GeoQuizArcade-1.0-7-2026-08-29.aab`
(13,8 MB) samt gleichnamiger APK.

## Ein Build, zwei Ziele

```bash
npm run release
```

`scripts/release.mjs` macht Checks + Cloudflare-Pages-Deploy + signierte
APK/AAB aus **einem** Vite-Build — Web und App können so nicht auseinander-
laufen. Flags: `--web-only`, `--android-only`, `--no-deploy` (Trockenlauf),
`--skip-checks`, `--debug-apk`, `--no-bump`.

Das Skript **bricht ab**, wenn in einem ausgelieferten Rechtstext noch
`TODO_ANBIETER_*` steht. Die Liste der geprüften Dateien ist fest verdrahtet —
wer eine neue Rechtsseite anlegt, trägt sie dort ein, sonst wird sie
stillschweigend übersprungen.

`versionCode` wird vor jedem Android-Release-Build erhöht und in
`build.gradle` zurückgeschrieben (taucht im `git diff` auf). Play verlangt nur
Monotonie, keine Lückenlosigkeit — eine zu hohe Nummer kostet nichts, eine
vergessene kostet einen abgelehnten Upload.

## Signierung

Über gitignorte `android/keystore.properties`. Fehlt sie, baut Gradle
unsigniert weiter und das Skript sagt es deutlich. **Beim ersten Upload in der
Play Console muss Play App Signing aktiviert werden** — der lokale Keystore
wird damit zum ersetzbaren Upload-Key. Ohne das ist ein Keystore-Verlust das
Ende der App. Keystore trotzdem sichern.

## Android-Besonderheiten

- **Auth-Token nicht im Google-Backup:** `backup_rules.xml` +
  `data_extraction_rules.xml` nehmen gezielt `CapacitorStorage.xml` aus. Ein
  wiederhergestelltes Gerät startet mit frischer anonymer Identität.
- **Vollbild (Immersive Mode):** Systemleisten aus, Inhalt bis in die
  Kamera-Aussparung, Tastatur-Inset selbst angewendet.
- **System-Back-Button** führt ins Menü statt die App zu beenden
  (`@capacitor/app`-Listener); auf Home beendet er weiter.

## Web-Deployment

Cloudflare Pages, **Direct Upload** über Wrangler — ein `git push` deployt
**nicht**. Live: https://geo-quiz-a6s.pages.dev

Statische Seiten wie `/datenschutz/` prüft man nur mit der echten Pages-
Laufzeit (`wrangler pages dev`, Preview-Eintrag `geo-quiz-pages` in
`.claude/launch.json`) — `vite preview` fällt auf die SPA zurück und beweist
nichts.

## Vertiefung

- [../RUNNING.md](../RUNNING.md) §5 — Android-Toolchain, Emulator
- [../DEVELOPMENT.md](../DEVELOPMENT.md) §11 — Deployment
- [../../DESIGN-MOBILE-POLISH.md](../../DESIGN-MOBILE-POLISH.md) — Vollbild, Back-Button, Layout
