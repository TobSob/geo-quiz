-- Moderation für Spielernamen (DESIGN-MODERATION.md).
--
-- Play-Richtlinie „Von Nutzern erstellte Inhalte": Namen sind frei wählbar und
-- öffentlich in den Bestenlisten. Diese Migration bringt die drei Teile, die
-- dafür fehlten:
--
--   1. Wortfilter   — Trigger auf profiles.display_name und friend_groups.name
--                     gegen die Tabelle blocked_name_terms
--   2. Melden       — report_display_name(), nur für registrierte Konten
--   3. Entfernen    — View name_reports_open + admin_reset_display_name() /
--                     admin_dismiss_reports(), nur im SQL-Editor aufrufbar
--
-- Gefahrlos mehrfach ausführbar.

-- ---- 1. Wortfilter ------------------------------------------------------------------

-- Gleiche Normalisierung für Namen und Sperrbegriffe: klein, Umlaute
-- ausgeschrieben, Leetspeak zurück, alles außer a–z weg. Wiederholte Buchstaben
-- werden bewusst NICHT zusammengezogen (aus „nigger" würde „niger" → NIGERIA).
create or replace function public.normalize_name_for_filter(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      replace(replace(replace(replace(lower(coalesce(p_name, '')),
        'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
      '013457@$',
      'oieastas'
    ),
    '[^a-z]', '', 'g'
  );
$$;

create table if not exists public.blocked_name_terms (
  -- Bereits normalisiert gespeichert; der Check erzwingt das.
  term text primary key check (term = public.normalize_name_for_filter(term) and char_length(term) >= 3),
  added_at timestamptz not null default now()
);

-- RLS an, keine Policy: über die API weder lesbar noch schreibbar. Gepflegt wird
-- die Liste im SQL-Editor; gelesen nur vom Trigger (security definer).
alter table public.blocked_name_terms enable row level security;

-- Konservativ: nur Begriffe, die kaum in harmlosen Wörtern stecken. Bewusst
-- fehlend (Fehlalarme): anal (KANAL), rape (THERAPEUT), cum, sex (ESSEX),
-- pedo (TORPEDO), cunt (SCUNTHORPE), heil, dick, mongo, 88.
insert into public.blocked_name_terms (term) values
  -- Beleidigungen / Obszönes (de)
  ('fick'), ('fotze'), ('hure'), ('nutte'), ('wichser'), ('wixer'), ('wixxer'),
  ('schlampe'), ('arschloch'), ('hurensohn'), ('missgeburt'), ('spast'),
  ('titten'), ('kinderporn'), ('vergewalt'),
  -- Beleidigungen / Obszönes (en)
  ('fuck'), ('motherf'), ('whore'), ('slut'), ('bitch'), ('asshole'), ('penis'),
  ('vagina'), ('porn'), ('blowjob'), ('pedophil'), ('paedo'), ('paedophil'),
  -- Rassistisches / Homofeindliches
  ('neger'), ('nigger'), ('nigga'), ('kanake'), ('schwuchtel'), ('faggot'),
  ('tranny'),
  -- Extremistisches
  ('hitler'), ('nazi'), ('siegheil'), ('holocaust'), ('auschwitz'), ('kkk')
on conflict (term) do nothing;

create or replace function public.name_is_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.blocked_name_terms b
    where position(b.term in public.normalize_name_for_filter(p_name)) > 0
  );
$$;

create or replace function public.enforce_name_filter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Spaltenname kommt als Trigger-Argument. Nicht per `case … new.display_name
  -- … new.name`: PL/pgSQL löst beide Feldzugriffe auf, und auf profiles gibt es
  -- kein `name` → jede Profil-Anlage würde scheitern (im lokalen Test gefunden).
  v_name text := to_jsonb(new) ->> tg_argv[0];
begin
  if not public.name_is_allowed(v_name) then
    -- Der Client erkennt genau diesen Text (authApi/groupApi).
    raise exception 'name_not_allowed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_name_filter on public.profiles;
create trigger profiles_name_filter
  before insert or update of display_name on public.profiles
  for each row execute function public.enforce_name_filter('display_name');

drop trigger if exists friend_groups_name_filter on public.friend_groups;
create trigger friend_groups_name_filter
  before insert or update of name on public.friend_groups
  for each row execute function public.enforce_name_filter('name');

revoke execute on function public.name_is_allowed(text) from public, anon, authenticated;

-- ---- 2. Melden ----------------------------------------------------------------------

create table if not exists public.name_reports (
  id bigint generated always as identity primary key,
  -- Beide Seiten hängen per Cascade an auth.users: die Konto-Löschung (0017)
  -- bleibt eine einzige Anweisung, und Meldungen über gelöschte Konten
  -- verschwinden mit ihnen.
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  -- Name zum Meldezeitpunkt — nach einer Umbenennung sonst nicht mehr
  -- nachvollziehbar, worum es ging.
  reported_name text not null check (char_length(reported_name) <= 24),
  reason text not null check (reason in ('insult', 'sexual', 'extremist', 'other')),
  created_at timestamptz not null default now(),
  unique (reporter_id, reported_user_id, reported_name)
);

create index if not exists name_reports_reporter_time
  on public.name_reports (reporter_id, created_at);

-- RLS an, keine Policy: geschrieben nur über report_display_name(), gelesen nur
-- im SQL-Editor.
alter table public.name_reports enable row level security;

create or replace function public.report_display_name(p_display_name text, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_rows integer;
begin
  if auth.uid() is null or not public.is_registered_user() then
    raise exception 'registered account required';
  end if;
  if p_reason not in ('insult', 'sexual', 'extremist', 'other') then
    raise exception 'invalid reason';
  end if;

  -- Gleiche Auflösung wie get_player_card (0012/0014): Namen sind nicht
  -- eindeutig, gemeint ist der zuletzt aktive Träger.
  select p.id into v_target
  from public.profiles p
  where p.display_name = p_display_name
  order by p.last_seen_at desc
  limit 1;

  if v_target is null then
    return 'not_found';
  end if;
  if v_target = auth.uid() then
    return 'self';
  end if;
  if (select count(*) from public.name_reports
      where reporter_id = auth.uid()
        and created_at > now() - interval '24 hours') >= 20 then
    return 'rate_limited';
  end if;

  insert into public.name_reports (reporter_id, reported_user_id, reported_name, reason)
    values (auth.uid(), v_target, p_display_name, p_reason)
    on conflict (reporter_id, reported_user_id, reported_name) do nothing;
  get diagnostics v_rows = row_count;

  return case when v_rows = 0 then 'duplicate' else 'ok' end;
end;
$$;

revoke execute on function public.report_display_name(text, text) from public, anon;
grant execute on function public.report_display_name(text, text) to authenticated;

-- ---- 3. Entfernen (nur SQL-Editor / service_role) -----------------------------------

create or replace view public.name_reports_open as
select
  r.reported_user_id,
  p.display_name as current_name,
  count(*) as report_count,
  array_agg(distinct r.reported_name) as reported_names,
  array_agg(distinct r.reason) as reasons,
  min(r.created_at) as first_reported,
  max(r.created_at) as last_reported
from public.name_reports r
left join public.profiles p on p.id = r.reported_user_id
group by r.reported_user_id, p.display_name
order by count(*) desc, max(r.created_at) desc;

revoke all on public.name_reports_open from public, anon, authenticated;

-- Setzt den Namen auf PLAYER_XXXX, löscht die Meldungen zu diesem Konto und
-- nimmt optional einen Begriff in die Sperrliste auf (damit derselbe Name nicht
-- fünf Minuten später wieder da ist). Aufruf im SQL-Editor:
--   select public.admin_reset_display_name('<uuid>', 'begriff');
create or replace function public.admin_reset_display_name(p_user_id uuid, p_block_term text default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_new text := 'PLAYER_' || upper(substr(md5(p_user_id::text), 1, 4));
begin
  if p_block_term is not null and public.normalize_name_for_filter(p_block_term) <> '' then
    insert into public.blocked_name_terms (term)
      values (public.normalize_name_for_filter(p_block_term))
      on conflict (term) do nothing;
  end if;

  update public.profiles set display_name = v_new where id = p_user_id;
  if not found then
    raise exception 'profile not found';
  end if;

  delete from public.name_reports where reported_user_id = p_user_id;
  return v_new;
end;
$$;

-- Meldungen ohne Folgen verwerfen.
create or replace function public.admin_dismiss_reports(p_user_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  delete from public.name_reports where reported_user_id = p_user_id;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Weder anon NOCH authenticated: sonst könnte jeder mit dem öffentlichen
-- Anon-Key + Gastsitzung fremde Namen zurücksetzen.
revoke execute on function public.admin_reset_display_name(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_dismiss_reports(uuid) from public, anon, authenticated;

-- ---- Prüfabfrage nach dem Einspielen ------------------------------------------------
-- Der Trigger prüft nur neue/geänderte Namen. Bestehende Verstöße auflisten:
--
--   select p.id, p.display_name from public.profiles p
--   where not public.name_is_allowed(p.display_name);
--
--   select g.id, g.name from public.friend_groups g
--   where not public.name_is_allowed(g.name);
