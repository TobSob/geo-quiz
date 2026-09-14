# Play-Store-Eintrag — GEOQUIZ ARCADE

> Alle Texte und Formular-Antworten für den Store-Eintrag, versioniert im Repo
> (Roadmap K13a). In der Play Console werden sie von hier kopiert — nicht dort
> direkt getippt, sonst existiert die einzige Fassung in einem Webformular.
> Stand: 2026-08-05 · Paket `de.tobsob.geoquizarcade`

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
- Stadt finden: Setze den Pin so nah wie möglich an die richtige Stelle
- Sehenswürdigkeit finden: Wo auf der Welt steht dieses Bauwerk?

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

245 Länder, 141 Städte, 129 Sehenswürdigkeiten mit Foto. Deutschsprachig.

Viel Erfolg — und pass auf die Uhr auf.
```

**2 458 Zeichen** von 4000. Der Rest bleibt bewusst frei: Play schneidet die
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

Aufgenommen am 2026-08-05 im AVD `geoquiz_pixel7` (Android 14) aus der
signierten Release-APK vom selben Tag — also mit Vollbild und mit dem neuen
Bestenlisten-Aufbau. Alle **1080×2400 PNG**, in `frontend/assets/store-screenshots/`.

| Datei | Motiv | Warum es im Listing steht |
|---|---|---|
| `01-menue.png` | Startmenü mit Geo Cup obenauf | Erster Eindruck: 8-Bit-Look, „60 Sekunden"-Versprechen steht im Bild |
| `02-flaggen-streak.png` | Flaggen-Frage, Streak „⚡ 2 · 120%", Score 210, Restzeit orange | Zeigt das Spielprinzip **und** das Scoring in einem Bild |
| `03-umrisse.png` | Guinea-Bissau markiert, Nachbarländer sichtbar | Der Modus, der am wenigsten selbsterklärend ist |
| `04-staedte-pin.png` | Rio de Janeiro aufgelöst: „STARK! 150 km daneben +50" | Distanzstufen, Ziel-Marker und Verbindungslinie |
| `05-geo-cup.png` | Cup-Intro mit der Reihenfolge aller 6 Disziplinen | Erklärt den Hauptmodus ohne Text im Listing |
| `06-training.png` | Trainings-Setup: Kategorien + Länge | Beleg für „auch ohne Zeitdruck spielbar" |
| `07-landmark-pin.png` | Alhambra aufgelöst: „VOLLTREFFER! 27 km daneben +100" | Die Belohnungsseite derselben Mechanik |

⚠️ **`07-landmark-pin.png` ist nachzuschießen.** Das Vorschaubild oben rechts
zeigt noch den Alhambra-**Grundriss**, der am selben Tag durch ein Foto ersetzt
wurde (siehe [DESIGN-PLAYSTORE.md](../DESIGN-PLAYSTORE.md#nachtrag-2026-08-05-alhambra-war-ein-grundriss)).
Entweder mit der nächsten APK neu aufnehmen — sinnvollerweise zusammen mit den
beiden angemeldeten Motiven unten — oder aus dem Listing weglassen; die
übrigen sechs tragen es allein.

Play nennt in seinen Vorgaben 16:9 bzw. 9:16; 1080×2400 ist das native
Seitenverhältnis heutiger Telefone (20:9) und wird üblicherweise angenommen.
Sollte die Console es zurückweisen, auf **1080×1920** beschneiden — nicht
skalieren, sonst verwischen die Pixel-Fonts.

### Zwei Motive fehlen noch — sie brauchen einen angemeldeten Account

Aus der Motivliste der Roadmap fehlen **globale Bestenliste** und
**Pokalregal**. Beide sind für Gäste serverseitig gesperrt (der Erfolge-Screen
zeigt als Gast ein Schloss, die Bestenliste startet auf „Meine Rekorde" mit den
lokalen Werten des Emulators). Ein Konto anzulegen ist nichts, was hier
nebenbei passieren sollte — die Anmeldung im Emulator muss der Mensch selbst
vornehmen, danach lassen sich beide Bilder in zwei Minuten nachziehen:

```bash
adb -s emulator-5554 shell screencap -p /sdcard/s.png && adb -s emulator-5554 pull /sdcard/s.png frontend/assets/store-screenshots/08-bestenliste.png
```

Sieben Screenshots erfüllen die Play-Vorgabe (min. 2, max. 8) bereits
vollständig; die beiden fehlenden sind Kür, keine Pflicht.

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
| App-Aktivität | Spielinteraktionen (Punkte, Runden, Lernfortschritt) | ja | nein | Pflicht | Spielfunktionen |

Nicht erhoben und entsprechend zu verneinen: Standort, Kontakte, Fotos/Videos,
Audio, Kalender, SMS, Gesundheit, Finanzdaten, Geräte-IDs für Werbung,
Absturz-/Diagnosedaten, Werbe- oder Marketingdaten.

Begründung für „Avatar" und „Abzeichen": fallen unter App-Aktivität
(Spielinteraktionen), keine eigene Kategorie nötig.

## 7. Altersfreigabe (IARC) + Zielgruppe (K12)

- Gewalt, Sexualität, Schimpfwörter, Drogen, Glücksspiel, Angst: **jeweils nein**
- **Nutzergenerierte Inhalte: ja** — der Spielername ist frei wählbar und für
  andere sichtbar (Bestenliste, Spielerkarte). Verschweigen wäre der klassische
  Grund für eine nachträgliche Neubewertung.
- Standortweitergabe an andere Nutzer: nein
- Käufe: nein · Werbung: nein
- **Zielgruppe: 13+ / „nicht primär an Kinder gerichtet"**. Mit Konten, frei
  wählbaren Namen und globaler Bestenliste zöge die Families-Policy deutlich
  strengere Auflagen nach sich; die Datenschutzerklärung sagt in Abschnitt 10
  bereits dasselbe.

## 8. Erwartetes Ergebnis

USK 0 / PEGI 3 dürfte herauskommen (kein anstößiger Inhalt), die
Zielgruppen-Einstufung bleibt davon unberührt bei 13+. Das ist kein
Widerspruch: Die Altersfreigabe bewertet den *Inhalt*, die Zielgruppe die
*Ausrichtung*.
