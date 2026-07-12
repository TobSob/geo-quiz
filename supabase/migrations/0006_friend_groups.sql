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
