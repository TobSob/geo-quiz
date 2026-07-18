-- Beta-Tester-Avatar (Nutzer-Wunsch 2026-07-18): kleines Dankeschön an alle,
-- die bis zum 31.08.2026 mitgespielt haben — ein Käfer-Avatar ("Bug", Anspielung
-- aufs Bugs-Finden während der Beta). Zeitlich befristete Freischaltung: wer bis
-- zum Stichtag mindestens eine gewertete Runde oder einen Cup spielt, behält den
-- Avatar dauerhaft; danach vergibt der Code niemandem den Avatar neu (kein
-- pg_cron nötig — die Bedingung `now() <= Stichtag` wird einfach irgendwann
-- immer falsch).
--
-- Setzt Migration 0008 voraus (player_stats, submit_score, submit_cup_run).
-- `create or replace` auf beiden Funktionen — Signatur unverändert, Rechte
-- bleiben also erhalten (kein erneutes GRANT nötig).

alter table public.player_stats
  add column if not exists beta_tester boolean not null default false;

-- ---- submit_score: Beta-Tester-Flag mit setzen -----------------------------------
create or replace function public.submit_score(
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
  v_beta boolean := v_today <= date '2026-08-31';
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
     play_days, last_play_day, mode_correct, beta_tester)
    values
    (auth.uid(), v_xp, 1,
     case when p_cup_run_id is null then greatest(p_score, 0) else 0 end,
     p_question_count, v_correct, p_score, v_streak, v_volltreffer,
     1, v_today, jsonb_build_object(p_mode, v_correct), v_beta)
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
      beta_tester = ps.beta_tester or v_beta,
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

-- ---- submit_cup_run: Beta-Tester-Flag mit setzen ---------------------------------
create or replace function public.submit_cup_run(
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
  v_beta boolean := (now() at time zone 'Europe/Berlin')::date <= date '2026-08-31';
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
  insert into public.player_stats as ps (user_id, xp, cup_count, cup_best_score, beta_tester)
    values (auth.uid(), 50, 1, greatest(p_total, 0), v_beta)
    on conflict (user_id) do update set
      xp = ps.xp + 50,
      cup_count = ps.cup_count + 1,
      cup_best_score = greatest(ps.cup_best_score, p_total),
      beta_tester = ps.beta_tester or v_beta,
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

-- ---- Backfill: alle bisherigen Spieler haben zwangsläufig vor dem Stichtag
-- gespielt (das Spiel existiert erst seit 2026-07-10) -----------------------
update public.player_stats set beta_tester = true where not beta_tester;
