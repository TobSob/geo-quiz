# 👥 Design-Notizen — Bestenlisten-Filter & Freundesgruppen

> Arbeitsdokument, Stil wie [DESIGN-ARCADE.md](DESIGN-ARCADE.md). Wird während der
> Design-Diskussion fortgeschrieben; wenn alles ✅ ist, wandert der Umbau als
> Phase in die [ROADMAP.md](ROADMAP.md).

Legende: ✅ entschieden · 💬 in Diskussion · ⬜ noch nicht besprochen

---

## Teil 1: Kategorie-Auswahl in der Bestenliste (steht fest)

Der Global-Tab zeigt bisher alle Modi gemischt — nicht hilfreich, und nach dem
Arcade-Umbau (Rohpunkte statt Prozent) sogar irreführend, weil Modi
unterschiedlich viele Punkte/Minute hergeben.

| Regel | Wert | Status |
|---|---|---|
| Global-Tab bekommt eine Modus-Auswahl (6 Einzelmodi) | Pflichtteil von Phase E (UI); API kann es schon (`fetchLeaderboardScores(mode)`) | ✅ |
| Cup bleibt eigener Tab | wie bisher | ✅ |
| Keine gemischte „alle Punkte"-Ansicht mehr | ersatzlos | ✅ |
| **Zeitfilter: Woche / Monat / Jahr / Alle** (Nutzer-Wunsch 2026-07-12) | Rollierende Fenster (7/30/365 Tage). Umsetzung: Leaderboards als parametrisierbare RPCs statt starrer Views (`get_leaderboard_scores(mode, since, limit)`) — nimmt Phase F den Gruppenfilter gleich mit ab | ✅ |

---

## Teil 2: Freundesgruppen

### Grundkonzept (steht fest)

**Gruppen statt 1:1-Freundescodes** — eine Zweiergruppe deckt den Freundes-Fall ab,
ein System statt zwei. Gruppe erstellen → retro-lesbaren Beitrittscode teilen
(z. B. `TURBO-YETI-83`) → Mitglieder sehen einander in einer gefilterten Bestenliste.

| Baustein | Entwurf | Status |
|---|---|---|
| Datenmodell | `friend_groups` (Name, Code, Ersteller) + `friend_group_members` | ✅ |
| Beitritt/Erstellung | RPC-Funktionen (security definer): Code wird serverseitig generiert, Beitritt nur mit exaktem Code — kein Durchprobieren/Auslesen möglich | ✅ |
| Bestenlisten-UI | Umschalter „🌍 Global / 👥 Gruppe" im Global- und Cup-Tab | ✅ |
| Profil-UI | Abschnitt „Freundesgruppen": erstellen (Code anzeigen/teilen), per Code beitreten, Liste, verlassen | ✅ |
| Nur registrierte Accounts | konsistent mit Leaderboard-Gating (0004); anonyme Mitglieder würden nach Geräte-Reset verwaisen | ✅ |
| Missbrauchs-Limits | max. Mitglieder/Gruppe, max. Gruppen/Spieler, Beitrittsversuche gedrosselt (konkrete Zahlen bei Umsetzung) | ✅ |

### Entschiedene Punkte

*Alle Punkte geklärt (2026-07-12) — Freundesgruppen sind als Phase F in der [ROADMAP.md](ROADMAP.md) eingeplant, der Bestenlisten-Teil (Modus-Filter + Bestleistung pro Spieler) steckt in Phase E5.*

| # | Punkt | Optionen / Empfehlung | Status |
|---|---|---|---|
| S1 | **Was zeigen die Bestenlisten?** → **Entschieden: Bestleistung pro Spieler — überall, nicht nur in Gruppen.** Nutzer-Entscheid: auch global soll niemand „20-mal auf Platz 1" stehen. Jeder Spieler erscheint pro Modus (bzw. im Cup) genau einmal mit seiner Bestmarke. Technischer Bonus: Global- und Gruppen-Ansicht sind dieselbe Abfrage, nur mit/ohne Gruppenfilter. | Ein Eintrag je Spieler & Modus (Views: beste Runde je user_id). | ✅ |
| S2 | **Gruppen-Verwaltung** → **Entschieden: minimal.** Ersteller kann Gruppe löschen, jedes Mitglied kann selbst austreten. Kein Kicken/Umbenennen/Adminwechsel in V1 — Notausgang bei Code-Leak/Troll: Gruppe löschen & neu erstellen. | Löschen (Ersteller) + Austreten (jeder), mehr nicht. | ✅ |
| S3 | **Einordnung in die Roadmap** → **Entschieden: eigene Phase F, nach E und vor D.** Reihenfolge damit: E (Arcade) → F (Gruppen) → D (Anti-Cheat). Begründung: Gruppen machen das Spiel für die ersten Tester attraktiv; Anti-Cheat wird mit wachsender Fremd-Spielerschaft wichtig, D1 bleibt als SQL-Schnellschuss jederzeit vorziehbar. | Phase F zwischen E und D. | ✅ |

---

## Umsetzungs-Log Phase F

### F1–F5 ✅ (Code) — 2026-07-12

**Migration `supabase/migrations/0006_friend_groups.sql`** (in `apply_all.sql`
angehängt; für die Live-DB zusammen mit 0005 in `supabase/apply_pending.sql`):

- Tabellen `friend_groups` (Name 2–24 Zeichen, Code unique, `created_by`) und
  `friend_group_members` (PK group+user, cascade). `group_join_attempts` fürs
  Rate-Limit.
- **RLS-Falle gelöst:** Eine Membership-Policy auf `friend_group_members`, die
  die eigene Tabelle abfragt, rekurriert endlos → security-definer-Helper
  `is_group_member(bigint)`, den Policies UND Leaderboard-RPCs nutzen.
- Nur Select-Policies; alle Mutationen laufen über security-definer-RPCs:
  `create_group` (Code serverseitig via `generate_group_code()`, Format
  `WORT-TIER-9999`, ~1,4 Mio. Kombinationen), `join_group` (Rate-Limit 20/h,
  exakter Code-Match, upper/trim-tolerant), `leave_group`, `delete_group`
  (nur Ersteller), `list_my_groups` (mit member_count + is_owner).
- Limits: 50 Mitglieder/Gruppe, 12 Gruppen/Spieler.
- Leaderboard-RPCs: neuer Parameter `p_group` (Signaturwechsel → alte
  Funktionen gedroppt und neu erstellt). Nicht-Mitglieder einer Gruppe
  bekommen eine leere Liste, nie einen Fehler mit Informationsgehalt.

**Frontend:** `api/groupApi.ts` (RPC-Wrapper, deutsche Fehlertexte analog
authApi), `ProfileScreen` → `GroupsPanel` (nur registriert: erstellen,
Code teilen via `navigator.share`/Clipboard-Fallback, beitreten, verlassen/
löschen mit Inline-Rückfrage), `ScoresScreen` → `ScopePicker` („🌍 Global /
👥 Gruppe", erscheint erst wenn Gruppen existieren) in Global- und Cups-Tab,
`leaderboardApi` reicht `groupId` durch.

**Verifiziert:** Tests 75/75, tsc + oxlint sauber; Profil ohne Account zeigt
das Panel korrekt nicht, Konsole leer. **Offen (F6):** Live-Test braucht die
angewendeten Migrationen (`apply_pending.sql`) + zwei registrierte Accounts —
zusammen mit dem E6-Gerätetest erledigen.

---

## Verlauf

| Datum | Eintrag |
|---|---|
| 2026-07-12 | F1–F5 umgesetzt (Code komplett, siehe Umsetzungs-Log). Zeitfilter-Wunsch (Woche/Monat/Jahr/Alle) kam während E5 dazu und wurde dort als RPC-Parameter umgesetzt |
| 2026-07-12 | S1–S3 im Chat entschieden: Bestleistung pro Spieler überall (auch global — „nicht 20-mal Nummer eins"), Verwaltung minimal (löschen + austreten), Phase F zwischen E und D. In Roadmap überführt |
| 2026-07-12 | Dokument angelegt. Machbarkeit geprüft: Modus-Filter existiert bereits in der API (nur UI fehlt → Pflichtteil Phase E); Gruppen statt 1:1-Codes entschieden (Zweiergruppe = Freundschaft, ein System statt zwei) |
