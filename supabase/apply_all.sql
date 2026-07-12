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
