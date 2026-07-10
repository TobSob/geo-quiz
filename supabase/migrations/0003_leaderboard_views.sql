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
