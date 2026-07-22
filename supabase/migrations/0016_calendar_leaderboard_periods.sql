-- Kalender-Zeiträume in der Bestenliste (Nutzer-Feedback 2026-07-22,
-- DESIGN-LEADERBOARD-PERIODS.md). Bisher filterten die Leaderboard-RPCs nur
-- über `p_since` — der Client schickte ein rollierendes Fenster („letzte 7
-- Tage"), während die Pokale nach Kalenderperioden in Europe/Berlin gewertet
-- werden. „Woche" hieß an beiden Stellen etwas anderes, und eine vergangene
-- Woche war gar nicht darstellbar.
--
-- Zwei Ergänzungen, beide rein additiv:
--
-- 1) `p_until` als weiterer, defaulteter Parameter → halboffenes Fenster
--    [p_since, p_until). Die Periodengrenzen rechnet der Client (in
--    Europe/Berlin, exakt wie `date_trunc(…) at time zone 'Europe/Berlin'` in
--    finalize_cup_trophies) und schickt zwei Zeitstempel. Weil PostgREST die
--    Funktion über die übergebenen Argumentnamen auflöst, funktioniert ein
--    bereits deployter alter Client (nur `p_since`) unverändert weiter.
--
-- 2) `get_leaderboard_first_played(mode, group)` — frühester Eintrag der Liste
--    als Untergrenze fürs ◀-Blättern in der UI.
--
-- Signaturwechsel (neuer Parameter) → alte Funktionen droppen statt overloaden,
-- sonst wären beide Fassungen gleichzeitig aufrufbar und PostgREST meldete
-- Mehrdeutigkeit.

drop function if exists public.get_leaderboard_scores(text, timestamptz, integer, bigint);
drop function if exists public.get_leaderboard_cups(timestamptz, integer, bigint);

create function public.get_leaderboard_scores(
  p_mode text,
  p_since timestamptz default null,
  p_limit integer default 25,
  p_group bigint default null,
  p_until timestamptz default null
)
returns table (
  display_name text,
  score integer,
  question_count integer,
  played_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select best.display_name, best.score, best.question_count, best.played_at
  from (
    select distinct on (s.user_id)
      p.display_name, s.score, s.question_count, s.played_at
    from public.score_entries s
    join public.profiles p on p.id = s.user_id
    where public.is_registered_user()
      and s.mode = p_mode
      and (p_since is null or s.played_at >= p_since)
      and (p_until is null or s.played_at < p_until)
      and (
        p_group is null
        or (
          public.is_group_member(p_group)
          and s.user_id in (
            select gm.user_id from public.friend_group_members gm
            where gm.group_id = p_group
          )
        )
      )
    order by s.user_id, s.score desc, s.played_at asc
  ) best
  order by best.score desc, best.played_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

create function public.get_leaderboard_cups(
  p_since timestamptz default null,
  p_limit integer default 25,
  p_group bigint default null,
  p_until timestamptz default null
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
      and (p_until is null or c.played_at < p_until)
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

-- Untergrenze fürs Blättern: ältester Eintrag der jeweiligen Liste.
-- p_mode null → Cup-Läufe, sonst score_entries dieses Modus. Gibt nur einen
-- Zeitstempel preis (kein Name, keine user_id) und respektiert denselben
-- Registrierungs- und Gruppen-Gate wie die Listen selbst.
create or replace function public.get_leaderboard_first_played(
  p_mode text default null,
  p_group bigint default null
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_registered_user() then null
    when p_group is not null and not public.is_group_member(p_group) then null
    when p_mode is null then (
      select min(c.played_at) from public.cup_runs c
      where p_group is null or c.user_id in (
        select gm.user_id from public.friend_group_members gm
        where gm.group_id = p_group
      )
    )
    else (
      select min(s.played_at) from public.score_entries s
      where s.mode = p_mode
        and (p_group is null or s.user_id in (
          select gm.user_id from public.friend_group_members gm
          where gm.group_id = p_group
        ))
    )
  end;
$$;

-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.get_leaderboard_scores(text, timestamptz, integer, bigint, timestamptz) from public, anon;
revoke execute on function public.get_leaderboard_cups(timestamptz, integer, bigint, timestamptz) from public, anon;
revoke execute on function public.get_leaderboard_first_played(text, bigint) from public, anon;

grant execute on function public.get_leaderboard_scores(text, timestamptz, integer, bigint, timestamptz) to authenticated;
grant execute on function public.get_leaderboard_cups(timestamptz, integer, bigint, timestamptz) to authenticated;
grant execute on function public.get_leaderboard_first_played(text, bigint) to authenticated;
