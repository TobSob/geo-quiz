# DESIGN-MODERATION — Spielernamen melden, filtern, entfernen

> Stand: 2026-10-03 · Migration `0018_name_moderation.sql` · Status: **live** (0018 eingespielt,
> Web + Build 15 ausgeliefert, Live-Prüfung 2026-10-05)

## Problem

Spielernamen sind frei wählbar (2–24 Zeichen, sonst keine Regel) und stehen
öffentlich in den Bestenlisten und auf der Spielerkarte. Damit fällt die App
unter die Play-Richtlinie **„Von Nutzern erstellte Inhalte" (UGC)**;
STORE-LISTING §7 beantwortet die UGC-Frage deshalb mit Ja. Die Richtlinie
verlangt für UGC-Apps im Kern drei Dinge:

1. Regeln, was nicht erlaubt ist, für Nutzer sichtbar.
2. Eine Möglichkeit **in der App**, anstößige Inhalte zu melden.
3. Dass der Betreiber gemeldete Inhalte entfernen kann — und es tut.

Vorhanden war davon nichts außer der Längenprüfung aus 0001.

Freundesgruppen-Namen sind ebenfalls frei wählbar, aber nur für Mitglieder
sichtbar, die per Code beigetreten sind. Sie bekommen den Filter mit (kostet
eine Zeile), aber keinen eigenen Melden-Weg.

## Entscheidungen

### 1. Wortfilter in der Datenbank, nicht im Client

Ein Trigger auf `profiles.display_name` und `friend_groups.name` prüft jeden
neuen Namen gegen die Tabelle `blocked_name_terms`. **Eine** Quelle der
Wahrheit: der Client kennt die Liste nicht und meldet nur zurück, was der
Server sagt (`name_not_allowed`). Eine Kopie im Client würde mit der ersten
Ergänzung im Dashboard auseinanderlaufen, und der Client ist ohnehin umgehbar
(Anon-Key ist öffentlich).

Die Liste ist eine **Tabelle**, keine Konstante im Funktionsrumpf: neue Begriffe
lassen sich im SQL-Editor ergänzen, ohne Migration und ohne Release.

**Normalisierung** vor dem Vergleich: Kleinbuchstaben → Umlaute ausschreiben
(ä→ae, ß→ss) → Leetspeak zurück (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s) →
alles außer a–z entfernen. Damit fallen `F_U_C_K`, `FU¢K` (nicht ganz) und
`H1TL3R` auf. Gespeichert werden die Begriffe bereits normalisiert.

**Bewusst nicht** gebaut:

- *Wiederholte Buchstaben zusammenziehen* (`fuuuck` → `fuck`): Dann wird aus
  `nigger` → `niger` — und `NIGERIA` wäre gesperrt.
- *Kurze, doppeldeutige Begriffe* (`anal` steckt in `KANAL`, `rape` in
  `THERAPEUT`, `cum` in `CUMULUS`, `pedo` in `TORPEDO`, `heil`, `88`, `ss`).
  Lieber ein Begriff zu wenig als Spieler, die ihren harmlosen Namen nicht
  speichern können und nicht verstehen, warum. Was durchrutscht, fängt das
  Melden.

Der Filter ist ein Netz für das Offensichtliche, kein Schutzwall. Wer
Absicht hat, kommt durch — genau dafür gibt es Punkt 2 und 3.

Bestehende Namen prüft der Trigger nicht (er feuert nur bei Änderung). Die
Migration bringt dafür eine Abfrage im Kommentar mit, die alle aktuell
verstoßenden Namen auflistet.

### 2. Melden auf der fremden Spielerkarte

Wer in der Bestenliste auf einen Namen tippt, sieht die Spielerkarte. Dort
steht unten ein unauffälliger Knopf **„Namen melden"** → vier Gründe
(Beleidigend · Sexuell/anstößig · Extremistisch · Sonstiges) → Senden →
„Danke, wird geprüft".

RPC `report_display_name(p_display_name, p_reason)`:

- nur für registrierte Konten (die einzigen, die globale Bestenlisten und
  fremde Karten überhaupt sehen — 0004/0012),
- löst den Namen wie `get_player_card` auf (`last_seen_at desc limit 1`,
  Namen sind nicht eindeutig) und speichert **Kennung + Namen zum
  Meldezeitpunkt** — sonst wäre nach einer Umbenennung nicht mehr
  nachvollziehbar, worum es ging,
- eigenen Namen melden geht nicht, doppelte Meldung (gleicher Melder, gleiches
  Ziel, gleicher Name) wird still geschluckt,
- **20 Meldungen je Melder in 24 h**, damit niemand die Tabelle flutet.

Rückgabe ist ein Status-Text (`ok`, `duplicate`, `self`, `not_found`,
`rate_limited`) statt einer Exception — der Client zeigt für `duplicate`
dasselbe „Danke" wie für `ok`.

Warum nicht auch Blockieren/Ausblenden einzelner Spieler: Es gibt keine
Kommunikation zwischen Spielern, nur Namen in Listen. Ein gemeldeter
anstößiger Name soll **für alle** verschwinden, nicht nur für den Melder.

### 3. Entfernen durch den Betreiber — im Supabase-Dashboard

Kein Admin-Bildschirm in der App. Für ein Ein-Personen-Projekt mit erwartbar
wenigen Meldungen ist der SQL-Editor das Admin-Werkzeug; ein In-App-Admin
bräuchte eine Rollen-Verwaltung, die wieder angreifbar wäre.

- View `name_reports_open`: offene Meldungen je gemeldetem Konto, mit
  aktuellem Namen, Anzahl, Gründen, erster/letzter Meldung.
- `admin_reset_display_name(p_user_id, p_block_term default null)`: setzt den
  Namen auf `PLAYER_XXXX` (aus der Kennung abgeleitet), löscht die Meldungen
  zu diesem Konto und nimmt optional einen Begriff in die Sperrliste auf —
  damit derselbe Name nicht fünf Minuten später wieder da ist.
- `admin_dismiss_reports(p_user_id)`: Meldungen ohne Folgen verwerfen.

Beide Funktionen sind für `anon` **und** `authenticated` gesperrt; nur der
Datenbank-Besitzer (SQL-Editor) bzw. `service_role` darf sie aufrufen. Die
View ebenso.

**Bearbeitete Meldungen werden gelöscht, nicht als erledigt markiert.** Eine
Historie bräuchte eine Speicherdauer in der Datenschutzerklärung und einen
Aufräumjob (es gibt kein pg_cron). Ohne Historie gilt: Meldungen liegen bis
zur Bearbeitung, und beide Fremdschlüssel hängen per `on delete cascade` an
`auth.users` — die Konto-Löschung (0017) bleibt eine einzige Anweisung.

Benachrichtigung bei neuen Meldungen gibt es nicht. Der Betreiber schaut in
`name_reports_open`, z. B. wöchentlich und vor jedem Release.

### 4. Regeln sichtbar machen

Unter dem Namensfeld im Profil eine Zeile: *keine Beleidigungen, kein Hass,
nichts Sexuelles oder Extremistisches — gemeldete Namen werden
zurückgesetzt.* Die Datenschutzerklärung bekommt eine Zeile für Meldungen
(wer meldet, wen, Grund, Zeitpunkt; Art. 6 Abs. 1 lit. f).

## Was der Mensch tun muss

1. `supabase/migrations/0018_name_moderation.sql` im SQL-Editor ausführen
   (vor dem nächsten `npm run release`, siehe DEVELOPMENT.md §5).
2. Die Prüfabfrage am Ende der Migration laufen lassen und Treffer mit
   `admin_reset_display_name` bereinigen.
3. Danach `npm run release` (Datenschutzerklärung + App-Code).

## Umsetzungs-Log

| Datum | Schritt |
|---|---|
| 2026-10-03 | Design, Migration 0018, Melden-Knopf, Fehlermeldung beim Umbenennen, Datenschutzerklärung |
| 2026-10-03 | Lokal in PGlite geprüft (0001–0018 am Stück, 0018 doppelt, 22 Einzelprüfungen inkl. Rolle `authenticated`). **Fund:** die Trigger-Funktion las Spieler- und Gruppennamen per `case tg_table_name when … then new.display_name else new.name end` — PL/pgSQL löst beide Feldzugriffe auf, auf `profiles` gibt es kein `name`, also wäre **jede Profil-Anlage gescheitert** (auch die automatische beim ersten Start). Jetzt Spaltenname als Trigger-Argument, gelesen über `to_jsonb(new) ->> tg_argv[0]`. Filter-Nachbau in Node: 0 Treffer bei 12.960 Zufallsnamen und ~4.700 Geo-Namen |
| 2026-10-05 | Live: 0018 (korrigierte Fassung) eingespielt, Web + Build 15 released. Gegen die echte DB mit Wegwerf-Gastkonto geprüft, 8/8 (Filter, Gast-Sperre beim Melden, Admin-Sperre, RLS, Aufräumen) |
