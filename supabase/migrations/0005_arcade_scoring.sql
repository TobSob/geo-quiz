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
