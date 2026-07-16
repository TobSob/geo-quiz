-- Cup-Bestenliste: Punkte je Disziplin (Nutzer-Wunsch 2026-07-16). Die
-- Einzel-Leg-Scores liegen bereits in score_entries (verknüpft über
-- cup_run_id, geschrieben von submit_score/submit_cup_run) — bisher aber
-- nur per RLS für den eigenen User lesbar. Zwei Ergänzungen:
--
-- 1) get_leaderboard_cups liefert zusätzlich die cup_run_id mit (Zeilen sind
--    seit Migration 0005 nach Bestleistung/Spieler dedupliziert, also genau
--    ein Lauf pro Zeile — die id identifiziert ihn eindeutig).
-- 2) get_cup_run_legs(cup_run_id) liest die sechs Leg-Scores nach, für jeden
--    Cup-Lauf — nicht nur den eigenen, analog zu den bestehenden Leaderboard-
--    RPCs, die Score+Name aller registrierten Spieler ohnehin schon zeigen.

drop function if exists public.get_leaderboard_cups(timestamptz, integer, bigint);

create function public.get_leaderboard_cups(
  p_since timestamptz default null,
  p_limit integer default 25,
  p_group bigint default null
)
returns table (
  cup_run_id bigint,
  display_name text,
  total_score integer,
  modes_played jsonb,
  played_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select best.id, best.display_name, best.total_score, best.modes_played, best.played_at
  from (
    select distinct on (c.user_id)
      c.id, p.display_name, c.total_score, c.modes_played, c.played_at
    from public.cup_runs c
    join public.profiles p on p.id = c.user_id
    where public.is_registered_user()
      and (p_since is null or c.played_at >= p_since)
      and (
        p_group is null
        or (
          public.is_group_member(p_group)
          and c.user_id in (
            select gm.user_id from public.friend_group_members gm
            where gm.group_id = p_group
          )
        )
      )
    order by c.user_id, c.total_score desc, c.played_at asc
  ) best
  order by best.total_score desc, best.played_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Punkte je Disziplin eines einzelnen Cup-Laufs (Klick auf den Score in der
-- Bestenliste). Bewusst ohne Eigentümer-Check: Score + Name des Laufs sind
-- über get_leaderboard_cups ohnehin schon für alle registrierten Spieler
-- sichtbar, die Aufschlüsselung ist keine zusätzliche Preisgabe.
create or replace function public.get_cup_run_legs(p_cup_run_id bigint)
returns table (
  mode text,
  score integer,
  question_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select s.mode, s.score, s.question_count
  from public.score_entries s
  where public.is_registered_user()
    and s.cup_run_id = p_cup_run_id
  order by s.id;
$$;

-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.get_leaderboard_cups(timestamptz, integer, bigint) from public, anon;
revoke execute on function public.get_cup_run_legs(bigint) from public, anon;

grant execute on function public.get_leaderboard_cups(timestamptz, integer, bigint) to authenticated;
grant execute on function public.get_cup_run_legs(bigint) to authenticated;
