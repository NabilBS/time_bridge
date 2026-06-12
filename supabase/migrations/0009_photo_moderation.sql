-- Auftrag 009 – Profilfotos mit Moderation
-- Kein Foto erreicht andere Nutzer ohne Freigabe (Muster wie Verifizierungen).

-- Profilfoto-Pfad im öffentlichen avatars-Bucket; wird NUR von der
-- Freigabe-Action (Service-Role) geschrieben, nie vom Nutzer.
alter table public.profiles add column photo_path text;

-- Lücke schließen: profiles_update_own erlaubte bisher Updates auf alle
-- Spalten – damit hätten Nutzer photo_path (Moderation umgehen) oder
-- trust_level direkt setzen können. Spaltenbasierte Grants statt Policy-
-- Umbau: RLS regelt weiterhin WELCHE Zeilen, die Grants regeln WELCHE
-- Spalten. Trigger (security definer) und Service-Role sind nicht betroffen.
revoke insert, update on public.profiles from authenticated;
grant insert (id, role, display_name, birth_year, interests, district, postal_code, bio)
  on public.profiles to authenticated;
grant update (display_name, birth_year, interests, district, postal_code, bio, notification_prefs)
  on public.profiles to authenticated;

-- 1. Privater Bucket für eingereichte Fotos – „public" hieße: jeder mit URL
-- kann lesen, und genau das darf vor der Freigabe nicht passieren.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars-pending',
  'avatars-pending',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 2. Einreichungen
create table public.photo_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  status public.verification_status not null default 'submitted',
  review_note text,
  created_at timestamptz not null default now()
);

alter table public.photo_submissions enable row level security;

create policy "photo_submissions_select_own" on public.photo_submissions
  for select to authenticated using (profile_id = auth.uid());

create policy "photo_submissions_insert_own" on public.photo_submissions
  for insert to authenticated
  with check (profile_id = auth.uid() and status = 'submitted');
-- Kein UPDATE/DELETE für Nutzer: Prüfung läuft über die Service-Role.

-- Nur eine offene Einreichung je Profil.
create unique index photo_submissions_one_open_per_profile
  on public.photo_submissions (profile_id)
  where status = 'submitted';

-- 3. Storage-Policies – identisches Muster wie verification-docs.
create policy "avatars_pending_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars-pending'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_pending_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars-pending'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
