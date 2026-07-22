-- ===== 0001_init.sql =====
-- geo-quiz initial schema: profiles, progress, scores, cup runs.
-- RLS everywhere; public leaderboard access only through views (0003).

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'PLAYER' check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ------------------------------------------------------------ user_progress
create table public.user_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) <= 64),
  times_shown integer not null default 0 check (times_shown >= 0),
  times_wrong integer not null default 0 check (times_wrong >= 0),
  times_correct integer not null default 0 check (times_correct >= 0),
  last_seen_at timestamptz not null default now(),
  last_result boolean not null default false,
  -- reserved for a future SM-2 style scheduler
  ease_factor real,
  interval_days real,
  unique (user_id, question_id)
);

alter table public.user_progress enable row level security;

create policy "user_progress: read own" on public.user_progress
  for select using (auth.uid() = user_id);

-- Writes go exclusively through the increment_progress() RPC (security definer),
-- so no insert/update policies are exposed to clients.

-- ------------------------------------------------------------- score_entries
create table public.score_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('flags','countries','capitals','outline','city-pin','landmark-pin')),
  score integer not null check (score >= 0),
  max_possible integer not null check (max_possible > 0),
  question_count integer not null check (question_count between 1 and 100),
  duration_ms integer not null check (duration_ms > 0),
  played_at timestamptz not null default now(),
  cup_run_id bigint,
  check (score <= max_possible)
);

create index score_entries_leaderboard_idx
  on public.score_entries (mode, score desc, played_at desc);

alter table public.score_entries enable row level security;

create policy "score_entries: read own" on public.score_entries
  for select using (auth.uid() = user_id);

create policy "score_entries: insert own" on public.score_entries
  for insert with check (auth.uid() = user_id);

-- --------------------------------------------------------------- cup_runs
create table public.cup_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  total_score integer not null check (total_score between 0 and 100),
  modes_played jsonb not null default '[]'::jsonb,
  played_at timestamptz not null default now()
);

create index cup_runs_leaderboard_idx
  on public.cup_runs (total_score desc, played_at desc);

alter table public.cup_runs enable row level security;

create policy "cup_runs: read own" on public.cup_runs
  for select using (auth.uid() = user_id);

create policy "cup_runs: insert own" on public.cup_runs
  for insert with check (auth.uid() = user_id);

alter table public.score_entries
  add constraint score_entries_cup_run_fk
  foreign key (cup_run_id) references public.cup_runs (id) on delete set null;

-- ------------------------------------------- plausibility trigger (anti-cheat lite)
-- A modified client can still lie, but reject the obviously impossible:
-- faster than 400 ms per question or more than the theoretical per-question max.
create or replace function public.validate_score_entry()
returns trigger
language plpgsql
as $$
begin
  if new.duration_ms < new.question_count * 400 then
    raise exception 'implausible duration for question count';
  end if;
  -- 225 = max points for a choice question (the highest of any mode)
  if new.max_possible > new.question_count * 225 then
    raise exception 'max_possible exceeds theoretical maximum';
  end if;
  return new;
end;
$$;

create trigger score_entries_validate
  before insert on public.score_entries
  for each row execute function public.validate_score_entry();


-- ===== 0002_increment_progress.sql =====
-- Atomic delta-merge for progress counters. The client is authoritative
-- between syncs; deltas add up server-side so two devices never clobber
-- each other (no last-write-wins on absolute values).

create or replace function public.increment_progress(
  p_question_id text,
  p_shown_delta integer,
  p_wrong_delta integer,
  p_correct_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_shown_delta < 0 or p_wrong_delta < 0 or p_correct_delta < 0
     or p_shown_delta > 1000 or p_wrong_delta > 1000 or p_correct_delta > 1000 then
    raise exception 'delta out of range';
  end if;

  insert into public.user_progress
    (user_id, question_id, times_shown, times_wrong, times_correct, last_seen_at, last_result)
  values
    (auth.uid(), p_question_id, p_shown_delta, p_wrong_delta, p_correct_delta, now(), p_correct_delta > 0)
  on conflict (user_id, question_id) do update set
    times_shown   = user_progress.times_shown   + excluded.times_shown,
    times_wrong   = user_progress.times_wrong   + excluded.times_wrong,
    times_correct = user_progress.times_correct + excluded.times_correct,
    last_seen_at  = now(),
    last_result   = excluded.last_result;
end;
$$;

-- Batch variant: sync a whole session in one round-trip.
-- p_deltas: [{"question_id":"flag:DE","shown":1,"wrong":0,"correct":1}, ...]
create or replace function public.sync_progress(p_deltas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
  n integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_array_length(p_deltas) > 500 then
    raise exception 'too many deltas';
  end if;

  for d in select * from jsonb_array_elements(p_deltas) loop
    perform public.increment_progress(
      d->>'question_id',
      coalesce((d->>'shown')::integer, 0),
      coalesce((d->>'wrong')::integer, 0),
      coalesce((d->>'correct')::integer, 0)
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.increment_progress from anon;
revoke execute on function public.sync_progress from anon;
grant execute on function public.increment_progress to authenticated;
grant execute on function public.sync_progress to authenticated;


-- ===== 0003_leaderboard_views.sql =====
-- Public leaderboards. Views run with owner privileges (security_invoker off),
-- deliberately bypassing RLS — but they expose only display_name + score,
-- never user_id or auth details.

create view public.leaderboard_scores
with (security_invoker = off) as
select
  p.display_name,
  s.mode,
  s.score,
  s.max_possible,
  round(100.0 * s.score / s.max_possible)::integer as percent,
  s.question_count,
  s.played_at
from public.score_entries s
join public.profiles p on p.id = s.user_id
order by percent desc, s.played_at desc;

create view public.leaderboard_cups
with (security_invoker = off) as
select
  p.display_name,
  c.total_score,
  c.modes_played,
  c.played_at
from public.cup_runs c
join public.profiles p on p.id = c.user_id
order by c.total_score desc, c.played_at desc;

grant select on public.leaderboard_scores to anon, authenticated;
grant select on public.leaderboard_cups to anon, authenticated;


-- ===== 0004_gate_leaderboards.sql =====
-- Global leaderboards are for registered accounts only.
-- Guests (anonymous sign-ins) can play and sync progress, but neither
-- submit to nor read the global lists. Enforced here, not just in the UI.

-- helper: true when the calling JWT belongs to a registered (non-anonymous) user
create or replace function public.is_registered_user()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, true) = false
$$;

-- ---- inserts: registered users only -------------------------------------
drop policy "score_entries: insert own" on public.score_entries;
create policy "score_entries: insert own" on public.score_entries
  for insert with check (auth.uid() = user_id and public.is_registered_user());

drop policy "cup_runs: insert own" on public.cup_runs;
create policy "cup_runs: insert own" on public.cup_runs
  for insert with check (auth.uid() = user_id and public.is_registered_user());

-- ---- views: return rows only to registered callers ----------------------
create or replace view public.leaderboard_scores
with (security_invoker = off) as
select
  p.display_name,
  s.mode,
  s.score,
  s.max_possible,
  round(100.0 * s.score / s.max_possible)::integer as percent,
  s.question_count,
  s.played_at
from public.score_entries s
join public.profiles p on p.id = s.user_id
where public.is_registered_user()
order by percent desc, s.played_at desc;

create or replace view public.leaderboard_cups
with (security_invoker = off) as
select
  p.display_name,
  c.total_score,
  c.modes_played,
  c.played_at
from public.cup_runs c
join public.profiles p on p.id = c.user_id
where public.is_registered_user()
order by c.total_score desc, c.played_at desc;

revoke select on public.leaderboard_scores from anon;
revoke select on public.leaderboard_cups from anon;

-- ---- wipe pre-gate test data (all entries so far were dev-session tests) --
delete from public.score_entries;
delete from public.cup_runs;



-- ===== 0005_arcade_scoring.sql =====
-- Arcade-Umbau (Phase E5, DESIGN-ARCADE.md + DESIGN-SOCIAL.md):
-- feste Zeit statt fester Fragenzahl → Scores sind Rohpunkte ohne Maximum.
-- Leaderboards zeigen die Bestleistung pro Spieler (DESIGN-SOCIAL S1) und
-- sind nach Zeitraum filterbar (Woche/Monat/Jahr/Alle) — deshalb RPCs statt
-- starrer Views. Alt-Einträge werden gelöscht (Nutzer-Entscheid 2026-07-12):
-- alte Prozent-Scores und neue Rohpunkte sind nicht vergleichbar.

-- ---- Alt-Daten löschen -----------------------------------------------------
delete from public.score_entries;
delete from public.cup_runs;

-- ---- cup_runs: Rohsumme statt 0–100 -----------------------------------------
alter table public.cup_runs
  drop constraint cup_runs_total_score_check;
alter table public.cup_runs
  add constraint cup_runs_total_score_check check (total_score >= 0);

-- ---- score_entries: Plausibilität fürs Arcade-Modell -------------------------
-- max_possible bleibt als Spalte; der Client schreibt dort den Score hinein
-- (Rohpunkte haben kein Maximum). Sauber abgelöst wird das Feld in Phase D,
-- wenn der Server die Scores selbst berechnet.
create or replace function public.validate_score_entry()
returns trigger
language plpgsql
as $$
begin
  -- schneller als 400 ms pro Frage ist keine menschliche Session
  if new.duration_ms < new.question_count * 400 then
    raise exception 'implausible duration for question count';
  end if;
  -- duration_ms ist aktive Spielzeit: 60-s-Budget + Streak-Rückholungen.
  -- 10 Minuten liegen jenseits jedes legalen Laufs.
  if new.duration_ms > 600000 then
    raise exception 'implausible session duration';
  end if;
  -- Obergrenze fehlerfreier Lauf (Streak-Multiplikator +10 %/Antwort):
  -- sum(100 * (1 + 0.1*i), i=0..n-1) = 100n + 5n(n-1)
  if new.score > 100 * new.question_count
       + 5 * new.question_count * (new.question_count - 1) then
    raise exception 'score exceeds theoretical maximum';
  end if;
  return new;
end;
$$;

-- ---- Leaderboards: RPCs (ersetzen die Views aus 0003/0004) -------------------
-- security definer + expliziter Gate auf registrierte Nutzer; exponieren wie
-- bisher nur display_name + Score-Daten, nie user_id. p_since = null → „Alle".
drop view if exists public.leaderboard_scores;
drop view if exists public.leaderboard_cups;

create or replace function public.get_leaderboard_scores(
  p_mode text,
  p_since timestamptz default null,
  p_limit integer default 25
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
    order by s.user_id, s.score desc, s.played_at asc
  ) best
  order by best.score desc, best.played_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.get_leaderboard_cups(
  p_since timestamptz default null,
  p_limit integer default 25
)
returns table (
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
  select best.display_name, best.total_score, best.modes_played, best.played_at
  from (
    select distinct on (c.user_id)
      p.display_name, c.total_score, c.modes_played, c.played_at
    from public.cup_runs c
    join public.profiles p on p.id = c.user_id
    where public.is_registered_user()
      and (p_since is null or c.played_at >= p_since)
    order by c.user_id, c.total_score desc, c.played_at asc
  ) best
  order by best.total_score desc, best.played_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Funktionen bekommen bei CREATE automatisch EXECUTE für PUBLIC — einsammeln.
revoke execute on function public.get_leaderboard_scores(text, timestamptz, integer)
  from public, anon;
revoke execute on function public.get_leaderboard_cups(timestamptz, integer)
  from public, anon;
grant execute on function public.get_leaderboard_scores(text, timestamptz, integer)
  to authenticated;
grant execute on function public.get_leaderboard_cups(timestamptz, integer)
  to authenticated;

-- ===== 0006_friend_groups.sql =====
-- Freundesgruppen (Phase F, DESIGN-SOCIAL.md): private Gruppen mit
-- Beitrittscode, Vergleich über die Leaderboard-RPCs (Gruppenfilter).
-- Verwaltung minimal (S2): Ersteller löscht, jeder tritt selbst aus.
-- Nur registrierte Accounts (konsistent mit 0004).

-- ---- Tabellen ----------------------------------------------------------------
create table public.friend_groups (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 24),
  code text not null unique check (char_length(code) <= 32),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.friend_group_members (
  group_id bigint not null references public.friend_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Beitrittsversuche fürs Rate-Limit — Codes dürfen nicht durchprobierbar sein.
create table public.group_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index group_join_attempts_user_idx
  on public.group_join_attempts (user_id, attempted_at desc);

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.group_join_attempts enable row level security;

-- ---- Helper ------------------------------------------------------------------
-- security definer, damit die Policies nicht auf sich selbst rekurrieren
-- (Membership-Check in einer Policy AUF friend_group_members).
create or replace function public.is_group_member(p_group bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friend_group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

-- ---- Policies (nur Lesen — alle Mutationen laufen über die RPCs) -------------
create policy "friend_groups: members read" on public.friend_groups
  for select using (public.is_group_member(id));

create policy "friend_group_members: members read" on public.friend_group_members
  for select using (public.is_group_member(group_id));

-- group_join_attempts: keine Policies — rein RPC-intern.

-- ---- Limits -------------------------------------------------------------------
-- max. 50 Mitglieder je Gruppe, max. 12 Gruppen je Spieler,
-- max. 20 Beitrittsversuche je Spieler und Stunde.

-- ---- RPCs ----------------------------------------------------------------------
-- Retro-lesbarer Code: WORT-TIER-9999 (~1,4 Mio. Kombinationen); zusammen mit
-- dem Rate-Limit ist Durchprobieren aussichtslos.
create or replace function public.generate_group_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  adjectives text[] := array['PIXEL','NEON','TURBO','RETRO','HYPER','MEGA','ULTRA','CYBER','ATOMIC','COSMIC','BLAZE','SHADOW'];
  animals text[] := array['FOX','WOLF','HAWK','TIGER','PANDA','OTTER','RAVEN','COBRA','LYNX','ORCA','YETI','DINGO'];
  candidate text;
begin
  for i in 1..25 loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
      || '-' || animals[1 + floor(random() * array_length(animals, 1))::int]
      || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    if not exists (select 1 from public.friend_groups where code = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'could not generate unique code';
end;
$$;

create or replace function public.create_group(p_name text)
returns table (group_id bigint, name text, code text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_name);
  v_id bigint;
  v_code text;
begin
  if auth.uid() is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    raise exception 'invalid group name';
  end if;
  if (select count(*) from public.friend_group_members where user_id = auth.uid()) >= 12 then
    raise exception 'too many groups';
  end if;

  v_code := public.generate_group_code();
  insert into public.friend_groups (name, code, created_by)
    values (v_name, v_code, auth.uid())
    returning id into v_id;
  insert into public.friend_group_members (group_id, user_id)
    values (v_id, auth.uid());
  return query select v_id, v_name, v_code;
end;
$$;

create or replace function public.join_group(p_code text)
returns table (group_id bigint, name text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_group public.friend_groups%rowtype;
begin
  if auth.uid() is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  if (select count(*) from public.group_join_attempts
      where user_id = auth.uid() and attempted_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many join attempts';
  end if;
  insert into public.group_join_attempts (user_id) values (auth.uid());

  select * into v_group from public.friend_groups g
    where g.code = upper(trim(p_code));
  if not found then
    raise exception 'group not found';
  end if;
  if (select count(*) from public.friend_group_members m where m.group_id = v_group.id) >= 50 then
    raise exception 'group full';
  end if;
  if (select count(*) from public.friend_group_members m where m.user_id = auth.uid()) >= 12 then
    raise exception 'too many groups';
  end if;

  insert into public.friend_group_members (group_id, user_id)
    values (v_group.id, auth.uid())
    on conflict do nothing;
  return query select v_group.id, v_group.name;
end;
$$;

create or replace function public.leave_group(p_group bigint)
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
  delete from public.friend_group_members
    where group_id = p_group and user_id = auth.uid();
end;
$$;

create or replace function public.delete_group(p_group bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.friend_groups
    where id = p_group and created_by = auth.uid()
    returning id into v_deleted;
  if v_deleted is null then
    raise exception 'only the creator can delete a group';
  end if;
end;
$$;

create or replace function public.list_my_groups()
returns table (
  group_id bigint,
  name text,
  code text,
  member_count bigint,
  is_owner boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.code,
    (select count(*) from public.friend_group_members m2 where m2.group_id = g.id),
    g.created_by = auth.uid()
  from public.friend_groups g
  join public.friend_group_members m
    on m.group_id = g.id and m.user_id = auth.uid()
  where public.is_registered_user()
  order by g.created_at asc;
$$;

-- ---- Leaderboard-RPCs um Gruppenfilter erweitern -------------------------------
-- Signaturwechsel (neuer Parameter) → alte Funktionen droppen statt overloaden.
drop function if exists public.get_leaderboard_scores(text, timestamptz, integer);
drop function if exists public.get_leaderboard_cups(timestamptz, integer);

create or replace function public.get_leaderboard_scores(
  p_mode text,
  p_since timestamptz default null,
  p_limit integer default 25,
  p_group bigint default null
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

create or replace function public.get_leaderboard_cups(
  p_since timestamptz default null,
  p_limit integer default 25,
  p_group bigint default null
)
returns table (
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
  select best.display_name, best.total_score, best.modes_played, best.played_at
  from (
    select distinct on (c.user_id)
      p.display_name, c.total_score, c.modes_played, c.played_at
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

-- ---- Rechte ---------------------------------------------------------------------
-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.is_group_member(bigint) from public, anon;
revoke execute on function public.generate_group_code() from public, anon, authenticated;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.leave_group(bigint) from public, anon;
revoke execute on function public.delete_group(bigint) from public, anon;
revoke execute on function public.list_my_groups() from public, anon;
revoke execute on function public.get_leaderboard_scores(text, timestamptz, integer, bigint) from public, anon;
revoke execute on function public.get_leaderboard_cups(timestamptz, integer, bigint) from public, anon;

grant execute on function public.is_group_member(bigint) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.leave_group(bigint) to authenticated;
grant execute on function public.delete_group(bigint) to authenticated;
grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.get_leaderboard_scores(text, timestamptz, integer, bigint) to authenticated;
grant execute on function public.get_leaderboard_cups(timestamptz, integer, bigint) to authenticated;

-- ===== 0007_session_guard.sql =====
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

-- ===== 0008_gamification.sql =====
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

-- ===== 0009_trophy_top3.sql =====
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

-- ===== 0010_profile_avatars.sql =====
-- Avatare (Feature-Idee R3): jedes Profil merkt sich seinen gewählten Avatar,
-- damit die Bestenliste die Avatare aller Spieler anzeigen kann. Additiv —
-- die Leaderboard-RPCs bleiben unangetastet, der Client dekoriert die Zeilen
-- über get_profile_avatars() nach.

alter table public.profiles
  add column if not exists avatar_id text
  check (avatar_id is null or char_length(avatar_id) <= 32);

create or replace function public.get_profile_avatars(p_names text[])
returns table (display_name text, avatar_id text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.display_name) p.display_name, p.avatar_id
  from public.profiles p
  where public.is_registered_user()
    and p.avatar_id is not null
    and p.display_name = any (p_names)
  order by p.display_name, p.last_seen_at desc;
$$;

revoke execute on function public.get_profile_avatars(text[]) from public, anon;
grant execute on function public.get_profile_avatars(text[]) to authenticated;

-- ===== 0011_cup_leg_breakdown.sql =====
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

-- ===== 0012_player_card.sql =====
-- Spielerkarte fremder Accounts (Nutzer-Feedback 2026-07-16, DESIGN-AVATARS A2):
-- Klick auf einen Bestenlisten-Eintrag soll die Karte DIESES Spielers zeigen,
-- nicht immer die eigene. Level/XP und Abzeichen kamen bereits über
-- get_gamification() für den eigenen Account — hier die name-basierte
-- Variante für jeden registrierten Spieler, plus Bestpunkte je Modus (bisher
-- nur lokal in progressStore.bests, hier aus score_entries abgeleitet).
--
-- Wie bei get_profile_avatars: nur display_name als Schlüssel, nie user_id;
-- bei Namensgleichheit gewinnt das zuletzt aktive Profil. Keine zusätzliche
-- Preisgabe gegenüber den bestehenden Leaderboards — Score, Name und Cup-
-- Aufschlüsselung (0011) sind für registrierte Aufrufer ohnehin schon
-- einsehbar.

create or replace function public.get_player_card(p_display_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_avatar_id text;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_registered_user() then
    return null;
  end if;

  select p.id, p.avatar_id into v_user_id, v_avatar_id
  from public.profiles p
  where p.display_name = p_display_name
  order by p.last_seen_at desc
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'display_name', p_display_name,
    'avatar_id', v_avatar_id,
    'xp', coalesce(s.xp, 0),
    'trophy_count', coalesce(s.trophy_count, 0),
    'cup_best_score', coalesce(s.cup_best_score, 0),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('badge_id', pb.badge_id, 'tier', pb.tier))
      from (
        select badge_id, max(tier) as tier
        from public.player_badges
        where user_id = v_user_id
        group by badge_id
      ) pb
    ), '[]'::jsonb),
    'mode_bests', coalesce((
      select jsonb_agg(jsonb_build_object('mode', se.mode, 'score', se.best))
      from (
        select mode, max(score) as best
        from public.score_entries
        where user_id = v_user_id and cup_run_id is null
        group by mode
      ) se
    ), '[]'::jsonb)
  ) into v_result
  from (select v_user_id as uid) base
  left join public.player_stats s on s.user_id = base.uid;

  return v_result;
end;
$$;

-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.get_player_card(text) from public, anon;
grant execute on function public.get_player_card(text) to authenticated;

-- ===== 0013_cup_leg_order.sql =====
-- Bug-Fix (Nutzer-Report 2026-07-16): die Disziplinen in der aufgeklappten
-- Cup-Bestenliste (0011) erschienen in zufälliger, von Lauf zu Lauf
-- wechselnder Reihenfolge.
--
-- Ursache: `submitCupRun` (scoreApi.ts) schickt alle sechs Leg-Scores
-- gleichzeitig per Promise.all an `submit_score` — welche Zeile zuerst in
-- score_entries landet (und damit ihre `id`) hängt vom Netzwerk-Timing ab,
-- nicht vom tatsächlichen Spielverlauf. `get_cup_run_legs` sortierte bisher
-- nach `s.id`, was dieses Zufalls-Timing direkt durchreicht.
--
-- Fix: feste Sortierung nach der echten Cup-Reihenfolge (CUP_MODES in
-- cupSession.ts): Flaggen → Hauptstädte → Länder → Umrisse → Städte-Pin →
-- Landmark-Pin. Gleiche Signatur wie 0011 → `create or replace` genügt.

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
  order by case s.mode
    when 'flags' then 1
    when 'capitals' then 2
    when 'countries' then 3
    when 'outline' then 4
    when 'city-pin' then 5
    when 'landmark-pin' then 6
    else 7
  end;
$$;

-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.get_cup_run_legs(bigint) from public, anon;
grant execute on function public.get_cup_run_legs(bigint) to authenticated;


-- ===== 0014_profile_featured_items.sql =====


-- Pokalregal (Phase I3/I4, DESIGN-GAMIFICATION.md): Jeder Spieler kann bis zu
-- 6 Regal-Plätze auf seiner öffentlichen Spielerkarte frei mit eigenen
-- Abzeichen und Pokalen bestücken (gemischt, frei angeordnet —
-- Nutzer-Entscheid 2026-07-18). Ohne Kuration zeigt der Client wie bisher
-- die Top-Abzeichen (Fallback im Frontend, nie ein leeres Regal).
--
-- Schreibzugriff NUR über set_featured_items() mit serverseitigem
-- Ownership-Check — niemand stellt sich fremde Pokale ins Regal.
-- Setzt Migrationen 0008/0009 (Badges/Pokale) und 0012 (get_player_card)
-- voraus. Gefahrlos mehrfach ausführbar bis auf den create-table-Block.

-- ---- Tabelle -------------------------------------------------------------------
create table if not exists public.profile_featured_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 6),
  item_type text not null check (item_type in ('badge', 'trophy')),
  badge_id text,
  badge_tier smallint check (badge_tier between 1 and 5),
  trophy_id bigint references public.cup_trophies (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  -- Genau EIN Item-Typ je Zeile, vollständig ausgefüllt:
  check (
    (item_type = 'badge' and badge_id is not null and badge_tier is not null
      and trophy_id is null)
    or
    (item_type = 'trophy' and trophy_id is not null
      and badge_id is null and badge_tier is null)
  )
);

alter table public.profile_featured_items enable row level security;

drop policy if exists "featured: read own" on public.profile_featured_items;
create policy "featured: read own" on public.profile_featured_items
  for select using (auth.uid() = user_id);
-- Fremde Regale laufen über get_player_card() (security definer, name-basiert);
-- Mutationen ausschließlich über set_featured_items().

-- ---- set_featured_items: Regal komplett ersetzen ---------------------------------
-- Payload: jsonb-Array, max. 6 Einträge, z. B.
--   [{"slot":1,"item_type":"badge","badge_id":"sniper","tier":3},
--    {"slot":2,"item_type":"trophy","trophy_id":5}]
-- Ownership wird je Item geprüft (player_badges bzw. cup_trophies.user_id);
-- doppelte Slots scheitern am Primary Key. Alles-oder-nichts (eine Transaktion).
create or replace function public.set_featured_items(p_items jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  item jsonb;
  v_slot smallint;
  v_type text;
  v_badge_id text;
  v_tier smallint;
  v_trophy_id bigint;
begin
  if v_uid is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid payload';
  end if;
  if jsonb_array_length(p_items) > 6 then
    raise exception 'too many items';
  end if;

  delete from public.profile_featured_items where user_id = v_uid;

  for item in select * from jsonb_array_elements(p_items) loop
    v_slot := (item->>'slot')::smallint;
    v_type := item->>'item_type';

    if v_type = 'badge' then
      v_badge_id := item->>'badge_id';
      v_tier := (item->>'tier')::smallint;
      if not exists (
        select 1 from public.player_badges b
        where b.user_id = v_uid and b.badge_id = v_badge_id and b.tier = v_tier
      ) then
        raise exception 'badge not owned';
      end if;
      insert into public.profile_featured_items
        (user_id, slot, item_type, badge_id, badge_tier)
      values (v_uid, v_slot, 'badge', v_badge_id, v_tier);

    elsif v_type = 'trophy' then
      v_trophy_id := (item->>'trophy_id')::bigint;
      if not exists (
        select 1 from public.cup_trophies t
        where t.id = v_trophy_id and t.user_id = v_uid
      ) then
        raise exception 'trophy not owned';
      end if;
      insert into public.profile_featured_items
        (user_id, slot, item_type, trophy_id)
      values (v_uid, v_slot, 'trophy', v_trophy_id);

    else
      raise exception 'invalid item type';
    end if;
  end loop;
end;
$$;

-- ---- featured_items_json: gemeinsamer Baustein der Lese-RPCs ---------------------
-- Pokal-Slots werden direkt mit Periode/Rang/Score aufgelöst, damit der
-- Betrachter einer FREMDEN Karte keine weitere Abfrage braucht.
create or replace function public.featured_items_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
        'slot', f.slot,
        'item_type', f.item_type,
        'badge_id', f.badge_id,
        'tier', f.badge_tier,
        'trophy_id', f.trophy_id,
        'period_type', t.period_type,
        'period_start', t.period_start,
        'rank', t.rank,
        'total_score', t.total_score)
      order by f.slot)
    from public.profile_featured_items f
    left join public.cup_trophies t on t.id = f.trophy_id
    where f.user_id = p_user_id
  ), '[]'::jsonb);
$$;

-- ---- get_gamification: featured mit ausliefern (ersetzt die 0009-Fassung) --------
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
          'trophy_id', t.id,
          'period_type', t.period_type, 'period_start', t.period_start,
          'rank', t.rank, 'total_score', t.total_score, 'awarded_at', t.awarded_at)
        order by t.period_start desc)
      from public.cup_trophies t where t.user_id = auth.uid()), '[]'::jsonb),
    'featured', public.featured_items_json(auth.uid())
  ) into v_result
  from public.player_stats s
  where s.user_id = auth.uid();

  return v_result; -- null, wenn noch keine Stats-Zeile existiert
end;
$$;

-- ---- get_player_card: featured mit ausliefern (ersetzt die 0012-Fassung) ---------
create or replace function public.get_player_card(p_display_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_avatar_id text;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_registered_user() then
    return null;
  end if;

  select p.id, p.avatar_id into v_user_id, v_avatar_id
  from public.profiles p
  where p.display_name = p_display_name
  order by p.last_seen_at desc
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'display_name', p_display_name,
    'avatar_id', v_avatar_id,
    'xp', coalesce(s.xp, 0),
    'trophy_count', coalesce(s.trophy_count, 0),
    'cup_best_score', coalesce(s.cup_best_score, 0),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('badge_id', pb.badge_id, 'tier', pb.tier))
      from (
        select badge_id, max(tier) as tier
        from public.player_badges
        where user_id = v_user_id
        group by badge_id
      ) pb
    ), '[]'::jsonb),
    'mode_bests', coalesce((
      select jsonb_agg(jsonb_build_object('mode', se.mode, 'score', se.best))
      from (
        select mode, max(score) as best
        from public.score_entries
        where user_id = v_user_id and cup_run_id is null
        group by mode
      ) se
    ), '[]'::jsonb),
    'featured', public.featured_items_json(v_user_id)
  ) into v_result
  from (select v_user_id as uid) base
  left join public.player_stats s on s.user_id = base.uid;

  return v_result;
end;
$$;

-- ---- Rechte -------------------------------------------------------------------------
-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.set_featured_items(jsonb) from public, anon;
grant execute on function public.set_featured_items(jsonb) to authenticated;

-- Interner Baustein, kein direkter Client-Zugriff nötig:
revoke execute on function public.featured_items_json(uuid) from public, anon, authenticated;

revoke execute on function public.get_gamification() from public, anon;
grant execute on function public.get_gamification() to authenticated;

revoke execute on function public.get_player_card(text) from public, anon;
grant execute on function public.get_player_card(text) to authenticated;

-- ===== 0015_beta_tester_avatar.sql =====
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

-- ===== 0016_calendar_leaderboard_periods.sql =====
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
