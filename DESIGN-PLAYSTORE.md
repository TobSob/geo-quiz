# DESIGN — Play-Store-Reife

**Status:** Code-Teil umgesetzt · 2026-08-03 · manuelle Schritte offen
**Auslöser:** Nutzer-Frage „was würde noch fehlen, um es in den Google Play
Store zu bekommen?" — der Build ist seit 2026-07-18 signiert (`.aab`), aber
alles *drumherum* fehlte: Datenschutzerklärung, Konto-Löschung,
Versionsverwaltung, Backup-Hygiene.

## Abgrenzung

Play-Store-Reife hat drei Sorten Arbeit. Dieses Dokument deckt **Sorte 1**
vollständig ab und listet 2 und 3 nur als Checkliste, weil sie nicht im Repo
passieren:

| | Was | Wo |
|---|---|---|
| **1 — Code** | Datenschutzseite, Konto-Löschung, `versionCode`, Backup-Regeln, Feature-Grafik | dieses Repo |
| **2 — Konto** | Developer-Konto, Identitätsprüfung, Closed Testing | Play Console |
| **3 — Listing** | Texte, Screenshots, Data-Safety-Formular, Altersfreigabe | Play Console |

## 1. Konto-Löschung (der eigentliche Blocker)

Google verlangt seit 2023 für jede App, in der man ein Konto anlegen kann,
**zwei** Löschwege: einen **in der App** und einen über eine **öffentlich
erreichbare URL** (für Leute, die die App schon deinstalliert haben). Bisher
ließen sich in GEOQUIZ ARCADE nur Freundesgruppen löschen.

### Serverseite: eine einzige `delete`-Anweisung reicht

Der Glücksfall im bestehenden Schema: **jede** Nutzertabelle hängt mit
`on delete cascade` an `auth.users`. Geprüft über alle 16 Migrationen:

```
auth.users
├── profiles                 ├── player_stats        ├── play_sessions
├── user_progress            ├── player_badges       ├── group_join_attempts
├── score_entries            ├── cup_trophies        ├── friend_group_members
├── cup_runs                 ├── profile_featured_items
└── friend_groups (created_by)
      └── friend_group_members (cascade)
```

Es genügt also, die Zeile in `auth.users` zu löschen — Postgres räumt den Rest
auf. Kein Aufzählen von Tabellen, das beim nächsten Feature veraltet.

Migration `0017_account_deletion.sql`:

```sql
create function public.delete_own_account() returns void
  language plpgsql security definer set search_path = public, auth
```

- **`security definer`**, weil `auth.users` dem Client nicht gehört und über
  den Anon-Key auch nicht erreichbar ist.
- **`auth.uid()` statt Parameter** — die Funktion nimmt bewusst *kein*
  Argument. Eine `delete_account(user_id)` wäre eine Fremdkonten-Löschmaschine,
  sobald jemand den (öffentlichen!) Anon-Key benutzt.
- **`revoke from public/anon` + `grant to authenticated`**: Supabase gibt auch
  anonymen Sitzungen die Rolle `authenticated` (mit `is_anonymous: true` im
  JWT), Gäste können ihr Konto also ebenfalls löschen — richtig so, sie haben
  serverseitige Daten (Progress, Profil).
- Raise bei `auth.uid() is null`, damit ein Aufruf ohne Sitzung ein klarer
  Fehler ist und nicht still nichts tut.

**Falls Supabase dem `postgres`-Rollenbesitzer das `delete` auf `auth.users`
je entzieht**, ist der Ersatz eine Edge Function mit Service-Role-Key. Die
Client-Signatur (`deleteOwnAccount()`) bleibt dann gleich, nur der Aufruf
wechselt von `rpc()` auf `functions.invoke()`.

### Clientseite: Server zuerst, dann lokal

`deleteOwnAccount()` in `api/authApi.ts` und `DangerZone` in `ProfileScreen`:

1. RPC aufrufen — schlägt sie fehl, wird **nichts** lokal gelöscht (sonst
   verliert man den Fortschritt und der Server behält ihn: das schlechteste
   beider Welten).
2. `signOut()` — räumt das Token aus `@capacitor/preferences`.
3. Lokale Speicher leeren: `resetProgress()` (Rekorde, Lernfortschritt,
   Sync-Queue), Avatar auf Default, `gamification.reset()`.
   **Nicht** angefasst: `geo-quiz-settings` (Ton an/aus) — eine Geräte-
   Einstellung, kein Kontodatum.
4. Frische anonyme Sitzung über `ensureSession()` + `applyAuthSession()` —
   sonst stünde die App nach dem Löschen offline da und das nächste Spiel
   ginge ins Leere.

Zwei-Stufen-Bestätigung wie beim Gruppen-Löschen, aber mit ausgeschriebener
Konsequenzliste. Bewusst **kein** „tippe DELETE" — das Muster passt nicht zu
einer Arcade-Oberfläche und die zweite Stufe reicht bei einem Quiz-Konto.

## 2. Datenschutzerklärung + Löschseite als statische Seiten

Beide liegen als **fertiges HTML in `public/`**, nicht als React-Route:

- Sie müssen ohne installierte App und ohne JavaScript erreichbar sein — die
  Löschanleitung richtet sich ausdrücklich an Leute, die die App nicht mehr
  haben.
- Der HashRouter würde `/datenschutz` gar nicht bedienen; `public/datenschutz/index.html`
  liefert Cloudflare Pages direkt unter `…/datenschutz/` aus.
- Als Ordner mit `index.html` statt `datenschutz.html`, damit die URL in der
  Play Console ohne Endung sauber aussieht.

Beide Seiten bringen ihr eigenes Mini-CSS im 8-Bit-Look mit (System-Fonts, die
Pixel-Fonts wären für zwei Fließtextseiten unverhältnismäßiger Ballast).

### Platzhalter, die der Mensch füllen muss

Die Verantwortlichen-Angabe (Name, Anschrift, Kontakt) kann kein Skript
erfinden. Sie stand in beiden Seiten als `TODO_ANBIETER_*`, und
`scripts/release.mjs` **bricht den Web-Deploy ab**, solange ein solcher
Platzhalter im `dist/` steht. Eine Datenschutzerklärung mit „TODO" darin ist
schlimmer als keine — der Abbruch ist Absicht, kein Komfortverlust. Die Sperre
hat beim ersten echten Release-Versuch genau das getan.

**Seit 2026-08-04 ausgefüllt** (Kontakt `geoquizsupport@gmail.com`); die Sperre
bleibt als Netz für künftige Textänderungen. Beide Seiten tragen bewusst
`noindex`: Play verlangt nur, dass die URL erreichbar ist — die dort genannte
Privatanschrift muss dafür nicht in Suchmaschinen stehen.

## 3. `versionCode` automatisch hochzählen

Play nimmt jedes `.aab` nur mit **höherem** `versionCode` an als der zuletzt
hochgeladene; `app/build.gradle` stand seit dem ersten Tag auf `1`.

`release.mjs` erhöht ihn jetzt **standardmäßig** vor jedem Android-Release-
Build und schreibt ihn in `build.gradle` zurück (taucht im `git diff` auf, ist
also nachvollziehbar). `--no-bump` schaltet es ab.

Warum Default statt Opt-in: Das Skript existiert genau deshalb, weil „macht
`npm run deploy` auch eine neue APK?" mit „nein" beantwortet werden musste.
Eine Nummer, die man vor dem Upload von Hand hochsetzen muss, vergisst man
genau einmal — und merkt es erst beim abgelehnten Upload. Ein zu hoher
`versionCode` kostet dagegen nichts: Play verlangt nur Monotonie, keine
Lückenlosigkeit. Der `versionName` (die für Menschen sichtbare „1.0") bleibt
manuell, den soll eine Release-Entscheidung setzen, kein Build.

## 4. Auth-Token nicht ins Google-Drive-Backup

Capacitors Manifest-Default ist `android:allowBackup="true"`. Damit wandern die
`SharedPreferences` in Googles Auto-Backup — inklusive der Supabase-Session,
die seit B4 bewusst dort liegt (`CapacitorStorage.xml`).

Statt Backup komplett abzuschalten wird gezielt **diese eine Datei**
ausgenommen, über beide Regelwerke (`fullBackupContent` für API < 31,
`dataExtractionRules` ab 31). Folge: Ein wiederhergestelltes Gerät startet mit
frischer anonymer Identität; wer einen Account hat, meldet sich an und hat
alles zurück. Ein Token, das über Jahre in einem Drive-Backup liegt, ist der
schlechtere Tausch.

## 5. Feature-Grafik 1024×500

Play verlangt eine Feature-Grafik; `scripts/generate-app-assets.mjs` kann
Pixel-Globus und Wordmark bereits prozedural zeichnen. Ergänzt um ein
Querformat-Banner (Globus links, zweizeiliges Wordmark rechts, Sternenfeld) →
`assets/feature-graphic.png`. Kein neues Werkzeug, keine Bilddatei im Repo,
die niemand mehr reproduzieren kann.

## 6. Bildnachweise der Landmark-Fotos (nachgereicht 2026-08-03)

CC-BY(-SA) verlangt Urheber **und** Lizenz; `docs/IMAGE_CREDITS.md` nannte nur
den Wikipedia-Artikel. `fetch-landmark-images.mjs` holt beides jetzt über
`prop=imageinfo&iiprop=extmetadata` mit im selben Lauf, in dem es die Fotos
herunterlädt — damit können Nachweis und ausgelieferte Datei nicht
auseinanderlaufen. Bestätigt: beim Lauf hat sich **keine** Bilddatei geändert.

Vier alte Uploads haben weder ein `Artist`-Feld noch ein `author=` im Wikitext
(geprüft, nicht vermutet). Für die zieht das Skript den **Erst-Uploader** aus
der Dateiversion-Historie — „unbekannt" wäre bei CC-BY keine zulässige
Namensnennung.

### Nachtrag 2026-08-05: Alhambra war ein Grundriss

Beim Aufnehmen der Store-Screenshots fiel auf, dass der Landmark-Modus für die
**Alhambra** keine Fotografie zeigte, sondern „Plano del Palacio Arabe" — eine
Grundriss-Tafel von 1889. Ursache ist dieselbe wie bei den 17 bereits
umgeschriebenen Einträgen: Wikipedias `pageimage` ist nicht zwingend ein Foto.
Als Hinweis im Spiel ist ein Grundriss wertlos, und im Store-Screenshot sieht
er nach Fehler aus.

Ersetzt durch `Alhambra from Generalife (2017).jpg` (Martinvl, CC BY-SA 4.0)
über denselben `MANUAL_OVERRIDES`-Weg. Bewusst **nicht** das
Mirador-San-Nicolás-Panorama aus demselben Artikel: 10172×2160 ergäbe als
500er-Thumbnail einen 106 px hohen Streifen, im 88-px-Bildfeld des Pin-Modus
unbrauchbar.

Ein Scan aller 129 Nachweise auf Wörter wie *Plano, Grundriss, Tafel, Karte,
Diagramm, Zeichnung* fand **keinen zweiten Fall** (der einzige weitere Treffer,
„Hollywood Sign (Zuschnitt)", ist ein beschnittenes Foto). Beim erneuten Lauf
hat sich erwartungsgemäß **nur `lm_alhambra.jpg`** geändert — die übrigen 128
Dateien sind byte-identisch geblieben, die Nachweise beschreiben also weiterhin
exakt das Ausgelieferte.

Die Nachweise liegen in einer **eigenen** `landmark-credits.json`: 33 KB gegen
22 KB Quizdaten, gebraucht nur vom Screen `/credits`. Als Feld am Landmark
lägen sie im Startbundle, so sind sie ein nachgeladener Chunk (9,2 KB gzip).

**Bewusst keine Bildunterschrift am Foto:** im Pin-Modus ist das Foto auf dem
Handy 88 px breit, und das Choice-Layout ist auf „360×640 ohne Scrollen"
getrimmt. Ein Nachweis-Screen ist die für Spiele übliche und akzeptierte Form.

## Bewusst NICHT in dieser Runde

- **R8/Minification** (`minifyEnabled false`) — Größenoptimierung, kein
  Store-Kriterium.
- **Screenshots** — brauchen ein echtes Gerät bzw. den Emulator, kein Code.
  Am 2026-08-05 nachgeholt: 7 Motive aus dem AVD, siehe
  [docs/STORE-LISTING.md](docs/STORE-LISTING.md) §5.

## Nachtrag 2026-08-05: Listing-Texte und Formular-Antworten

Alles, was unten als „Checkliste" steht, ist inzwischen ausformuliert und
versioniert: **[docs/STORE-LISTING.md](docs/STORE-LISTING.md)** enthält Titel,
Kurz- und Vollbeschreibung (mit gezählten Zeichenzahlen), die Listing-Felder,
die Data-Safety-Tabelle und den IARC-Fragebogen. Grund für die eigene Datei
statt eines Abschnitts hier: Dieses Dokument begründet **Entscheidungen**, die
Listing-Datei liefert **Text zum Kopieren** — beides in einer Datei zu mischen
hieße, beim nächsten Textfeinschliff durch Herleitungen zu scrollen.

## Manuelle Schritte (Play Console)

Anmeldung: **https://play.google.com/console/signup** — 25 USD einmalig,
danach Identitätsprüfung (Ausweis + Anschrift). Für neue Privatkonten
verlangt Google zusätzlich eine Closed-Testing-Phase (zuletzt 12 Tester,
14 Tage durchgehend), bevor die Produktions-Spur freigeschaltet wird.

Checkliste nach der Anmeldung:

1. App anlegen (`de.tobsob.geoquizarcade`, Name „GEOQUIZ ARCADE", Deutsch)
2. **Play App Signing aktivieren** beim ersten Upload — der lokale Keystore
   wird damit zum reinen Upload-Key und ist ersetzbar. Ohne das ist ein
   Keystore-Verlust das Ende der App. Keystore trotzdem sichern.
3. Datenschutz-URL eintragen: `https://geo-quiz-a6s.pages.dev/datenschutz/`
4. Konto-Lösch-URL eintragen: `https://geo-quiz-a6s.pages.dev/konto-loeschen/`
5. Data-Safety-Formular — erhoben werden: E-Mail (Account), Anzeigename,
   Avatar-Auswahl, Spielergebnisse, User-ID. Verschlüsselt in Transit (HTTPS),
   löschbar (siehe 4.)
6. Altersfreigabe (IARC-Fragebogen) + Zielgruppe. **Empfehlung 13+ /
   „nicht primär an Kinder gerichtet"** — die Families-Policy zöge bei
   Accounts + globaler Bestenliste deutlich strengere Auflagen nach sich.
7. Listing: Kurzbeschreibung (80 Z.), Vollbeschreibung (4000 Z.), Icon
   512×512 (`assets/icon-only.png`), Feature-Grafik
   (`assets/feature-graphic.png`), min. 2 Telefon-Screenshots
8. `.aab` aus `frontend/release/` hochladen

## Verifikation

- 0017 auf der Live-DB einspielen, dann mit einem Wegwerf-Account:
  Runde spielen → Score in der Bestenliste → Konto löschen → Score weg,
  Anmeldung mit denselben Daten schlägt fehl
- `…/datenschutz/` und `…/konto-loeschen/` nach dem Deploy im Browser öffnen
- `npm run release -- --no-deploy`: `versionCode` 1 → 2 im Log und im
  `git diff`
- `aapt dump badging` auf der neuen APK: `versionCode='2'`
