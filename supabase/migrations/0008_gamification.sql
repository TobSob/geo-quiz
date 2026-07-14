-- Gamification (Phase G, DESIGN-GAMIFICATION.md): Abzeichen in 5 Stufen,
-- Cup-Pokale (Wochen-/Monats-/Jahresbester, lazy finalisiert — kein pg_cron),
-- XP-Konto je Spieler. Alles serverseitig, account-gebunden.
--
-- ⚠️ NIE DOPPELT AUSFÜHREN: Der Backfill am Ende schreibt XP aus Alt-Daten
--    gut — ein zweiter Lauf scheitert zwar an den Tabellen (create table),
--    aber Teilstücke von Hand wiederholen würde XP doppelt gutschreiben.
-- ⚠️ Setzt Migration 0007 voraus (droppt/ersetzt deren submit-RPCs).

-- ---- player_stats: ein XP-/Metriken-Konto je Spieler ---------------------------
-- Additiv gepflegt in submit_score/submit_cup_run; Quelle für alle
-- Badge-Schwellen. best_streak/volltreffer_count sind nicht backfillbar
-- (waren nie in der DB) und wachsen erst ab dieser Migration.
create table public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  rounds_played integer not null default 0 check (rounds_played >= 0),
  solo_best_score integer not null default 0 check (solo_best_score >= 0),
  cup_count integer not null default 0 check (cup_count >= 0),
  cup_best_score integer not null default 0 check (cup_best_score >= 0),
  questions_answered bigint not null default 0 check (questions_answered >= 0),
  questions_correct bigint not null default 0 check (questions_correct >= 0),
  total_points bigint not null default 0 check (total_points >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  volltreffer_count integer not null default 0 check (volltreffer_count >= 0),
  trophy_count integer not null default 0 check (trophy_count >= 0),
  play_days integer not null default 0 check (play_days >= 0),
  last_play_day date,
  -- richtige Antworten je Modus, z. B. {"flags": 123, "capitals": 45}
  mode_correct jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_stats enable row level security;

create policy "player_stats: read own" on public.player_stats
  for select using (auth.uid() = user_id);
-- Schreiben ausschließlich über die RPCs unten (security definer).

-- ---- badge_definitions: Schwellen-Katalog (geseedet) ---------------------------
-- Anzeige-Copy (Namen, Sprüche, Emojis) lebt im Client
-- (features/gamification/badgeCatalog.ts) — hier nur die Mechanik.
-- Rebalancing = UPDATE auf thresholds, kein Funktions-Umbau.
create table public.badge_definitions (
  badge_id text primary key check (char_length(badge_id) <= 32),
  -- player_stats-Spalte oder 'mode_correct:<mode>'
  metric text not null,
  -- aufsteigend: Normal, Bronze, Silber, Gold, Diamant
  thresholds integer[] not null check (array_length(thresholds, 1) = 5)
);

alter table public.badge_definitions enable row level security;

create policy "badge_definitions: read" on public.badge_definitions
  for select to authenticated using (true);

-- ---- player_badges: eine Zeile je erreichter Stufe -----------------------------
-- "Neu freigeschaltet" = echtes Insert; XP je Stufe damit sauber einmalig.
create table public.player_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id text not null references public.badge_definitions (badge_id),
  tier smallint not null check (tier between 1 and 5),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id, tier)
);

alter table public.player_badges enable row level security;

create policy "player_badges: read own" on public.player_badges
  for select using (auth.uid() = user_id);

-- ---- cup_trophies: Hall of Fame ------------------------------------------------
-- Genau ein Gewinner je Kalenderperiode (Europe/Berlin, Woche = ISO Mo–So):
-- beste Einzelleistung, Tie → früheres played_at. Vergeben wird lazy nach
-- Periodenende durch finalize_cup_trophies().
create table public.cup_trophies (
  id bigint generated always as identity primary key,
  period_type text not null check (period_type in ('week', 'month', 'year')),
  period_start date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  total_score integer not null check (total_score >= 0),
  cup_run_id bigint references public.cup_runs (id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (period_type, period_start)
);

alter table public.cup_trophies enable row level security;

create policy "cup_trophies: read own" on public.cup_trophies
  for select using (auth.uid() = user_id);
-- Hall of Fame läuft über get_cup_trophies() (nur display_name, nie user_id).

-- Periodensuche der Finalisierung
create index if not exists cup_runs_played_at_idx on public.cup_runs (played_at);

-- ---- XP-Konstanten (Spiegel im Client: badgeCatalog.ts) -------------------------
-- Gameplay: ceil(score/100), min. 1 · Cup-Abschluss: +50
-- Badge-Stufen: 25/50/100/250/500 · Pokale: Woche 200 / Monat 500 / Jahr 1500

-- ---- Badge-Seed (Schwellen: DESIGN-GAMIFICATION.md) -----------------------------
insert into public.badge_definitions (badge_id, metric, thresholds) values
  ('globetrotter',    'questions_answered',        array[50, 250, 1000, 5000, 20000]),
  ('besserwisser',    'questions_correct',         array[25, 150, 750, 3000, 12000]),
  ('punktesauger',    'total_points',              array[10000, 50000, 250000, 1000000, 5000000]),
  ('dauerzocker',     'rounds_played',             array[10, 50, 200, 1000, 5000]),
  ('highscorer',      'solo_best_score',           array[1500, 2500, 3500, 4500, 6000]),
  ('serientaeter',    'best_streak',               array[5, 10, 15, 20, 30]),
  ('sniper',          'volltreffer_count',         array[10, 50, 250, 1000, 5000]),
  ('cupkaempfer',     'cup_count',                 array[1, 10, 50, 250, 1000]),
  ('stammgast',       'play_days',                 array[3, 14, 60, 180, 365]),
  ('pokalregal',      'trophy_count',              array[1, 3, 10, 25, 60]),
  ('flaggen_fan',     'mode_correct:flags',        array[25, 100, 500, 2000, 10000]),
  ('kontinental',     'mode_correct:countries',    array[25, 100, 500, 2000, 10000]),
  ('hauptstadt_held', 'mode_correct:capitals',     array[25, 100, 500, 2000, 10000]),
  ('silhouetten',     'mode_correct:outline',      array[25, 100, 500, 2000, 10000]),
  ('staedte_sniper',  'mode_correct:city-pin',     array[15, 75, 300, 1200, 6000]),
  ('landmark_magier', 'mode_correct:landmark-pin', array[15, 75, 300, 1200, 6000]);

-- ---- award_badges: generische Vergabe-Schleife ----------------------------------
-- Intern (kein Grant an Clients) — wird von den submit-RPCs, der Pokal-
-- Finalisierung und dem Backfill gerufen. Gibt NEU vergebene Stufen zurück:
-- [{"badge_id": "...", "tier": 2, "xp": 50}, ...]
create or replace function public.award_badges(p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.player_stats%rowtype;
  def record;
  v_value bigint;
  t integer;
  v_new jsonb := '[]'::jsonb;
  v_xp_sum bigint := 0;
  tier_xp constant integer[] := array[25, 50, 100, 250, 500];
begin
  select * into s from public.player_stats where user_id = p_user;
  if not found then
    return '[]'::jsonb;
  end if;

  for def in select * from public.badge_definitions loop
    v_value := case def.metric
      when 'questions_answered' then s.questions_answered
      when 'questions_correct'  then s.questions_correct
      when 'total_points'       then s.total_points
      when 'rounds_played'      then s.rounds_played
      when 'solo_best_score'    then s.solo_best_score
      when 'best_streak'        then s.best_streak
      when 'volltreffer_count'  then s.volltreffer_count
      when 'cup_count'          then s.cup_count
      when 'play_days'          then s.play_days
      when 'trophy_count'       then s.trophy_count
      else coalesce((s.mode_correct ->> split_part(def.metric, ':', 2))::bigint, 0)
    end;
    for t in 1..5 loop
      exit when v_value < def.thresholds[t];
      insert into public.player_badges (user_id, badge_id, tier)
        values (p_user, def.badge_id, t)
        on conflict do nothing;
      if found then
        v_xp_sum := v_xp_sum + tier_xp[t];
        v_new := v_new || jsonb_build_object(
          'badge_id', def.badge_id, 'tier', t, 'xp', tier_xp[t]);
      end if;
    end loop;
  end loop;

  if v_xp_sum > 0 then
    update public.player_stats
      set xp = xp + v_xp_sum, updated_at = now()
      where user_id = p_user;
  end if;
  return v_new;
end;
$$;

-- ---- finalize_cup_trophies: Lazy-Vergabe abgeschlossener Perioden ----------------
-- Kein pg_cron verfügbar → läuft opportunistisch bei jedem Lesen (Erfolge-
-- Screen, Hall of Fame) und jeder Cup-Abgabe. Idempotent und racefest:
-- Advisory-Lock serialisiert, unique(period_type, period_start) +
-- on conflict do nothing verhindern Doppelvergabe.
create or replace function public.finalize_cup_trophies()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  pt text;
  v_xp integer;
  v_winners uuid[];
  u uuid;
begin
  perform pg_advisory_xact_lock(hashtext('geo_quiz_cup_trophies'));

  foreach pt in array array['week', 'month', 'year'] loop
    v_xp := case pt when 'week' then 200 when 'month' then 500 else 1500 end;

    with won as (
      -- alle abgeschlossenen Perioden mit Cup-Runs, aber ohne Pokal
      insert into public.cup_trophies
        (period_type, period_start, user_id, total_score, cup_run_id)
      select pt, periods.ps, best.user_id, best.total_score, best.id
      from (
        select distinct date_trunc(pt, c.played_at at time zone 'Europe/Berlin')::date as ps
        from public.cup_runs c
        where date_trunc(pt, c.played_at at time zone 'Europe/Berlin')::date
            < date_trunc(pt, now() at time zone 'Europe/Berlin')::date
      ) periods
      cross join lateral (
        select c.id, c.user_id, c.total_score
        from public.cup_runs c
        where date_trunc(pt, c.played_at at time zone 'Europe/Berlin')::date = periods.ps
        order by c.total_score desc, c.played_at asc
        limit 1
      ) best
      where not exists (
        select 1 from public.cup_trophies t
        where t.period_type = pt and t.period_start = periods.ps
      )
      on conflict do nothing
      returning cup_trophies.user_id
    ),
    agg as (
      select won.user_id, count(*)::integer as n from won group by won.user_id
    ),
    credited as (
      insert into public.player_stats as ps (user_id, xp, trophy_count)
      select agg.user_id, agg.n * v_xp, agg.n from agg
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

-- ---- submit_score: ersetzt die 0007-Fassung --------------------------------------
-- Neu: drei defaultete Badge-Metrik-Parameter (alter 6-Arg-Client bleibt
-- lauffähig) und jsonb-Unlock-Payload statt bigint als Rückgabe
-- (Rückgabetyp-Wechsel → drop statt create or replace).
drop function if exists public.submit_score(text, integer, integer, integer, integer, bigint);

create function public.submit_score(
  p_mode text,
  p_score integer,
  p_max_possible integer,
  p_question_count integer,
  p_duration_ms integer,
  p_cup_run_id bigint default null,
  p_correct_count integer default null,
  p_best_streak integer default null,
  p_volltreffer integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_session public.play_sessions%rowtype;
  v_elapsed_ms bigint;
  v_id bigint;
  v_correct integer := coalesce(p_correct_count, 0);
  v_streak integer := coalesce(p_best_streak, 0);
  v_volltreffer integer := coalesce(p_volltreffer, 0);
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_xp integer;
  v_badges jsonb;
  v_badge_xp bigint;
  v_xp_total bigint;
begin
  if auth.uid() is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  -- D2: mehr als 30 gewertete Runden pro Stunde spielt kein Mensch
  if (select count(*) from public.score_entries
      where user_id = auth.uid() and played_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate limited';
  end if;

  select * into v_session from public.play_sessions where user_id = auth.uid();
  if not found then
    raise exception 'no session started';
  end if;
  if v_session.started_at < now() - interval '30 minutes' then
    raise exception 'session expired';
  end if;
  -- D1-Kern: behauptete Spielzeit muss in die real vergangene Wanduhrzeit passen
  v_elapsed_ms := floor(extract(epoch from (now() - v_session.started_at)) * 1000);
  if v_elapsed_ms < v_session.consumed_ms + p_duration_ms then
    raise exception 'implausible play time';
  end if;

  -- Badge-Metriken plausibel? (beeinflussen nur Abzeichen, nie Leaderboards)
  if v_correct < 0 or v_correct > p_question_count
     or v_streak < 0 or v_streak > p_question_count
     or v_volltreffer < 0 or v_volltreffer > v_correct then
    raise exception 'implausible round stats';
  end if;

  update public.play_sessions
    set consumed_ms = consumed_ms + p_duration_ms
    where user_id = auth.uid();

  insert into public.score_entries
    (user_id, mode, score, max_possible, question_count, duration_ms, cup_run_id)
    values
    (auth.uid(), p_mode, p_score, p_max_possible, p_question_count, p_duration_ms, p_cup_run_id)
    returning id into v_id;

  -- Stats fortschreiben (Gameplay-XP: ceil(score/100), min. 1)
  v_xp := greatest(1, ceil(p_score / 100.0)::integer);
  insert into public.player_stats as ps
    (user_id, xp, rounds_played, solo_best_score, questions_answered,
     questions_correct, total_points, best_streak, volltreffer_count,
     play_days, last_play_day, mode_correct)
    values
    (auth.uid(), v_xp, 1,
     case when p_cup_run_id is null then greatest(p_score, 0) else 0 end,
     p_question_count, v_correct, p_score, v_streak, v_volltreffer,
     1, v_today, jsonb_build_object(p_mode, v_correct))
    on conflict (user_id) do update set
      xp = ps.xp + v_xp,
      rounds_played = ps.rounds_played + 1,
      solo_best_score = case when p_cup_run_id is null
        then greatest(ps.solo_best_score, p_score) else ps.solo_best_score end,
      questions_answered = ps.questions_answered + p_question_count,
      questions_correct = ps.questions_correct + v_correct,
      total_points = ps.total_points + p_score,
      best_streak = greatest(ps.best_streak, v_streak),
      volltreffer_count = ps.volltreffer_count + v_volltreffer,
      play_days = ps.play_days
        + case when ps.last_play_day is distinct from v_today then 1 else 0 end,
      last_play_day = v_today,
      mode_correct = jsonb_set(coalesce(ps.mode_correct, '{}'::jsonb), array[p_mode],
        to_jsonb(coalesce((ps.mode_correct ->> p_mode)::bigint, 0) + v_correct)),
      updated_at = now();

  v_badges := public.award_badges(auth.uid());
  select coalesce(sum((b ->> 'xp')::integer), 0) into v_badge_xp
    from jsonb_array_elements(v_badges) b;
  select xp into v_xp_total from public.player_stats where user_id = auth.uid();

  return jsonb_build_object(
    'entry_id', v_id,
    'xp_gained', v_xp + v_badge_xp,
    'xp_total', v_xp_total,
    'new_badges', v_badges
  );
end;
$$;

-- ---- submit_cup_run: ersetzt die 0007-Fassung --------------------------------------
drop function if exists public.submit_cup_run(integer, jsonb);

create function public.submit_cup_run(
  p_total integer,
  p_modes jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_session public.play_sessions%rowtype;
  v_elapsed_ms bigint;
  v_id bigint;
  v_badges jsonb;
  v_badge_xp bigint;
  v_xp_total bigint;
begin
  if auth.uid() is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  if (select count(*) from public.cup_runs
      where user_id = auth.uid() and played_at > now() - interval '1 hour') >= 6 then
    raise exception 'rate limited';
  end if;

  select * into v_session from public.play_sessions where user_id = auth.uid();
  if not found then
    raise exception 'no session started';
  end if;
  if v_session.started_at < now() - interval '30 minutes' then
    raise exception 'session expired';
  end if;
  -- 6 Legs à 30 s: unter 150 s Wanduhrzeit ist kein vollständiger Cup möglich
  v_elapsed_ms := floor(extract(epoch from (now() - v_session.started_at)) * 1000);
  if v_elapsed_ms < 150000 then
    raise exception 'implausible play time';
  end if;

  insert into public.cup_runs (user_id, total_score, modes_played)
    values (auth.uid(), p_total, p_modes)
    returning id into v_id;

  -- Cup-Abschluss: +50 XP (die Legs geben ihre XP über submit_score)
  insert into public.player_stats as ps (user_id, xp, cup_count, cup_best_score)
    values (auth.uid(), 50, 1, greatest(p_total, 0))
    on conflict (user_id) do update set
      xp = ps.xp + 50,
      cup_count = ps.cup_count + 1,
      cup_best_score = greatest(ps.cup_best_score, p_total),
      updated_at = now();

  v_badges := public.award_badges(auth.uid());
  -- opportunistisch abgelaufene Perioden nachziehen (nie die laufende)
  perform public.finalize_cup_trophies();

  select coalesce(sum((b ->> 'xp')::integer), 0) into v_badge_xp
    from jsonb_array_elements(v_badges) b;
  select xp into v_xp_total from public.player_stats where user_id = auth.uid();

  return jsonb_build_object(
    'cup_run_id', v_id,
    'xp_gained', 50 + v_badge_xp,
    'xp_total', v_xp_total,
    'new_badges', v_badges
  );
end;
$$;

-- ---- get_gamification: eigener Stand (Erfolge-Screen) -------------------------------
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
          'total_score', t.total_score, 'awarded_at', t.awarded_at)
        order by t.period_start desc)
      from public.cup_trophies t where t.user_id = auth.uid()), '[]'::jsonb)
  ) into v_result
  from public.player_stats s
  where s.user_id = auth.uid();

  return v_result; -- null, wenn noch keine Stats-Zeile existiert
end;
$$;

-- ---- get_cup_trophies: Hall of Fame ---------------------------------------------------
-- Wie die Leaderboards: nur display_name, nie user_id; nur registrierte Accounts.
create or replace function public.get_cup_trophies(p_limit integer default 100)
returns table (
  period_type text,
  period_start date,
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
    select t.period_type, t.period_start, p.display_name, t.total_score, t.awarded_at
    from public.cup_trophies t
    join public.profiles p on p.id = t.user_id
    order by t.period_start desc,
      case t.period_type when 'year' then 0 when 'month' then 1 else 2 end
    limit least(greatest(p_limit, 1), 300);
end;
$$;

-- ---- get_leaderboard_levels: Level-Bestenliste (global + Gruppe) -----------------------
-- Muster wie get_leaderboard_scores (0006); Level rechnet der Client aus xp.
-- Kein Zeitfilter — XP ist ein Allzeit-Konto.
create or replace function public.get_leaderboard_levels(
  p_limit integer default 25,
  p_group bigint default null
)
returns table (
  display_name text,
  xp bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name, s.xp
  from public.player_stats s
  join public.profiles p on p.id = s.user_id
  where public.is_registered_user()
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
  order by s.xp desc, s.updated_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---- Rechte ------------------------------------------------------------------------------
-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
-- award_badges/finalize_cup_trophies sind rein intern: niemand außer dem
-- Owner (über die anderen definer-Funktionen) darf sie rufen.
revoke execute on function public.award_badges(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_cup_trophies() from public, anon, authenticated;
revoke execute on function public.submit_score(text, integer, integer, integer, integer, bigint, integer, integer, integer) from public, anon;
revoke execute on function public.submit_cup_run(integer, jsonb) from public, anon;
revoke execute on function public.get_gamification() from public, anon;
revoke execute on function public.get_cup_trophies(integer) from public, anon;
revoke execute on function public.get_leaderboard_levels(integer, bigint) from public, anon;

grant execute on function public.submit_score(text, integer, integer, integer, integer, bigint, integer, integer, integer) to authenticated;
grant execute on function public.submit_cup_run(integer, jsonb) to authenticated;
grant execute on function public.get_gamification() to authenticated;
grant execute on function public.get_cup_trophies(integer) to authenticated;
grant execute on function public.get_leaderboard_levels(integer, bigint) to authenticated;

-- ---- Backfill: Bestandsspieler bekommen ihren Verlauf gutgeschrieben --------------------
-- Aus score_entries/cup_runs (Runden, Punkte, Bestwerte, Spieltage, XP) und
-- user_progress (richtige Antworten je Modus — Näherung: enthält auch
-- Training; gedeckelt auf questions_answered). best_streak/volltreffer
-- starten bei 0 (nie erfasst). Danach Badges + rückwirkende Pokale.
with se as (
  select
    user_id,
    count(*)::integer as rounds_played,
    sum(question_count)::bigint as questions_answered,
    sum(score)::bigint as total_points,
    coalesce(max(score) filter (where cup_run_id is null), 0)::integer as solo_best_score,
    count(distinct (played_at at time zone 'Europe/Berlin')::date)::integer as play_days,
    max((played_at at time zone 'Europe/Berlin')::date) as last_play_day,
    sum(greatest(1, ceil(score / 100.0)::integer))::bigint as xp
  from public.score_entries
  group by user_id
),
cr as (
  select
    user_id,
    count(*)::integer as cup_count,
    max(total_score)::integer as cup_best_score,
    (count(*) * 50)::bigint as xp
  from public.cup_runs
  group by user_id
),
base as (
  select user_id from se
  union
  select user_id from cr
),
up as (
  select
    user_id,
    sum(mode_sum)::bigint as correct_total,
    jsonb_object_agg(mode, mode_sum) as mode_correct
  from (
    select
      user_id,
      case split_part(question_id, ':', 1)
        when 'flag' then 'flags'
        when 'country' then 'countries'
        when 'capital' then 'capitals'
        when 'outline' then 'outline'
        when 'city-pin' then 'city-pin'
        when 'landmark-pin' then 'landmark-pin'
      end as mode,
      sum(times_correct)::bigint as mode_sum
    from public.user_progress
    group by user_id, split_part(question_id, ':', 1)
  ) per_mode
  where per_mode.mode is not null
  group by user_id
)
insert into public.player_stats
  (user_id, xp, rounds_played, solo_best_score, cup_count, cup_best_score,
   questions_answered, questions_correct, total_points, play_days,
   last_play_day, mode_correct)
select
  b.user_id,
  coalesce(se.xp, 0) + coalesce(cr.xp, 0),
  coalesce(se.rounds_played, 0),
  coalesce(se.solo_best_score, 0),
  coalesce(cr.cup_count, 0),
  coalesce(cr.cup_best_score, 0),
  coalesce(se.questions_answered, 0),
  least(coalesce(up.correct_total, 0), coalesce(se.questions_answered, 0)),
  coalesce(se.total_points, 0),
  coalesce(se.play_days, 0),
  se.last_play_day,
  coalesce(up.mode_correct, '{}'::jsonb)
from base b
left join se using (user_id)
left join cr using (user_id)
left join up using (user_id);

-- Badges für den Bestand vergeben (schreibt Badge-XP gleich mit)
do $$
declare
  u uuid;
begin
  for u in select user_id from public.player_stats loop
    perform public.award_badges(u);
  end loop;
end;
$$;

-- Rückwirkende Pokale für alle abgeschlossenen Perioden seit dem ersten Cup-Run
select public.finalize_cup_trophies();
