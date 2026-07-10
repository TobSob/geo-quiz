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
