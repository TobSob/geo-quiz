# Backend (Supabase)

> **Stand:** 2026-10-03 · **Verifiziert:** `supabase/migrations/*.sql`, Live-Abfrage `/auth/v1/settings`, Anon-Abfrage auf `profile_featured_items` / `rpc/set_featured_items` (2026-10-03)

Projekt `dpueqnhhwcdbhihiudyg`, Region eu-north-1.

## Migrationen

**0001 – 0018**, alle im Repo unter `supabase/migrations/`. Live eingespielt
bis einschließlich **0018** (Namensmoderation, am 2026-10-05 gegen die Live-DB geprüft mit einem Wegwerf-Gastkonto: Profil anlegen `201`, Umbenennen in `H1TL3R` → `400 name_not_allowed`, erlaubter Name `200`, Melden als Gast → `registered account required`, `admin_reset_display_name` → `403`/`42501`, Sperrliste lesen → `[]` (RLS), danach `delete_own_account` `204` und `user_not_found`. 8/8).

0013/0014 sind live: vom Nutzer eingespielt am 2026-07-18 (ROADMAP I6), am
2026-10-03 gegengeprüft — `GET /rest/v1/profile_featured_items` mit Anon-Key
→ `200 []` (Tabelle da, RLS greift), `rpc/set_featured_items` → `42501`
(Funktion da, `anon` ausgesperrt; fehlte sie, käme `PGRST202`). 0013 ist ein
reines `create or replace` ohne von außen sichtbares Merkmal; es kam in
derselben `apply_pending.sql` wie 0014.

Billiger Prüfbefehl für 0018: `rpc/report_display_name` mit blankem Anon-Key
→ `42501` (Funktion da, `anon` ausgesperrt); `PGRST202` hieße „fehlt".

## Tabellen

`profiles` · `player_stats` · `play_sessions` · `user_progress` ·
`score_entries` · `cup_runs` · `cup_trophies` · `player_badges` ·
`badge_definitions` · `friend_groups` · `friend_group_members` ·
`group_join_attempts` · `profile_featured_items` · `name_reports` (0018) ·
`blocked_name_terms` (0018, ohne Nutzerbezug)

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
`validate_score_entry` · `is_registered_user` · `delete_own_account` ·
`report_display_name` (0018)

Nur im SQL-Editor (für `anon` **und** `authenticated` gesperrt):
`admin_reset_display_name(uuid, term)` · `admin_dismiss_reports(uuid)` · View
`name_reports_open`. Ablauf: [../../DESIGN-MODERATION.md](../../DESIGN-MODERATION.md) §3.

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
