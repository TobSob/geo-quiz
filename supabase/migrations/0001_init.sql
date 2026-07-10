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
