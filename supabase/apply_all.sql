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


