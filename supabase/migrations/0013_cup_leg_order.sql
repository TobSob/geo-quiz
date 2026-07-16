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
