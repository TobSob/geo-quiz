# DESIGN-RENAME — „GeoQuiz" → „GEOQUIZ ARCADE" (2026-07-22)

> Umbenennung des **sichtbaren Namens** und der **Store-Identität** vor dem
> ersten Play-Store-Upload. Bewusst eng gefasst: Repo, Live-URL, Doku-Fließtext
> und Persistenz-Keys bleiben unangetastet (siehe „Abgrenzung").
> Verwandte Docs: [ROADMAP.md](ROADMAP.md) (B7 Icon/Splash, B8 Release-Build),
> [DESIGN-AUTH.md](DESIGN-AUTH.md) (OAuth-Redirect-Schema).

## Warum jetzt

Die `applicationId` ist die permanente Identität einer App im Play Store — nach
dem ersten Upload lässt sie sich **nie** mehr ändern (nur als komplett neue App
mit verlorenen Bewertungen und Installationen). B8 ist erledigt, B-Phase-Upload
steht aber noch aus (`Play-Store-Upload weiter optional/später`). Das ist das
letzte Fenster, in dem die Umbenennung billig ist.

## 1. Sichtbarer Name

**Regel:** Der Anzeigename ist überall `GEOQUIZ ARCADE` (Versalien, ein
Leerzeichen). Das ist der Name unter dem Launcher-Icon, im Play-Store-Eintrag
und im Browser-Tab.

| Ort | Feld | Wert |
|---|---|---|
| `frontend/capacitor.config.ts` | `appName` | `GEOQUIZ ARCADE` |
| `android/…/values/strings.xml` | `app_name`, `title_activity_main` | `GEOQUIZ ARCADE` |
| `frontend/index.html` | `<title>` | `GEOQUIZ ARCADE — 8-Bit Geography` |
| `src/routes/ProfileScreen.tsx` | Gruppen-Einladungstext | „…meiner GEOQUIZ-ARCADE-Gruppe…" |

Im Fließtext (Einladung) mit Bindestrichen durchgekoppelt, weil deutsche
Komposita das verlangen — der Eigenname selbst bleibt ungekoppelt.

## 2. Store-Identität (Package-ID)

**Regel:** `de.tobsob.geoquiz` → `de.tobsob.geoquizarcade`, konsequent an allen
fünf Stellen. Kein Bindestrich, kein CamelCase — Java-Paketsegmente sind
kleingeschrieben und alphanumerisch.

| Datei | Was |
|---|---|
| `frontend/capacitor.config.ts` | `appId` |
| `android/app/build.gradle` | `namespace` **und** `applicationId` |
| `android/…/java/de/tobsob/geoquizarcade/MainActivity.java` | `package`-Zeile **und Verzeichnis** |
| `android/…/values/strings.xml` | `package_name`, `custom_url_scheme` |

Danach `npx cap sync android` — das regeneriert
`android/app/src/main/assets/capacitor.config.json` aus `capacitor.config.ts`.

**Kein Supabase-Schritt nötig** (anfangs falsch angenommen, dann im Code
geprüft): `custom_url_scheme` ist ungenutztes Capacitor-Gerüst aus
`cap add android`. Der OAuth-Rücksprung läuft nicht über ein Custom-Scheme,
sondern über die App-Root — `oauthRedirectTo()` in `api/authApi.ts` liefert
`window.location.origin + pathname`, in der WebView also `https://localhost/`,
ohne Package-ID. Im `AndroidManifest.xml` steht nur der `LAUNCHER`-Intent-Filter,
kein `<data android:scheme="…">`; im `src/` kommt weder `appUrlOpen` noch
`custom_url_scheme` vor. Der OAuth-Flow ist von der Umbenennung damit nicht
betroffen. Das Feld wird trotzdem mitgezogen, damit es nicht als Altlast mit der
alten ID zurückbleibt, falls später doch ein Deep-Link dazukommt.

**Nebenwirkung:** Für Android ist eine geänderte `applicationId` eine andere App.
Emulator und Testgerät brauchen eine Neuinstallation; die lokalen App-Daten der
alten Installation (u. a. die anonyme Session in `@capacitor/preferences`) gehen
dabei verloren. Der Keystore bleibt unverändert gültig — die Signatur ist an den
Schlüssel gebunden, nicht an die Package-ID.

## 3. Grafik: zweizeiliges Wordmark

**Unverändert:** Das App-Icon trägt **nur den Pixel-Globus**, kein Wordmark
(`icon-only.png`, `icon-foreground.png`). Es braucht keine Änderung.

**Geändert:** Nur der Splash zeigt den Schriftzug. Neu zweizeilig:

```
  GEOQUIZ      ← GEO grün (--green), QUIZ cyan (--cyan)
  ARCADE       ← weiß (--white), eine Zeile tiefer
```

Einzeilig wären es 13 Zeichen à 6 Spalten = 77 Zellen; bei der bisherigen
Zellgröße 16 px sind das 1232 px auf einem 2732-px-Splash, dessen Ränder Android
je nach Seitenverhältnis wegschneidet. Zweizeilig bleibt die längste Zeile bei 7
Zeichen und damit im sicheren Mittelbereich.

**Nötige Code-Änderungen in `scripts/generate-app-assets.mjs`:**
- `FONT` kennt bisher nur `G E O Q U I Z`. Vier neue 5×7-Glyphen: `A R C D`.
- `drawText` zeichnet eine Zeile. Neu: `drawLines(canvas, lines, cell, cx, cy)`
  zentriert mehrere Zeilen um einen gemeinsamen Mittelpunkt, Zeilenabstand 9
  Zellen (7 Glyphenhöhe + 2 Luft). `drawText` bleibt als Ein-Zeilen-Fall
  erhalten und wird von `drawLines` benutzt.

Danach `npx @capacitor/assets generate --android` (regeneriert alle 74 Dateien).

## 4. Header-Wordmark im Attract-Mode

**Idee (Nutzer):** Statt eines statischen Schriftzugs zwischen „GEOQUIZ" und
„ARCADE" hin- und herblenden — wie Automaten früher im Leerlauf zwischen
Titelbild und Highscore-Liste umgeschaltet haben.

**Wo nicht:** Auf dem Android-Splash ist das nicht baubar. Der Splash ist ein
statisches Bitmap-Drawable; Android 12+ erlaubt eine `AnimatedVectorDrawable`
nur im Icon-Slot und mit ~1 s Deckel, ältere Geräte bekommen ohnehin die
Bitmap. Der Splash bleibt der statische Zweizeiler aus Abschnitt 3.

**Wo doch:** Im App-Header (`App.tsx`), als Komponente
`components/Wordmark.tsx` + CSS-Block in `index.css`.

**Regeln:**
- Zyklus 5 s: ~2,5 s pro Wort, dazwischen eine weiche Blende. Der Wechsel
  steckt vollständig in CSS (`@keyframes wordmark-cycle`, das zweite Wort mit
  `animation-delay: -2.5s`) — kein Timer, kein Re-Render, und
  `prefers-reduced-motion` kann ihn abschalten.
- Die Deckkräfte ergänzen sich jederzeit zu 1, es gibt also keinen Moment mit
  leerem Header.
- `ARCADE` in Gelb (`--yellow`), weil sich das gegen das vorhandene Grün/Cyan
  im Header deutlich absetzt.
- **Nur im Leerlauf.** Auf `/play/*`, `/cup` und `/training` steht das Wordmark
  still auf „GEOQUIZ" (`frozen`) — bei einem Spiel, das auf Sekunden geht, darf
  nichts neben der Frage um Aufmerksamkeit konkurrieren. Automaten haben den
  Attract-Mode beim Münzeinwurf ebenfalls sofort abgebrochen.
- Beide Wörter liegen in derselben Grid-Zelle (`display: inline-grid`,
  `grid-area: 1/1`); das breitere `GEOQUIZ` bestimmt die Breite, sonst springt
  die Kopfzeile bei jedem Wechsel.
- Für Screenreader ist es **ein** Name: `role="img"` +
  `aria-label="GEOQUIZ ARCADE"`, die beiden Wörter sind `aria-hidden`.

## Abgrenzung — was bewusst NICHT umbenannt wird

| Was | Warum nicht |
|---|---|
| localStorage-Keys `geo-quiz-progress` / `-settings` / `-avatar`, `geoquiz-oauth-*` | Umbenennen kostet jedem bestehenden Spieler Fortschritt, Avatar und Einstellungen — eine Migration wäre reine Risikofläche für null sichtbaren Gewinn. Kein Nutzer sieht diese Keys. |
| GitHub-Repo `TobSob/geo-quiz`, lokaler Ordner | Nicht sichtbar für Spieler. Am lokalen Pfad hängen Werkzeug-Zustände. |
| Cloudflare-Pages-Projekt `geo-quiz` → `geo-quiz-a6s.pages.dev` | Pages-Projekte lassen sich nicht umbenennen; ein neues Projekt bedeutet neue URL und toten Alt-Link (README, GitHub-About, Supabase-Site-URL). Separate Entscheidung. |
| Angewandte SQL-Migrationen, Advisory-Lock `geo_quiz_cup_trophies` | Migrationen werden nie nachträglich editiert. Der Lock-String ist Hash-Input: würde eine neue Migration ihn ändern, während ältere Funktionen den alten Namen benutzen, liefen beide Sperren aneinander vorbei. |
| Doku-Fließtext (README/ROADMAP/STATUS/docs) | Nicht Teil dieser Runde; der Verlaufseintrag in ROADMAP hält die Umbenennung fest. |

## Verifikation

1. `node scripts/generate-app-assets.mjs` → Splash visuell prüfen (Wordmark
   zweizeilig, zentriert, nicht beschnitten).
2. `npx cap sync android` → `capacitor.config.json` trägt die neue `appId`.
3. `gradlew assembleDebug` grün; APK installiert sich **neben** der alten App.
4. Launcher zeigt „GEOQUIZ ARCADE" unter dem Globus-Icon, Kaltstart zeigt den
   neuen Splash.
5. Web: `npm run dev`, Tab-Titel prüfen.
6. Offen bis zum Dashboard-Schritt: nativer Google-Login (siehe Abschnitt 2).
