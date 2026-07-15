-- Avatare (Feature-Idee R3): jedes Profil merkt sich seinen gewählten Avatar,
-- damit die Bestenliste die Avatare aller Spieler anzeigen kann.
--
-- Additiv und rückwärtskompatibel: die bestehenden Leaderboard-RPCs bleiben
-- unangetastet; die Zeilen werden im Client über die neue Nur-Lese-RPC
-- get_profile_avatars() nachträglich mit Avataren dekoriert. So kann der Client
-- auch ohne diese Migration weiterlaufen (dann ohne fremde Avatare).

alter table public.profiles
  add column if not exists avatar_id text
  check (avatar_id is null or char_length(avatar_id) <= 32);

-- Avatar je Anzeigename. Gibt bewusst nur display_name + avatar_id aus, nie die
-- user_id; nur für registrierte Accounts (wie die Leaderboards). Bei
-- Namensgleichheit gewinnt das zuletzt aktive Profil.
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

-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.get_profile_avatars(text[]) from public, anon;
grant execute on function public.get_profile_avatars(text[]) to authenticated;
