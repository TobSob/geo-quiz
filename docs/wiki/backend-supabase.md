# Backend (Supabase)

> **Stand:** 2026-08-30 · **Verifiziert:** `supabase/migrations/*.sql`, Live-Abfrage `/auth/v1/settings`

Projekt `dpueqnhhwcdbhihiudyg`, Region eu-north-1.

## Migrationen

**0001 – 0017**, alle im Repo unter `supabase/migrations/`. Live eingespielt
bis einschließlich **0017** (Konto-Löschung, bestätigt 2026-08-04).

> Offen laut STATUS.md: 0013 (Cup-Leg-Reihenfolge) und 0014 auf der Live-DB.
> **Ungeprüft** — beim nächsten Dashboard-Zugriff gegenprüfen und hier
> festhalten. Siehe [offene-punkte.md](offene-punkte.md).

## Tabellen

`profiles` · `player_stats` · `play_sessions` · `user_progress` ·
`score_entries` · `cup_runs` · `cup_trophies` · `player_badges` ·
`badge_definitions` · `friend_groups` · `friend_group_members` ·
`group_join_attempts` · `profile_featured_items`

**Jede** Nutzertabelle hängt per `on delete cascade` an `auth.users`. Das ist
kein Zufall, sondern die Eigenschaft, die die Konto-Löschung zu einer einzigen
`delete`-Anweisung macht — beim Anlegen neuer Tabellen bitte beibehalten.

## RPCs (Auswahl)

`submit_score` · `submit_cup_run` · `sync_progress` · `increment_progress` ·
`get_leaderboard_scores` / `_cups` / `_levels` / `_first_played` ·
`get_gamification` · `award_badges` · `finalize_cup_trophies` ·
`get_cup_trophies` · `get_cup_run_legs` · `get_player_card` ·
`get_profile_avatars` · `set_featured_items` · `featured_items_json` ·
`create_group` / `join_group` / `leave_group` / `delete_group` /
`list_my_groups` / `is_group_member` · `start_session` ·
`validate_score_entry` · `is_registered_user` · `delete_own_account`

Views: `leaderboard_scores`, `leaderboard_cups`.

## Sicherheitsmodell in drei Sätzen

1. RLS auf allem; der Anon-Key ist öffentlich und darf nichts, was ein
   fremdes Konto beträfe.
2. Globale Bestenlisten sind für anonyme Sitzungen gesperrt (`is_anonymous`-
   Claim im JWT, Migration 0004) — Gäste spielen frei, sehen aber einen CTA.
3. `delete_own_account()` ist `security definer` und nimmt **kein Argument**,
   arbeitet also nur auf `auth.uid()`. Eine Variante mit `user_id`-Parameter
   wäre mit dem öffentlichen Anon-Key eine Fremdkonten-Löschmaschine.

Anti-Cheat Stufe 1: Session-Guard (`start_session`, `validate_score_entry`,
Migration 0007). Stufe 2 (server-autoritative Runden) ist **nicht** gebaut.

## Vertiefung

- [../../supabase/README.md](../../supabase/README.md) — Migrationen anwenden, Struktur
- [../DEVELOPMENT.md](../DEVELOPMENT.md) §5 — Schema, Sicherheitsmodell, Auth-Flows
