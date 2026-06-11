-- Auftrag 007 – Launch-Härtung: Konto-Löschung, Volljährigkeit

-- 1. FK-Reparatur für Konto-Löschungen.
-- Bereits kaskadierend aus 0001/0005: messages.sender_profile,
-- reviews.reviewer_id, reports.reporter_profile/reported_profile.
-- Verbleibende Lücken:
alter table public.verifications
  drop constraint verifications_reviewed_by_fkey;
alter table public.verifications
  add constraint verifications_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users (id) on delete set null;

-- matches.request_id hätte das Kaskadieren der match_requests blockieren können.
alter table public.matches
  drop constraint matches_request_id_fkey;
alter table public.matches
  add constraint matches_request_id_fkey
    foreign key (request_id) references public.match_requests (id) on delete set null;

-- 2. Volljährigkeit: nur Erwachsene (ab 18).
alter table public.profiles
  drop constraint profiles_birth_year_check;
alter table public.profiles
  add constraint profiles_birth_year_check
    check (birth_year between 1920 and 2008);

-- 3. Konto-Löschung – läuft NUR über diese RPC, löscht immer nur auth.uid().
-- Erst Storage-Objekte, dann auth.users (Kaskade räumt profiles und alles
-- Abhängige inkl. push_tokens und notification_outbox).
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sie sind nicht angemeldet.';
  end if;

  begin
    delete from storage.objects
    where bucket_id in ('verification-docs', 'avatars')
      and (storage.foldername(name))[1] = v_uid::text;
  exception when others then
    raise exception 'Ihre Dateien konnten nicht gelöscht werden – Ihr Konto bleibt unverändert. Bitte versuchen Sie es erneut.';
  end;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
