# Play-Store-Eintrag — GEOQUIZ ARCADE

> Alle Texte und Formular-Antworten für den Store-Eintrag, versioniert im Repo
> (Roadmap K13a). In der Play Console werden sie von hier kopiert — nicht dort
> direkt getippt, sonst existiert die einzige Fassung in einem Webformular.
> Stand: 2026-09-14 (Texte gegen Code geprüft) · Paket `de.tobsob.geoquizarcade`

**Zeichen-Limits von Play:** Titel 30 · Kurzbeschreibung 80 · Vollbeschreibung 4000.
Die Zahlen unten sind gezählt, nicht geschätzt.

---

## 1. App-Titel (max. 30)

```
GEOQUIZ ARCADE
```

14 Zeichen. Großschreibung ist Play-konform, weil sie **Teil des Markennamens**
ist (so steht sie in `strings.xml`, auf dem Splash und im Launcher) — die
Metadaten-Richtlinie verbietet Versalien nur als Aufmerksamkeits-Trick.

## 2. Kurzbeschreibung (max. 80)

Die Kurzbeschreibung steht unter dem Icon und ist der einzige Text, den fast
jeder liest. Sie nennt deshalb das Spielprinzip, nicht das Thema — „Geografie-
Quiz" gibt es hundertfach, „60 Sekunden" ist der Unterschied.

**Empfohlen (75 Zeichen):**

```
60 Sekunden, so viele Länder wie du schaffst — Geografie-Quiz im 8-Bit-Look
```

Alternativen, falls dir eine andere Betonung lieber ist:

| Variante | Zeichen | Betonung |
|---|---|---|
| `Retro-Geografie-Quiz: 60 Sekunden Zeit, Streak-Multiplikator ohne Deckel` | 72 | Scoring |
| `Flaggen, Hauptstädte, Umrisse, Pins — Geografie-Arcade mit Bestenlisten` | 71 | Umfang |
| `Wie viel Welt schaffst du in 60 Sekunden? Geografie-Quiz im Retro-Look` | 70 | Frage/Ansprache |

Bewusst **ohne Emoji**: Play rät für Titel und Kurzbeschreibung davon ab, und
die Kurzbeschreibung wird auf schmalen Geräten abgeschnitten — jedes Zeichen
zählt.

## 3. Vollbeschreibung (max. 4000)

Aufbau nach dem, was ein Store-Besucher in dieser Reihenfolge wissen will:
Was ist das → was spiele ich → warum weiterspielen → was kostet es mich
(Werbung? Konto? Daten?). Der letzte Block steht bewusst nicht im Kleingedruckten,
weil „keine Werbung, keine Käufe" ein Kaufargument ist und kein Haftungshinweis.

```text
GEOQUIZ ARCADE ist ein Geografie-Quiz im 8-Bit-Look: 60 Sekunden pro Runde, und
du beantwortest so viele Fragen, wie du schaffst. Keine Fragenlisten, die du
abarbeitest — eine Uhr, ein Punktestand, sofort noch eine Runde.

SECHS DISZIPLINEN

- Flaggen: Welches Land gehört zu dieser Flagge?
- Hauptstädte: Wie heißt die Hauptstadt?
- Länder: Zu welchem Land gehört diese Hauptstadt?
- Umrisse: Erkenne das markierte Land auf der Weltkarte
- Städte-Pin: Setze den Pin so nah wie möglich an die richtige Stelle
- Landmark-Pin: Wo auf der Welt steht dieses Wahrzeichen?

Dazu der GEO CUP: alle sechs Disziplinen hintereinander, je 30 Sekunden, eine
Gesamtwertung. Das ist die Königsdisziplin — und die Bestenliste, um die es
wirklich geht.

PUNKTE, DIE SICH VERDIENEN LASSEN

Jede richtige Antwort gibt 100 Punkte, und deine Serie multipliziert: plus 10
Prozent pro Treffer, ohne Obergrenze. Bei den Karten-Modi zählt die Entfernung —
unter 100 Kilometer ist ein VOLLTREFFER und gibt sogar Zeit zurück. Alle zehn
Treffer in Serie bekommst du fünf Sekunden geschenkt. Wer eine Serie hält, spielt
länger und punktet höher: Risiko und Belohnung hängen zusammen.

TRAINING OHNE UHR

Der Trainingsmodus läuft ohne Zeitdruck, endlos oder über 10 bzw. 25 Fragen, mit
frei wählbaren Kategorien. Er merkt sich, was du oft falsch machst, und legt es
dir wieder vor. Trainingsrunden zählen nicht in die Bestenliste — sie sind zum
Lernen da, nicht zum Angeben.

SAMMELN, STEIGEN, ANGEBEN

- 21 handgepixelte Avatare, die du dir über Level und Erfolge freischaltest
- 16 Abzeichen in fünf Stufen von Normal bis Diamant
- XP und Level bis 99
- Pokale für die Wochen-, Monats- und Jahresbesten im Cup — Hall of Fame zum
  Zurückblättern
- Ein Pokalregal mit sechs Plätzen, das du selbst bestückst und das jeder auf
  deiner Spielerkarte sieht

GEGEN FREUNDE

Erstelle eine Gruppe, teile den Code (zum Beispiel TURBO-YETI-83), und ihr habt
eure eigene Bestenliste — dieselben Disziplinen, nur euer Kreis.

FAIR UND OHNE HAKEN

- Keine Werbung
- Keine In-App-Käufe
- Kein Tracking, keine Analyse-Dienste
- Sofort spielbar ohne Konto — Registrierung nur, wenn du in die globalen
  Bestenlisten willst
- Läuft offline (nur die Weltkarte der Pin-Modi und die Bestenlisten brauchen
  Internet)
- Dein Konto löschst du jederzeit selbst im Profil, vollständig

245 Länder, 143 Städte, 129 Sehenswürdigkeiten mit Foto. Deutschsprachig.

Viel Erfolg — und pass auf die Uhr auf.
```

**2 449 Zeichen** von 4000 (gezählt 2026-09-14). Der Rest bleibt bewusst frei: Play schneidet die
Beschreibung in der Vorschau nach wenigen Zeilen ab, und ein Textblock, den
niemand zu Ende liest, verkauft nichts.

### Was bewusst nicht drinsteht

- **Keine Keyword-Liste** am Ende („geografie quiz länder flaggen hauptstädte …").
  Play wertet das als Keyword-Spam, und die Vollbeschreibung ist ohnehin nur
  schwach für die Suche relevant.
- **Kein Versprechen auf künftige Features** (iOS, weitere Modi) — was im Store
  steht, muss die installierte App können.
- **Keine Altersangabe im Text.** Die kommt aus dem IARC-Fragebogen; eine im
  Text behauptete Freigabe, die vom Ergebnis abweicht, ist ein Richtlinien-Verstoß.
- **Nicht „lerne spielend Geografie" als Aufhänger.** Das rutscht Richtung
  Bildungs-App für Kinder — und damit in die Nähe der Families-Policy, die wir
  mit Konten und globaler Bestenliste bewusst meiden (siehe K12).

---

## 4. Weitere Listing-Felder

| Feld | Wert |
|---|---|
| App-Name | GEOQUIZ ARCADE |
| Standardsprache | Deutsch (Deutschland) |
| App oder Spiel | **Spiel** |
| Kategorie | Quizspiele (Trivia) |
| Tags | Quiz, Bildung, Gelegenheitsspiel |
| Kontakt-E-Mail | `geoquizsupport@gmail.com` |
| Website | `https://geoquiz.tobsob.dev` |
| Datenschutzerklärung | `https://geoquiz.tobsob.dev/datenschutz/` |
| Konto-Löschung (URL) | `https://geoquiz.tobsob.dev/konto-loeschen/` |
| Icon 512×512 | `frontend/assets/icon-only.png` |
| Feature-Grafik 1024×500 | `frontend/assets/feature-graphic.png` |
| Telefon-Screenshots | `frontend/assets/store-screenshots/` (siehe unten) |

## 5. Telefon-Screenshots (K13b)

**Upload-Satz, Stand 2026-09-14** — 7 Bilder, in dieser Reihenfolge hochladen:

| Datei | Motiv | Quelle |
|---|---|---|
| `01-menue.png` | Startmenü mit Geo Cup obenauf | AVD, 2026-08-05 (1080×2400) |
| `02-flaggen-streak.png` | Flaggen-Frage mit Serie „⚡ 2 · 120%" | AVD, 2026-08-05 |
| `03-umrisse.png` | Guinea-Bissau markiert, Nachbarn sichtbar | AVD, 2026-08-05 |
| `04-staedte-pin.png` | Nuuk aufgelöst: „VOLLTREFFER! 54 km daneben +100" | **S24 Ultra, Build 9, 2026-09-14** (1080×2340) |
| `05-geo-cup.png` | Cup-Intro mit allen 6 Disziplinen | AVD, 2026-08-05 |
| `07-landmark-pin.png` | Roter Platz mit Foto: „VOLLTREFFER! 66 km daneben +105" | **S24 Ultra, Build 9, 2026-09-14** |
| `08-spielerkarte-pokalregal.png` | Eigene Spielerkarte: Level 18, Pokalregal voll, Bestpunkte | **S24 Ultra, Build 13, 2026-09-14** |

Warum die Änderungen gegenüber dem 05.08.:

- **04 und 07 neu:** Die alten Bilder zeigten noch die **CARTO-Karte** von vor
  dem MapLibre-Umbau, 07 dazu den Alhambra-**Grundriss**.
- **08 neu:** Pokalregal ist nur angemeldet zu sehen. Nach dem Fix des
  Google-Logins in der App (DESIGN-OAUTH-ANDROID.md) mit dem eigenen Konto
  aufgenommen — zeigt ausschließlich eigene Daten.
- **`06-training.png` nicht im Upload-Satz** (Datei bleibt liegen): schwächstes
  Motiv, und Play erlaubt höchstens 8.
- **Globale Bestenliste bewusst weggelassen:** Aufgenommen, aber darauf stand
  der selbst gewählte Name eines anderen echten Spielers. Ohne Einwilligung
  nicht im Store veröffentlichen.

Gemischte Seitenverhältnisse (20:9 vom Emulator, 19,5:9 vom S24) nimmt Play an.
Beim Aufnehmen auf dem Gerät auf **Vollbild** achten: Nach einer
Tastatureingabe (Anmeldung) waren Status- und Navigationsleiste sichtbar,
ein Neustart der App behebt das.

```bash
adb exec-out screencap -p > frontend/assets/store-screenshots/NAME.png
```

## 6. Data-Safety-Formular (K12)

Antworten decken sich mit der [Datenschutzerklärung](../frontend/public/datenschutz/index.html) —
Abweichungen sind ein Richtlinien-Verstoß, nicht nur unschön.

**Werden Daten erhoben oder geteilt?** Erhoben ja, **geteilt nein**.
Supabase, Cloudflare und seit 2026-09-13 **Resend** (Mailversand) verarbeiten
im Auftrag — das zählt bei Google ausdrücklich nicht als Teilen. Die
Datenschutzerklärung nennt alle drei (Stand 2026-09-14).
**Alle Daten verschlüsselt übertragen?** Ja (HTTPS).
**Kann der Nutzer Löschung verlangen?** Ja — in der App *und* über die
Lösch-URL.

| Kategorie | Typ | Erhoben | Geteilt | Pflicht? | Zweck |
|---|---|---|---|---|---|
| Personenbezogene Daten | E-Mail-Adresse | ja | nein | optional (nur bei Registrierung) | Kontoverwaltung |
| Personenbezogene Daten | Nutzer-IDs | ja | nein | Pflicht | Kontoverwaltung, Spielfunktionen |
| Personenbezogene Daten | Name (frei wählbarer Spielername) | ja | nein | Pflicht | Spielfunktionen (Bestenliste) |
| App-Aktivität | App-Interaktionen (Punkte, Runden, Lernfortschritt, Zeitstempel/Dauer einer Runde) | ja | nein | Pflicht | App-Funktionen **+ Betrugsprävention, Sicherheit und Compliance** (Session-Guard gegen manipulierte Scores, DSE §3 „berechtigtes Interesse") **+ Personalisierung** (adaptiver Trainingsmodus wählt Fragen nach Lernfortschritt, DSE §3) |
| App-Aktivität | Sonstige nutzergenerierte Inhalte (Name einer Freundesgruppe) | ja | nein | optional | App-Funktionen |

**In der Console eingetragen 2026-09-14**, Vorschau gegen die
Datenschutzerklärung abgeglichen. Abweichung zur Tabelle: E-Mail-Adresse trägt
zusätzlich „Funktionen der App" (Google zählt Authentifizierung dazu). Die
Store-Zeile „Der Entwickler bietet keine Möglichkeit, das Löschen von Daten
anzufordern" meint Teil-Löschung ohne Kontolöschung; die gibt es nicht, die
Kontolöschung mit Link steht direkt darüber.

*Nachgetragen 2026-09-14 beim Ausfüllen:* die Gruppennamen-Zeile, der
Betrugspräventions- und der Personalisierungs-Zweck fehlten in der ursprünglichen Fassung; beides steht so
in der Datenschutzerklärung §3.

Nicht erhoben und entsprechend zu verneinen: Standort, Kontakte, Fotos/Videos,
Audio, Kalender, SMS, Gesundheit, Finanzdaten, Geräte-IDs für Werbung,
Absturz-/Diagnosedaten, Werbe- oder Marketingdaten.

Begründung für „Avatar" und „Abzeichen": fallen unter App-Aktivität
(Spielinteraktionen), keine eigene Kategorie nötig.

## 7. Altersfreigabe (IARC) + Zielgruppe (K12)

- Gewalt, Sexualität, Schimpfwörter, Drogen, Glücksspiel, Angst: **jeweils nein**
- **Kommunikation zwischen Nutzern: Nein** (revidiert 2026-09-14). Der echte
  Fragebogen fragt nicht allgemein nach nutzergenerierten Inhalten, sondern:
  „Verfügt das Spiel über ein natives Feature, durch das Nutzer per Sprache
  oder Text mit anderen kommunizieren oder Bilder/Audiodaten teilen können?"
  Probeweise mit **Ja** beantwortet (Nachfragen Blockieren/Melden/Moderation/
  nur Freunde: alle Nein) ergab das **USK ab 16** („Erhöhte
  Kommunikationsrisiken") und in allen Regionen das Element **„Chats"**, bei
  sonst USK-freien Werten (PEGI 3, ESRB Jedes Alter, ClassInd 0). Die App hat
  keinen Chat; „Chats" wäre selbst eine Falschdarstellung. Freie Spieler- und
  Gruppennamen sind nutzergenerierte Inhalte, aber keine Kommunikation im Sinne
  der Frage. Die Googles UGC-Richtlinie gilt davon unabhängig → Moderation für
  Namen steht in [wiki/offene-punkte.md](wiki/offene-punkte.md).
- Standortweitergabe an andere Nutzer: nein
- Käufe: nein · Werbung: nein
- **Zielgruppe: 13+ / „nicht primär an Kinder gerichtet"**. Mit Konten, frei
  wählbaren Namen und globaler Bestenliste zöge die Families-Policy deutlich
  strengere Auflagen nach sich; die Datenschutzerklärung sagt in Abschnitt 10
  bereits dasselbe.

## 8. Erwartetes Ergebnis

**Eingetragen 2026-09-14:** USK ab 0, PEGI 3, ESRB Jedes Alter, ClassInd 0,
GRAC 0, ACB Allgemein, IARC Generic 3 — ohne Inhaltsbeschreibungen, ohne
„Chats". (Die Erwartung unten traf zu, nachdem die Kommunikationsfrage auf
Nein stand, siehe §7.)

USK 0 / PEGI 3 dürfte herauskommen (kein anstößiger Inhalt), die
Zielgruppen-Einstufung bleibt davon unberührt bei 13+. Das ist kein
Widerspruch: Die Altersfreigabe bewertet den *Inhalt*, die Zielgruppe die
*Ausrichtung*.
