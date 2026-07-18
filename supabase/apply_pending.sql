-- apply_pending.sql — für die Live-DB noch ausstehende Migrationen.
-- Stand 2026-07-18: 0001–0012 sind eingespielt; hier folgen 0013 + 0014.
-- Im Supabase-Dashboard (SQL Editor) als EIN Skript ausführen, danach
-- diese Datei löschen und supabase/README.md (Live-DB-Stand) aktualisieren.

-- ============================================================================
-- 0013_cup_leg_order.sql
-- ============================================================================

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

-- ============================================================================
-- 0014_profile_featured_items.sql
-- ============================================================================

-- Pokalregal (Phase I3/I4, DESIGN-GAMIFICATION.md): Jeder Spieler kann bis zu
-- 6 Regal-Plätze auf seiner öffentlichen Spielerkarte frei mit eigenen
-- Abzeichen und Pokalen bestücken (gemischt, frei angeordnet —
-- Nutzer-Entscheid 2026-07-18). Ohne Kuration zeigt der Client wie bisher
-- die Top-Abzeichen (Fallback im Frontend, nie ein leeres Regal).
--
-- Schreibzugriff NUR über set_featured_items() mit serverseitigem
-- Ownership-Check — niemand stellt sich fremde Pokale ins Regal.
-- Setzt Migrationen 0008/0009 (Badges/Pokale) und 0012 (get_player_card)
-- voraus. Gefahrlos mehrfach ausführbar bis auf den create-table-Block.

-- ---- Tabelle -------------------------------------------------------------------
create table if not exists public.profile_featured_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 6),
  item_type text not null check (item_type in ('badge', 'trophy')),
  badge_id text,
  badge_tier smallint check (badge_tier between 1 and 5),
  trophy_id bigint references public.cup_trophies (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  -- Genau EIN Item-Typ je Zeile, vollständig ausgefüllt:
  check (
    (item_type = 'badge' and badge_id is not null and badge_tier is not null
      and trophy_id is null)
    or
    (item_type = 'trophy' and trophy_id is not null
      and badge_id is null and badge_tier is null)
  )
);

alter table public.profile_featured_items enable row level security;

drop policy if exists "featured: read own" on public.profile_featured_items;
create policy "featured: read own" on public.profile_featured_items
  for select using (auth.uid() = user_id);
-- Fremde Regale laufen über get_player_card() (security definer, name-basiert);
-- Mutationen ausschließlich über set_featured_items().

-- ---- set_featured_items: Regal komplett ersetzen ---------------------------------
-- Payload: jsonb-Array, max. 6 Einträge, z. B.
--   [{"slot":1,"item_type":"badge","badge_id":"sniper","tier":3},
--    {"slot":2,"item_type":"trophy","trophy_id":5}]
-- Ownership wird je Item geprüft (player_badges bzw. cup_trophies.user_id);
-- doppelte Slots scheitern am Primary Key. Alles-oder-nichts (eine Transaktion).
create or replace function public.set_featured_items(p_items jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  item jsonb;
  v_slot smallint;
  v_type text;
  v_badge_id text;
  v_tier smallint;
  v_trophy_id bigint;
begin
  if v_uid is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid payload';
  end if;
  if jsonb_array_length(p_items) > 6 then
    raise exception 'too many items';
  end if;

  delete from public.profile_featured_items where user_id = v_uid;

  for item in select * from jsonb_array_elements(p_items) loop
    v_slot := (item->>'slot')::smallint;
    v_type := item->>'item_type';

    if v_type = 'badge' then
      v_badge_id := item->>'badge_id';
      v_tier := (item->>'tier')::smallint;
      if not exists (
        select 1 from public.player_badges b
        where b.user_id = v_uid and b.badge_id = v_badge_id and b.tier = v_tier
      ) then
        raise exception 'badge not owned';
      end if;
      insert into public.profile_featured_items
        (user_id, slot, item_type, badge_id, badge_tier)
      values (v_uid, v_slot, 'badge', v_badge_id, v_tier);

    elsif v_type = 'trophy' then
      v_trophy_id := (item->>'trophy_id')::bigint;
      if not exists (
        select 1 from public.cup_trophies t
        where t.id = v_trophy_id and t.user_id = v_uid
      ) then
        raise exception 'trophy not owned';
      end if;
      insert into public.profile_featured_items
        (user_id, slot, item_type, trophy_id)
      values (v_uid, v_slot, 'trophy', v_trophy_id);

    else
      raise exception 'invalid item type';
    end if;
  end loop;
end;
$$;

-- ---- featured_items_json: gemeinsamer Baustein der Lese-RPCs ---------------------
-- Pokal-Slots werden direkt mit Periode/Rang/Score aufgelöst, damit der
-- Betrachter einer FREMDEN Karte keine weitere Abfrage braucht.
create or replace function public.featured_items_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
        'slot', f.slot,
        'item_type', f.item_type,
        'badge_id', f.badge_id,
        'tier', f.badge_tier,
        'trophy_id', f.trophy_id,
        'period_type', t.period_type,
        'period_start', t.period_start,
        'rank', t.rank,
        'total_score', t.total_score)
      order by f.slot)
    from public.profile_featured_items f
    left join public.cup_trophies t on t.id = f.trophy_id
    where f.user_id = p_user_id
  ), '[]'::jsonb);
$$;

-- ---- get_gamification: featured mit ausliefern (ersetzt die 0009-Fassung) --------
create or replace function public.get_gamification()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_registered_user() then
    return null; -- Gäste sehen den Teaser, kein Fehler
  end if;
  perform public.finalize_cup_trophies();

  select jsonb_build_object(
    'stats', to_jsonb(s.*) - 'user_id',
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object(
          'badge_id', b.badge_id, 'tier', b.tier, 'awarded_at', b.awarded_at)
        order by b.awarded_at asc, b.badge_id, b.tier)
      from public.player_badges b where b.user_id = auth.uid()), '[]'::jsonb),
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object(
          'trophy_id', t.id,
          'period_type', t.period_type, 'period_start', t.period_start,
          'rank', t.rank, 'total_score', t.total_score, 'awarded_at', t.awarded_at)
        order by t.period_start desc)
      from public.cup_trophies t where t.user_id = auth.uid()), '[]'::jsonb),
    'featured', public.featured_items_json(auth.uid())
  ) into v_result
  from public.player_stats s
  where s.user_id = auth.uid();

  return v_result; -- null, wenn noch keine Stats-Zeile existiert
end;
$$;

-- ---- get_player_card: featured mit ausliefern (ersetzt die 0012-Fassung) ---------
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
    ), '[]'::jsonb),
    'featured', public.featured_items_json(v_user_id)
  ) into v_result
  from (select v_user_id as uid) base
  left join public.player_stats s on s.user_id = base.uid;

  return v_result;
end;
$$;

-- ---- Rechte -------------------------------------------------------------------------
-- CREATE FUNCTION gewährt PUBLIC automatisch EXECUTE — einsammeln, dann gezielt.
revoke execute on function public.set_featured_items(jsonb) from public, anon;
grant execute on function public.set_featured_items(jsonb) to authenticated;

-- Interner Baustein, kein direkter Client-Zugriff nötig:
revoke execute on function public.featured_items_json(uuid) from public, anon, authenticated;

revoke execute on function public.get_gamification() from public, anon;
grant execute on function public.get_gamification() to authenticated;

revoke execute on function public.get_player_card(text) from public, anon;
grant execute on function public.get_player_card(text) to authenticated;
