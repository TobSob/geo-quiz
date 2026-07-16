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
