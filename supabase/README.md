# geo-quiz Supabase Backend

Projekt: `dpueqnhhwcdbhihiudyg` → https://supabase.com/dashboard/project/dpueqnhhwcdbhihiudyg

Das gesamte "Backend" besteht aus SQL — es gibt keinen eigenen Server-Code.

## Migrations anwenden

**Variante A — SQL-Editor (einfachste):**
Inhalt von [`apply_all.sql`](apply_all.sql) im Dashboard unter *SQL Editor → New query* einfügen und ausführen.

**Variante B — Supabase CLI:**
```powershell
npx supabase login
npx supabase link --project-ref dpueqnhhwcdbhihiudyg
npx supabase db push
```

## Zusätzlich im Dashboard aktivieren

*Authentication → Sign In / Up → Anonymous sign-ins* → **einschalten**
(sonst schlägt `signInAnonymously()` fehl und das Spiel bleibt im Offline-Modus).

## Struktur

| Migration | Inhalt |
|---|---|
| `0001_init.sql` | Tabellen `profiles`, `user_progress`, `score_entries`, `cup_runs` + RLS-Policies + Plausibilitäts-Trigger (min. 400 ms/Frage, Score-Obergrenzen) |
| `0002_increment_progress.sql` | `increment_progress()`-RPC (atomarer Delta-Merge, `SECURITY DEFINER`) + Batch-Variante `sync_progress(jsonb)` |
| `0003_leaderboard_views.sql` | Öffentliche Views `leaderboard_scores` / `leaderboard_cups` (nur `display_name` + Score, nie `user_id`) |
| `0004_gate_leaderboards.sql` | Leaderboards nur für registrierte Accounts (`is_registered_user()`-Gate in Views + Insert-Policies) |
| `0005_arcade_scoring.sql` | **Arcade-Umbau (Phase E):** Rohpunkte statt Prozent (Checks/Trigger neu), Views ersetzt durch RPCs `get_leaderboard_scores(mode, since, limit)` / `get_leaderboard_cups(since, limit)` — Bestleistung pro Spieler + Zeitfilter. Löscht Alt-Einträge |
| `0006_friend_groups.sql` | **Freundesgruppen (Phase F):** `friend_groups` + `friend_group_members` + Join-Rate-Limit, RPCs `create_group`/`join_group`/`leave_group`/`delete_group`/`list_my_groups`, Leaderboard-RPCs um `p_group`-Filter erweitert (neue Signatur) |
| `0007_session_guard.sql` | **Anti-Cheat D1+D2:** `play_sessions`-Wanduhrkonto, Abgabe nur noch per RPC `submit_score`/`submit_cup_run` (behauptete Spielzeit muss real vergangen sein), `start_session()`-Rundenstart, Rate-Limits (30 Scores/h, 6 Cups/h), direkte Insert-Policies entfernt |
| `0008_gamification.sql` | **Gamification (Phase G):** `player_stats` (XP + Badge-Metriken), `badge_definitions` (Seed) + `player_badges`, `cup_trophies` (Hall of Fame, lazy finalisiert via `finalize_cup_trophies()` — kein pg_cron), `submit_score`/`submit_cup_run` neu (jsonb-Unlock-Payload, 3 neue defaultete Parameter), `get_gamification`/`get_cup_trophies`/`get_leaderboard_levels`, Backfill inkl. rückwirkender Pokale. **Backfill nie doppelt ausführen (XP!)** |
| `0009_trophy_top3.sql` | **Pokale Top 3 (Phase G):** `cup_trophies.rank` (1–3, unique je Periode+Rang und Periode+Spieler), `finalize_cup_trophies()` vergibt die drei besten Cup-Spieler je Periode mit XP-Staffel (Woche 200/100/50, Monat 500/250/125, Jahr 1500/750/375), `get_cup_trophies`/`get_gamification` liefern den Rang mit; Nachvergabe fehlender Plätze 2/3 |
| `0010_profile_avatars.sql` | **Avatare (Phase H):** `profiles.avatar_id` + Nur-Lese-RPC `get_profile_avatars(names[])` (Name→Avatar, nie user_id) — damit die Bestenliste die Pixel-Avatare aller Spieler zeigt. Additiv, gefahrlos wiederholbar (`if not exists` / `create or replace`); Regelwerk: [DESIGN-AVATARS.md](../DESIGN-AVATARS.md) |
| `0011_cup_leg_breakdown.sql` | **Cup-Punkte je Disziplin (Nutzer-Wunsch, Phase H-Folge):** `get_leaderboard_cups` liefert zusätzlich `cup_run_id`; neue Nur-Lese-RPC `get_cup_run_legs(cup_run_id)` liest die sechs Leg-Scores aus `score_entries` — für jeden Cup-Lauf, nicht nur den eigenen (Score+Name sind über die Bestenliste ohnehin schon öffentlich). Klick auf den Score in der globalen Cup-Bestenliste klappt die Aufschlüsselung auf |
| `0012_player_card.sql` | **Fremde Spielerkarten (Bug-Fix, Phase H-Folge):** neue Nur-Lese-RPC `get_player_card(display_name)` — XP, Abzeichen (höchste Stufe je ID), Bestpunkte je Modus und Cup-Bestwert für JEDEN registrierten Account (name-basiert wie `get_profile_avatars`, nie user_id). Behebt den Bug, dass ein Klick auf eine fremde Bestenlisten-Zeile immer die eigene Karte zeigte |
| `0013_cup_leg_order.sql` | **Bug-Fix:** `get_cup_run_legs` (0011) sortierte nach `s.id` — da `submitCupRun` alle 6 Leg-Scores parallel abschickt, war das Zufall statt Spielreihenfolge. Sortiert jetzt fest nach der echten Cup-Reihenfolge (Flaggen→Hauptstädte→Länder→Umrisse→Städte-Pin→Landmark-Pin) |
| `0014_profile_featured_items.sql` | **Pokalregal (Phase I):** `profile_featured_items` (6 Slots je Spieler, Abzeichen & Pokale gemischt), Schreibzugriff nur über `set_featured_items(jsonb)` mit Ownership-Check; `get_gamification` (liefert jetzt auch `trophy_id` + `featured`) und `get_player_card` (liefert `featured`) neu erstellt — das kuratierte Regal erscheint auf der öffentlichen Spielerkarte |

> Live-DB-Stand: **0001–0012 eingespielt** (0001–0009 verifiziert 2026-07-14, 0010–0012 vom Nutzer 2026-07-16) — **0013 + 0014 stehen noch aus**: einfach [`apply_pending.sql`](apply_pending.sql) im SQL-Editor ausführen (enthält beide), danach die Datei löschen und diesen Hinweis aktualisieren. Bis dahin: Disziplin-Reihenfolge im Cup-Aufklapp bleibt zufällig, das Pokalregal lässt sich nicht speichern (Anzeige fällt graceful auf die Top-Abzeichen zurück). `apply_all.sql` dient der Vollinstallation frischer Projekte — auf der bestehenden Live-DB nichts erneut ausführen (0005 löscht Scores, der 0008-Backfill würde XP doppeln!).

## Sicherheitsmodell

- RLS auf allen Tabellen: Nutzer sehen/schreiben nur eigene Zeilen (`auth.uid() = user_id`).
- Progress-Schreibzugriff **nur** über die RPCs (keine Insert/Update-Policies auf `user_progress`).
- Leaderboard-Views laufen mit Owner-Rechten (`security_invoker = off`) und exponieren bewusst nur Name + Score.
- Der `anon`-Key im Client ist erwartungsgemäß öffentlich — der Schutz kommt aus RLS, nicht aus Key-Geheimhaltung.
