-- Konto-Löschung durch den Nutzer selbst (DESIGN-PLAYSTORE.md).
--
-- Google Play verlangt seit 2023 für jede App, in der man ein Konto anlegen
-- kann, einen Löschweg IN der App (plus eine öffentliche Web-Seite, die aber
-- nur erklärt und keinen Serveranteil hat).
--
-- Warum eine einzige delete-Anweisung reicht: JEDE Nutzertabelle des Schemas
-- hängt mit `on delete cascade` an auth.users —
--
--   profiles · user_progress · score_entries · cup_runs · play_sessions
--   player_stats · player_badges · cup_trophies · profile_featured_items
--   friend_groups (created_by) · friend_group_members · group_join_attempts
--
-- — Postgres räumt also alles ab, sobald die auth.users-Zeile fällt. Bewusst
-- kein Aufzählen der Tabellen: eine solche Liste veraltet beim nächsten
-- Feature still, und „still veraltet" heißt hier „Nutzerdaten bleiben liegen".
--
-- Nebenwirkung, so gewollt: Löscht der Ersteller einer Freundesgruppe sein
-- Konto, verschwindet die Gruppe samt Mitgliedschaften (nicht die Konten der
-- Mitglieder). Alternative wäre ein Eigentümerwechsel — unnötige Mechanik für
-- ein Quiz-Spiel.
--
-- Sollte Supabase dem Funktionsbesitzer das delete auf auth.users je
-- entziehen, ist der Ersatz eine Edge Function mit Service-Role-Key; die
-- Client-Signatur bliebe gleich.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  -- Ohne Sitzung ein klarer Fehler statt einer stillen No-Op: der Client
  -- würde sonst „gelöscht" melden, obwohl serverseitig nichts passiert ist.
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = uid;
end;
$$;

comment on function public.delete_own_account() is
  'Löscht das eigene Konto samt aller abhängigen Daten (Cascade ab auth.users). '
  'Nimmt bewusst KEINE user_id entgegen — die käme sonst vom Client.';

-- Kein Parameter, also keine Möglichkeit, ein fremdes Konto zu treffen: die
-- Funktion arbeitet ausschließlich auf auth.uid(). `anon` (Key ohne Sitzung)
-- bekommt sie trotzdem nicht; anonyme Spieler haben in Supabase die Rolle
-- `authenticated` mit is_anonymous=true und dürfen ihr Gastkonto löschen —
-- auch daran hängen Profil und Lernfortschritt.
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
