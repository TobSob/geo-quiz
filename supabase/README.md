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

## Sicherheitsmodell

- RLS auf allen Tabellen: Nutzer sehen/schreiben nur eigene Zeilen (`auth.uid() = user_id`).
- Progress-Schreibzugriff **nur** über die RPCs (keine Insert/Update-Policies auf `user_progress`).
- Leaderboard-Views laufen mit Owner-Rechten (`security_invoker = off`) und exponieren bewusst nur Name + Score.
- Der `anon`-Key im Client ist erwartungsgemäß öffentlich — der Schutz kommt aus RLS, nicht aus Key-Geheimhaltung.
