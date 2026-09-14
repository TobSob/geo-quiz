# DESIGN — Projekt-Wiki für Agenten

**Status:** umgesetzt · 2026-08-30
**Auslöser:** Nutzer-Frage „Kannst du die Sachen, die wir besprechen und die du
im Code findest, in einem LLM-Wiki speichern?"

## Das Problem: 365 KB Prosa ohne Einstiegspunkt

Das Repo dokumentiert vorbildlich — 15 `DESIGN-*.md`, eine 24 KB
Developer-Doku, eine 84 KB ROADMAP. Was fehlte, war **kein Inhalt, sondern
eine Ebene**:

- Es gab **kein `CLAUDE.md`**. Jede Sitzung begann damit, sich aus mehreren
  Dateien zusammenzusuchen, wo überhaupt was steht.
- Die vorhandenen Dokumente sind **Entscheidungsprotokolle** („warum haben wir
  das so gebaut"). Sie beantworten schlecht, **was gerade wahr ist** — dafür
  müsste man die Historie rückwärts lesen und hoffen, den letzten Nachtrag
  erwischt zu haben.

Der Beleg fiel im selben Gespräch an: Um „was fehlt noch zur
Veröffentlichung?" zu beantworten, mussten vier Dateien gelesen und
quergeprüft werden — und dabei kamen fünf veraltete Angaben heraus
(OAuth-Status, Städtezahl, Avatarzahl und Testzahl in STATUS.md, react-leaflet als vermeintlich aktuelle Abhängigkeit in DESIGN-PLAYSTORE §7).

Ein zweiter Befund kam aus den Session-Transkripten: Die Abwägung
**Gmail-SMTP gegen Brevo gegen eigene Domain** war am 2026-08-06 vollständig
erarbeitet worden — und ist nie in einem Dokument gelandet. Sie existierte nur
im Transkript und wurde am 2026-08-30 neu hergeleitet. Genau diese Sorte
Verlust soll das Wiki verhindern.

## Die Entscheidung: Zustandsebene, nicht dritte Kopie

Der naheliegende Fehler wäre ein Wiki gewesen, das Architektur, Engine und
Backend noch einmal erklärt — `docs/DEVELOPMENT.md` tut das bereits gut. Zwei
Quellen für dieselbe Wahrheit driften auseinander; die drei DESIGN-Nachträge
zur Basemap an einem einzigen Tag zeigen, wie schnell das geht.

Deshalb die Arbeitsteilung:

| Ebene | Beantwortet | Wer pflegt sie |
|---|---|---|
| `CLAUDE.md` | Wo schaue ich nach? Was sind die harten Regeln? | selten, bei Strukturwechseln |
| `docs/wiki/` | **Was ist gerade wahr?** | bei jeder Änderung am beschriebenen Ding |
| `DESIGN-*.md` | Warum ist es so? | einmal je Umsetzung, danach Nachträge |
| ROADMAP/STATUS | Was ist abgehakt, was kommt? | bei Meilensteinen |

Die Wiki-Seiten sind kurz (30–110 Zeilen), thematisch atomar und verlinken für
die Herleitung nach unten. Sie erzählen nichts nach, was ein DESIGN-Dokument
schon begründet.

## Zwei Konventionen, die den Unterschied machen

**1. Prüfdatum und Prüfweg an jeder Seite.** Jede Seite trägt „Stand" und
„Verifiziert: <womit>". Zahlen stehen nur mit dem Kommando daneben, das sie
erzeugt hat — `wc -l`, ein `grep`, ein `curl`. Damit ist Nachprüfen billiger
als Glauben, und eine alte Zahl outet sich selbst als alt. Das ist der
eigentliche Unterschied zu den bestehenden Docs, in denen „141 Städte" seit
Wochen unwidersprochen stand.

**2. `offene-punkte.md` hat Vorrang.** Bei Widerspruch zu Status-Spalten in
ROADMAP oder STATUS gilt die Wiki-Seite, weil sie mit Prüfdatum kommt. Die
gefundenen Abweichungen stehen dort zusätzlich als Tabelle — nicht um die
alten Dokumente zu korrigieren und zu verstecken, sondern damit sichtbar
bleibt, dass sie driften können.

## Bewusst NICHT gemacht

- **Kein Auto-Generator** aus dem Quellcode. Was ein Skript aus `grep`
  erzeugen kann, muss nicht im Repo liegen; wertvoll sind gerade die Sätze,
  die kein Skript schreibt („`LngLatBounds` normalisiert nicht").
- **Keine Migration der DESIGN-Dokumente.** Sie sind gut, sie bleiben, sie
  werden nur verlinkt.
- **Kein Wiki-Ordner pro Feature.** 13 Seiten sind überschaubar; eine
  Ordnerhierarchie hätte mehr Navigation als Inhalt erzeugt.
- **Keine Secrets, keine Anschrift.** Das Wiki verweist auf Impressum und
  Dashboard, statt Werte zu duplizieren.

## Verifikation

- Alle Zahlen im Wiki stammen aus einem Kommando dieser Sitzung, nicht aus den
  vorhandenen Docs: `npm run test` (148/148), `node -e` über die Datendateien
  (245/143/129/129), `grep -c` über die Kataloge (17 Abzeichen, 22 Avatare),
  `curl` gegen die drei Rechtsseiten (3× 200) und gegen
  `/auth/v1/settings` (OAuth-Status, `mailer_autoconfirm`).
- Die als „ungeprüft" markierten Punkte (Site-URL, Migrationen 0013/0014) sind
  genau die, für die in dieser Sitzung kein Zugang bestand — sie stehen als
  Lücke da statt als Vermutung.
