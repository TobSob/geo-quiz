-- Anti-Cheat Stufe 1 (Phase D1+D2, DESIGN-ARCADE/ROADMAP):
-- Scores brauchen ab jetzt eine real durchlebte Session. Der Client meldet
-- den Rundenstart (start_session), der Server bucht bei jeder Abgabe die
-- behauptete Spielzeit gegen die tatsächlich vergangene Wanduhrzeit —
-- erfundene Scores per curl scheitern, weil niemand Zeit vorspulen kann.
-- Direkte Inserts auf score_entries/cup_runs sind Clients nicht mehr erlaubt.

-- ---- Session-Konto: eine aktive Spielperiode je Nutzer -----------------------
create table public.play_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- bereits durch Abgaben "verbrauchte" Spielzeit seit started_at
  consumed_ms bigint not null default 0 check (consumed_ms >= 0)
);

alter table public.play_sessions enable row level security;
-- keine Policies: Zugriff ausschließlich über die RPCs unten.

-- Rate-Limit-Abfragen brauchen user+Zeit-Zugriff auf score_entries
create index if not exists score_entries_user_time_idx
  on public.score_entries (user_id, played_at desc);
create index if not exists cup_runs_user_time_idx
  on public.cup_runs (user_id, played_at desc);

-- ---- Rundenstart --------------------------------------------------------------
-- Auch anonyme Spieler dürfen starten (harmlos) — die Abgabe-RPCs prüfen
-- selbst auf registrierte Accounts.
create or replace function public.start_session()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.play_sessions (user_id, started_at, consumed_ms)
    values (auth.uid(), now(), 0)
    on conflict (user_id) do update
      set started_at = now(), consumed_ms = 0;
end;
$$;

-- ---- Score-Abgabe (ersetzt den direkten Insert) --------------------------------
-- Der Plausibilitäts-Trigger aus 0005 läuft beim Insert weiterhin mit
-- (Mindestdauer je Frage, Maximaldauer, Score-Obergrenze) — Defense in depth.
create or replace function public.submit_score(
  p_mode text,
  p_score integer,
  p_max_possible integer,
  p_question_count integer,
  p_duration_ms integer,
  p_cup_run_id bigint default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_session public.play_sessions%rowtype;
  v_elapsed_ms bigint;
  v_id bigint;
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

  update public.play_sessions
    set consumed_ms = consumed_ms + p_duration_ms
    where user_id = auth.uid();

  insert into public.score_entries
    (user_id, mode, score, max_possible, question_count, duration_ms, cup_run_id)
    values
    (auth.uid(), p_mode, p_score, p_max_possible, p_question_count, p_duration_ms, p_cup_run_id)
    returning id into v_id;
  return v_id;
end;
$$;

-- ---- Cup-Abgabe ------------------------------------------------------------------
create or replace function public.submit_cup_run(
  p_total integer,
  p_modes jsonb
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_session public.play_sessions%rowtype;
  v_elapsed_ms bigint;
  v_id bigint;
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
  return v_id;
end;
$$;

-- ---- Direkte Inserts sperren (Clients schreiben nur noch über die RPCs) --------
drop policy "score_entries: insert own" on public.score_entries;
drop policy "cup_runs: insert own" on public.cup_runs;

-- ---- Rechte -----------------------------------------------------------------------
revoke execute on function public.start_session() from public, anon;
revoke execute on function public.submit_score(text, integer, integer, integer, integer, bigint) from public, anon;
revoke execute on function public.submit_cup_run(integer, jsonb) from public, anon;

grant execute on function public.start_session() to authenticated;
grant execute on function public.submit_score(text, integer, integer, integer, integer, bigint) to authenticated;
grant execute on function public.submit_cup_run(integer, jsonb) to authenticated;
