# Offene Punkte

> **Stand:** 2026-09-12 · **Verifiziert:** Code-Prüfung, Live-Abfragen,
> Dashboard-Durchgang am 2026-09-12, Grep über das **ausgelieferte** Web-Bundle,
> `npm run test`. Diese Seite hat bei Widerspruch **Vorrang** vor
> Status-Spalten in ROADMAP.md und STATUS.md.

## Blockiert die Veröffentlichung

| # | Punkt | Warum es blockt |
|---|---|---|
| 1 | **Mail landet bei Outlook im Junk** | Registrierung **funktioniert** Ende zu Ende (2026-09-14 mit echter Mail bewiesen, Links über `geoquiz.tobsob.dev`). Offen ist nur die Zustellung: SPF/DKIM/DMARC `pass`, trotzdem `SCL 5`. Hauptursache Domain-Alter, das geht nur mit Zeit weg. Bis dahin Tester vorwarnen („Junk prüfen, dann *Kein Junk*, sonst ist der Link gesperrt") oder Google-Login empfehlen. Kein harter Blocker mehr |
| 2 | **Play Console: App anlegen + App Signing** (K11) | Ohne Play App Signing ist ein Keystore-Verlust das Ende der App |
| 3 | **Data Safety + IARC + Zielgruppe** (K12) | Antworten liegen fertig in [../STORE-LISTING.md](../STORE-LISTING.md) §6/§7 |
| 4 | **Store-Eintrag befüllen** (K13) | Texte, Icon, Feature-Grafik, Screenshots liegen bereit |
| 5 | **Closed Testing** (K14) | Neue Privatkonten: zuletzt 12 Tester, 14 Tage durchgehend. Die eigentliche Wartezeit — nicht abkürzbar |

## Sollte vor dem Release passieren

| Punkt | Begründung |
|---|---|
| **Migrationen 0013/0014 live?** | STATUS.md nennt sie als ausstehend, 0017 ist aber nachweislich live. Widersprüchlich — im Dashboard nachsehen und hier eintragen |
| **2 fehlende Screenshots** | Globale Bestenliste + Pokalregal, beide brauchen eine Anmeldung im Emulator. Kein Blocker (Play verlangt 2, es gibt 7), aber die Bestenliste ist das Verkaufsargument |

## Erledigt seit dem letzten Stand

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
