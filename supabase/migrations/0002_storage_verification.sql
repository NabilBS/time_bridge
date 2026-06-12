-- Auftrag 002 – Storage, Doppel-Einreichung, Wiedervorlage

-- 1. Buckets (per Migration, nicht per Dashboard)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'verification-docs',
    'verification-docs',
    false,
    10485760, -- 10 MB
    array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
  )
on conflict (id) do nothing;

-- 2. Storage-Policies
-- verification-docs: erster Pfadbestandteil muss auth.uid() sein.
-- Kein UPDATE/DELETE für Nutzer – Prüfung und Löschung laufen über die Service-Role.
create policy "verification_docs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_docs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- avatars: öffentlich lesbar, schreiben nur in den eigenen Pfad
create policy "avatars_select_public" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Doppel-Einreichung verhindern: je Profil und Typ höchstens eine offene Einreichung
create unique index verifications_one_submitted_per_type
  on public.verifications (profile_id, type)
  where status = 'submitted';

-- 4. Wiedervorlage: abgelaufene Freigaben täglich auf 'expired' setzen.
-- Der Trigger aus 0001_init.sql senkt die Vertrauensstufe dann von selbst.
create extension if not exists pg_cron;

select cron.schedule(
  'expire-verifications',
  '15 3 * * *',
  $$
    update public.verifications
    set status = 'expired'
    where status = 'approved'
      and valid_until is not null
      and valid_until < current_date
  $$
);
