# Offene Punkte

> **Stand:** 2026-10-05 (0018 live) · 2026-10-03 (Moderation, Migrationen, K12) · vorher 2026-09-12 · **Verifiziert:** Code-Prüfung, Live-Abfragen,
> Dashboard-Durchgang am 2026-09-12, Grep über das **ausgelieferte** Web-Bundle,
> `npm run test`. Diese Seite hat bei Widerspruch **Vorrang** vor
> Status-Spalten in ROADMAP.md und STATUS.md.

## Blockiert die Veröffentlichung

| # | Punkt | Warum es blockt |
|---|---|---|
| 1 | **Mail landet bei Outlook im Junk** | Registrierung **funktioniert** Ende zu Ende (2026-09-14 mit echter Mail bewiesen, Links über `geoquiz.tobsob.dev`). Offen ist nur die Zustellung: SPF/DKIM/DMARC `pass`, trotzdem `SCL 5`. Hauptursache Domain-Alter, das geht nur mit Zeit weg. Bis dahin Tester vorwarnen („Junk prüfen, dann *Kein Junk*, sonst ist der Link gesperrt") oder Google-Login empfehlen. Kein harter Blocker mehr |
| 2 | **Play Console: App anlegen + App Signing** (K11) | Ohne Play App Signing ist ein Keystore-Verlust das Ende der App |
| 3 | **Data-Safety-Nachtrag zur Prüfung einreichen** (am 2026-10-05 in der Console gespeichert; fehlt nur das Absenden unter *Veröffentlichungen – Übersicht*) | Mit 0018 kommt bei *Nutzer-IDs* der Zweck „Sicherheit und Compliance" dazu, siehe [../STORE-LISTING.md](../STORE-LISTING.md) §6 |
| 4 | **Store-Eintrag befüllen** (K13) | Texte, Icon, Feature-Grafik, Screenshots liegen bereit |
| 5 | **Closed Testing** (K14) | Neue Privatkonten: zuletzt 12 Tester, 14 Tage durchgehend. Die eigentliche Wartezeit — nicht abkürzbar |

## Sollte vor dem Release passieren

| Punkt | Begründung |
|---|---|
| **Bestandsnamen prüfen** | 0018 ist live und gegen die echte DB geprüft (siehe Erledigt). Offen nur: die zwei Prüfabfragen am Ende von `0018_name_moderation.sql` einmal im SQL-Editor laufen lassen — der Filter greift nur bei neuen/geänderten Namen |
| **2 fehlende Screenshots** | Globale Bestenliste + Pokalregal, beide brauchen eine Anmeldung im Emulator. Kein Blocker (Play verlangt 2, es gibt 7), aber die Bestenliste ist das Verkaufsargument |

## Erledigt seit dem letzten Stand

- **Play Console, Einrichtung 11/11** (2026-10-05): App-Kategorie *Quiz*, Tags
  *Quiz, Arcade, Casual, Denkspiele*, Kontakt-E-Mail + Website eingetragen
  (Werte in [../STORE-LISTING.md](../STORE-LISTING.md) §4). Damit ist der Block
  „Dein Spiel fertig einrichten" im Dashboard weg. Geschlossener Test: Länder
  (DE/AT/CH), Tester (Google Group `geoquiztester@googlegroups.com`) und ein
  Release-Entwurf sind angelegt; offen sind *Release-Vorschau bestätigen* und
  *zur Überprüfung senden* — erst damit geht alles (inkl. Data Safety) an
  Google. Formfaktor **„Google Play Games on PC" am 2026-10-05
  deaktiviert** (war ungewollt an; Testen und veröffentlichen → Erweiterte
  Einstellungen → Formfaktoren). **Android XR** steht dort weiter auf „Aktiv"
  und hat in der Console **keinen Aus-Schalter** — „Verwalten" bietet nur
  „gleicher Track wie Mobil" (eingestellt) oder „eigener Track". Google nimmt
  Handy-Apps dort offenbar automatisch auf; bewusst so gelassen (2026-10-05).

- **Namensmoderation live** (2026-10-05): Migration 0018 eingespielt
  (korrigierte Fassung), Web mit neuer Datenschutzerklärung (Stand 3. Oktober)
  ausgeliefert, Build 15 (`versionCode 15`) gebaut am 2026-10-03. Live-Prüfung
  siehe [backend-supabase.md](backend-supabase.md). Den Melden-Knopf mit zwei
  registrierten Konten hat noch niemand durchgeklickt.

- **Migrationen 0013/0014 sind live** (2026-10-03 geklärt): vom Nutzer am
  2026-07-18 eingespielt (ROADMAP I6), heute per Anon-Abfrage bestätigt —
  Details in [backend-supabase.md](backend-supabase.md). STATUS.md war
  veraltet und ist nachgezogen.
- **Data Safety + IARC + Zielgruppe** (K12) am 2026-09-14 in der Console
  eingetragen: USK 0 / PEGI 3 ([../STORE-LISTING.md](../STORE-LISTING.md) §8).

- **Dauerhaft schwarze Karte bei Städte-Pin auf Android** (2026-09-23,
  Nachtrag in [../../DESIGN-MAP-FIXES.md](../../DESIGN-MAP-FIXES.md)):
  Feedback-Meldung — Karte gelegentlich schwarz, half nur ein Neustart.
  Ursache vermutlich WebGL-Kontextverlust im Android-WebView bei
  Speicherdruck, den der Browser nicht immer zurückgibt. Watchdog in
  `PinMap.tsx` baut die Karte nach 4 s ohne Recovery neu auf. Im Browser mit
  simuliertem Kontextverlust geprüft. **Auf dem Gerät bestätigt am 2026-09-27**
  (S24 Ultra, Build 14): mehrere Städte-Pin-Runden mit Wechseln in den
  Hintergrund, die Karte hielt durch.
- **Google-Login in der Android-App** (2026-09-14, Build 13): landete vorher
  im Browser. Deep-Link `de.tobsob.geoquizarcade://auth-callback`, Custom Tab,
  PKCE nur nativ ([DESIGN-OAUTH-ANDROID.md](../../DESIGN-OAUTH-ANDROID.md)).
  Unterwegs zwei weitere Fehler gefunden und behoben: `email_exists` löste den
  Anmelde-Umweg nicht aus (betraf auch das **Web**), und der automatische
  zweite Sprung verschwand in der App hinter dem Bildschirm — dort jetzt ein
  zweiter Tipp. Auf dem Gerät bestätigt; GitHub und ein ganz neues
  Google-Konto nicht getestet. Supabase-Redirect-URL eingetragen.
- **Store-Screenshots** erneuert: Pin-Modi mit neuer Karte, Spielerkarte mit
  Pokalregal; globale Bestenliste bewusst weggelassen (fremder Name).

- **Rang mit Mindestmenge** (ROADMAP C8, 2026-09-14): 3 von 3 richtig ergab
  **A**. Jetzt `richtig / max(beantwortet, 15)` in Choice-Modi, 7 in
  Pin-Modi — Herleitung im Nachtrag von
  [DESIGN-ARCADE.md](../../DESIGN-ARCADE.md). Code in
  `quiz-engine/arcadeRank.ts`, Tests 172/172. **Auf dem Gerät bestätigt**
  (Build 9, `versionCode 9`): 3 von 3 richtig ergibt jetzt **D**.

- **Build 8** (2026-09-14, `versionCode 8`, signiert): enthält Passwort-Reset
  und Mail-Link-Einlösung; im App-Bundle geprüft, dass `token_hash` und
  `geoquiz.tobsob.dev` drin sind und `geo-quiz-a6s` nicht mehr. Löst den
  Blocker „Android-Build älter als das Web". **Auf dem Gerät bestätigt**
  (S24 Ultra, per `adb install -r` über Build 7, Spielstand erhalten): Karte
  im Pin-Modus rendert, Flaggen-Runde läuft durch, Datenschutz-Link öffnet
  die neue Domain. Einziger Befund: die Rang-Bewertung (siehe oben).
- **Unversionierter Stand committet und gepusht** (`0bd62f5`, 2026-09-14).

- **Mailversand eingerichtet** (2026-09-12, Dashboard-Durchgang) — 2FA,
  App-Passwort, Custom SMTP `smtp.gmail.com:587`, Rate Limit 30/h, deutsche
  Templates. Details und Prüfstand: [auth-und-email.md](auth-und-email.md).
  Damit ist der langjährige Blocker „kein Mailversand" **weg**; offen ist nur
  noch der Beweis durch eine zugestellte Mail (Punkt 1 oben).
- **Site-URL bestätigt** (ROADMAP A4, vorher „ungeprüft") — steht korrekt auf
  `https://geo-quiz-a6s.pages.dev`. Die Redirect-Liste enthielt nur
  `http://localhost:5173`, ergänzt um `https://geo-quiz-a6s.pages.dev/**`.
- **„Passwort vergessen"** — gebaut am 2026-08-30
  ([DESIGN-PASSWORD-RESET.md](../../DESIGN-PASSWORD-RESET.md)) und
  nachweislich im Live-Web ausgeliefert. Tests **157/157 grün**
  (`npm run test`, 2026-09-12).

## Nebenbefunde aus dem Mail-Test (2026-09-13)

| Befund | Folge |
|---|---|
| **Serverseitig gelöschter Gast hängt fest** | Wird ein User im Dashboard gelöscht, behält der Browser sein Token. Jede Aktion endet in `403 user_not_found`, die App fängt das nicht ab und bietet keinen Ausweg außer Browserdaten löschen. Beim Test dreimal hintereinander passiert |
| **SMTP-Fehler, gelöschter User und Unbekanntes sehen gleich aus** | Alle landen im Auffang-Text „Etwas ist schiefgelaufen — bitte versuche es erneut". Ein Nutzer versucht es erneut, ohne Chance. Diagnose ging nur über die Auth-Logs |

## Bekannt und bewusst offen

- **Anti-Cheat Stufe 2** (server-autoritative Runden) — Stufe 1 (Session-Guard)
  läuft.
- **R8/Minification** (`minifyEnabled false`) — Größenoptimierung, kein
  Store-Kriterium.
- **Eigene Domain** — nötig für belastbaren Mailversand (SPF/DKIM), sonst
  kosmetisch.
- **i18n** — Datenmodell hat `name`/`nameDe`, die UI-Strings sind nicht
  extrahiert.
- **Smoke-Tests A5/A6** — vollständiger Modi-Durchlauf durch einen Menschen.

## Korrekturen an bestehenden Dokumenten

Beim Aufbau dieses Wikis am 2026-08-30 gefunden und hier festgehalten, weil die
Originale sie noch anders angeben:

| Doku sagt | Tatsächlich |
|---|---|
| STATUS.md: Phase J „OAuth-Setup offen" | Google **und** GitHub sind serverseitig aktiv |
| STATUS.md: 141 Städte | **143** |
| STATUS.md: 21 Avatare | **22** (Beta-Tester-Avatar aus 0015) |
| STATUS.md (Android-Tabelle): App-ID `de.tobsob.geoquiz` | **`de.tobsob.geoquizarcade`** (`build.gradle`, `capacitor.config`; geprüft 2026-09-14) |
| STATUS.md: 103 Tests, 9 Dateien | **157** in 16 Dateien (Stand 2026-08-30, nach dem Reset-Flow) |
| DESIGN-PLAYSTORE §7 / ROADMAP K16: react-leaflet (Hippocratic 2.1) als aktuelle Abhängigkeit | mit dem MapLibre-Umbau **entfallen**; der Credits-Screen ist bereits nachgezogen, die beiden Dokumente beschreiben einen vergangenen Zustand |
