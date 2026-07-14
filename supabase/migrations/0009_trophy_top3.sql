-- Pokale auf Top 3 (Phase G, Nutzer-Entscheid 2026-07-14): je abgeschlossener
-- Kalenderperiode bekommen die drei besten Cup-Spieler einen Pokal
-- (🥇/🥈/🥉), XP gestaffelt. Ein Spieler erhält höchstens einen Pokal je
-- Periode (Bestleistung pro Spieler). Bereits vergebene Platz-1-Pokale
-- bleiben unverändert; fehlende Plätze 2/3 vergangener Perioden werden bei
-- der nächsten Finalisierung nachvergeben.
--
-- XP-Staffel (Platz 1 / 2 / 3):
--   Woche 200/100/50 · Monat 500/250/125 · Jahr 1500/750/375
--
-- Setzt Migration 0008 voraus. Gefahrlos mehrfach ausführbar ist nur die
-- Funktion — der alter-table-Block läuft einmalig.

-- ---- cup_trophies: Rang-Spalte, ein Gewinner-Trio je Periode --------------------
alter table public.cup_trophies
  add column rank smallint not null default 1 check (rank between 1 and 3);

alter table public.cup_trophies
  drop constraint cup_trophies_period_type_period_start_key;

alter table public.cup_trophies
  add constraint cup_trophies_period_rank_key unique (period_type, period_start, rank);

-- Ein Spieler maximal ein Pokal je Periode
alter table public.cup_trophies
  add constraint cup_trophies_period_user_key unique (period_type, period_start, user_id);

-- ---- finalize_cup_trophies: Top 3 statt nur Platz 1 ------------------------------
-- Weiter lazy + idempotent (Advisory-Lock, Unique-Constraints, on conflict).
-- Kandidaten je Periode: beste Einzelleistung pro Spieler, sortiert nach
-- Score (Tie → früheres played_at), die ersten drei. Vergeben wird nur, was
-- fehlt: freier Rang UND Spieler noch ohne Pokal dieser Periode.
create or replace function public.finalize_cup_trophies()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  pt text;
  v_xp integer[];
  v_winners uuid[];
  u uuid;
begin
  perform pg_advisory_xact_lock(hashtext('geo_quiz_cup_trophies'));

  foreach pt in array array['week', 'month', 'year'] loop
    v_xp := case pt
      when 'week' then array[200, 100, 50]
      when 'month' then array[500, 250, 125]
      else array[1500, 750, 375]
    end;

    with won as (
      insert into public.cup_trophies
        (period_type, period_start, user_id, total_score, cup_run_id, rank)
      select pt, periods.ps, ranked.user_id, ranked.total_score, ranked.id, ranked.rnk
      from (
        -- abgeschlossene Perioden mit Cup-Runs, die noch keine 3 Pokale haben
        select distinct date_trunc(pt, c.played_at at time zone 'Europe/Berlin')::date as ps
        from public.cup_runs c
        where date_trunc(pt, c.played_at at time zone 'Europe/Berlin')::date
            < date_trunc(pt, now() at time zone 'Europe/Berlin')::date
      ) periods
      cross join lateral (
        -- Top 3: Bestleistung pro Spieler, dann Rangfolge
        select best.id, best.user_id, best.total_score,
               row_number() over (order by best.total_score desc, best.played_at asc)::smallint as rnk
        from (
          select distinct on (c.user_id) c.id, c.user_id, c.total_score, c.played_at
          from public.cup_runs c
          where date_trunc(pt, c.played_at at time zone 'Europe/Berlin')::date = periods.ps
          order by c.user_id, c.total_score desc, c.played_at asc
        ) best
        order by best.total_score desc, best.played_at asc
        limit 3
      ) ranked
      where not exists (
          select 1 from public.cup_trophies t
          where t.period_type = pt and t.period_start = periods.ps and t.rank = ranked.rnk
        )
        and not exists (
          select 1 from public.cup_trophies t
          where t.period_type = pt and t.period_start = periods.ps and t.user_id = ranked.user_id
        )
      on conflict do nothing
      returning cup_trophies.user_id, cup_trophies.rank
    ),
    agg as (
      select won.user_id,
             sum(v_xp[won.rank])::bigint as xp_sum,
             count(*)::integer as n
      from won group by won.user_id
    ),
    credited as (
      insert into public.player_stats as ps (user_id, xp, trophy_count)
      select agg.user_id, agg.xp_sum, agg.n from agg
      on conflict (user_id) do update set
        xp = ps.xp + excluded.xp,
        trophy_count = ps.trophy_count + excluded.trophy_count,
        updated_at = now()
      returning ps.user_id
    )
    select array_agg(credited.user_id) into v_winners from credited;

    -- Pokal-Badge („Pokal-Regal") kann durch neue trophy_counts fällig werden
    if v_winners is not null then
      foreach u in array v_winners loop
        perform public.award_badges(u);
      end loop;
    end if;
  end loop;
end;
$$;

-- ---- Lese-RPCs: Rang mit ausgeben --------------------------------------------------
drop function if exists public.get_cup_trophies(integer);

create function public.get_cup_trophies(p_limit integer default 100)
returns table (
  period_type text,
  period_start date,
  rank smallint,
  display_name text,
  total_score integer,
  awarded_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  perform public.finalize_cup_trophies();

  return query
    select t.period_type, t.period_start, t.rank, p.display_name, t.total_score, t.awarded_at
    from public.cup_trophies t
    join public.profiles p on p.id = t.user_id
    order by t.period_start desc,
      case t.period_type when 'year' then 0 when 'month' then 1 else 2 end,
      t.rank asc
    limit least(greatest(p_limit, 1), 300);
end;
$$;

create or replace function public.get_gamification()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_registered_user() then
    return null; -- Gäste sehen den Teaser, kein Fehler
  end if;
  perform public.finalize_cup_trophies();

  select jsonb_build_object(
    'stats', to_jsonb(s.*) - 'user_id',
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object(
          'badge_id', b.badge_id, 'tier', b.tier, 'awarded_at', b.awarded_at)
        order by b.awarded_at asc, b.badge_id, b.tier)
      from public.player_badges b where b.user_id = auth.uid()), '[]'::jsonb),
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object(
          'period_type', t.period_type, 'period_start', t.period_start,
          'rank', t.rank, 'total_score', t.total_score, 'awarded_at', t.awarded_at)
        order by t.period_start desc)
      from public.cup_trophies t where t.user_id = auth.uid()), '[]'::jsonb)
  ) into v_result
  from public.player_stats s
  where s.user_id = auth.uid();

  return v_result; -- null, wenn noch keine Stats-Zeile existiert
end;
$$;

-- ---- Rechte -------------------------------------------------------------------------
revoke execute on function public.finalize_cup_trophies() from public, anon, authenticated;
revoke execute on function public.get_cup_trophies(integer) from public, anon;
revoke execute on function public.get_gamification() from public, anon;

grant execute on function public.get_cup_trophies(integer) to authenticated;
grant execute on function public.get_gamification() to authenticated;

-- ---- Nachvergabe ----------------------------------------------------------------------
-- Füllt Plätze 2/3 bereits finalisierter Perioden auf, falls es dort weitere
-- Cup-Spieler gab (inkl. XP + ggf. Pokal-Regal-Badge).
select public.finalize_cup_trophies();
