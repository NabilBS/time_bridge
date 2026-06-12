-- Zeitbrücke – Initiales Schema (Vertrag, Änderungen nur per Freigabe)

create type public.user_role as enum ('senior', 'family');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text not null check (char_length(display_name) between 2 and 60),
  birth_year integer not null check (birth_year between 1920 and 2012),
  interests text[] not null default '{}',
  district text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  bio text check (char_length(bio) <= 600),
  trust_level integer not null default 1 check (trust_level between 1 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bewusst ohne Namen, Fotos oder Geburtsdaten von Kindern.
create table public.family_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  children_count integer not null check (children_count between 1 and 10),
  age_min integer not null check (age_min between 0 and 17),
  age_max integer not null check (age_max between 0 and 17),
  care_wishes text not null check (char_length(care_wishes) between 1 and 600),
  check (age_max >= age_min)
);

create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  time_from time not null,
  time_to time not null,
  check (time_to > time_from),
  unique (profile_id, weekday, time_from, time_to)
);

alter table public.profiles enable row level security;
alter table public.family_details enable row level security;
alter table public.availabilities enable row level security;

-- Gesperrte Profile (is_active = false) sind nur noch für sich selbst sichtbar.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (is_active = true or id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "family_details_select_own" on public.family_details
  for select to authenticated using (profile_id = auth.uid());

create policy "family_details_insert_own" on public.family_details
  for insert to authenticated with check (profile_id = auth.uid());

create policy "family_details_update_own" on public.family_details
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "availabilities_select_authenticated" on public.availabilities
  for select to authenticated using (true);

create policy "availabilities_insert_own" on public.availabilities
  for insert to authenticated with check (profile_id = auth.uid());

create policy "availabilities_update_own" on public.availabilities
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "availabilities_delete_own" on public.availabilities
  for delete to authenticated using (profile_id = auth.uid());

-- Verifizierungen: Nachweise je Vertrauensstufe. Prüfung läuft über die
-- Service-Role (Pilot: Supabase Studio) – Nutzer dürfen nur einreichen und lesen.
create type public.verification_type as enum (
  'video_ident',
  'background_check',
  'first_aid_child',
  'training_course',
  'partner_reference'
);

create type public.verification_status as enum ('submitted', 'approved', 'rejected', 'expired');

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type public.verification_type not null,
  status public.verification_status not null default 'submitted',
  document_path text,
  valid_until date,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.verifications enable row level security;

create policy "verifications_select_own" on public.verifications
  for select to authenticated using (profile_id = auth.uid());

create policy "verifications_insert_own" on public.verifications
  for insert to authenticated
  with check (profile_id = auth.uid() and status = 'submitted');

-- Kein UPDATE/DELETE für Nutzer: Statuswechsel nur über Service-Role.

-- Vertrauensstufe wird ausschließlich aus den Verifizierungen abgeleitet:
-- Stufe 2 = Video-Ident bestätigt, Stufe 3 = zusätzlich erweitertes
-- Führungszeugnis bestätigt. App-Code schreibt trust_level nie selbst.
create or replace function public.recompute_trust_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_profile uuid := coalesce(new.profile_id, old.profile_id);
  has_video_ident boolean;
  has_background_check boolean;
begin
  select
    bool_or(type = 'video_ident' and status = 'approved'),
    bool_or(type = 'background_check' and status = 'approved')
  into has_video_ident, has_background_check
  from public.verifications
  where profile_id = affected_profile;

  update public.profiles
  set trust_level = case
    when coalesce(has_video_ident, false) and coalesce(has_background_check, false) then 3
    when coalesce(has_video_ident, false) then 2
    else 1
  end
  where id = affected_profile;

  return coalesce(new, old);
end;
$$;

create trigger verifications_recompute_trust_level
  after insert or update or delete on public.verifications
  for each row execute function public.recompute_trust_level();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Meldungen: Nutzer melden Profile; Bearbeitung über Service-Role (Web-Admin).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile uuid not null references public.profiles (id) on delete cascade,
  reported_profile uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text check (char_length(details) <= 600),
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  check (reporter_profile <> reported_profile)
);

alter table public.reports enable row level security;

create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (reporter_profile = auth.uid());

create policy "reports_select_own" on public.reports
  for select to authenticated using (reporter_profile = auth.uid());

-- Partner-Orte: gepflegt über Service-Role; in der App nur verifizierte sichtbar.
create type public.partner_kind as enum (
  'mehrgenerationenhaus',
  'stadtteilzentrum',
  'familienzentrum',
  'bibliothek',
  'nachbarschaftstreff',
  'gemeindezentrum'
);

create table public.partner_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.partner_kind not null,
  street text,
  postal_code text,
  district text not null,
  lat double precision,
  lng double precision,
  contact text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.partner_locations enable row level security;

create policy "partner_locations_select_verified" on public.partner_locations
  for select to authenticated using (is_verified = true);

-- Matching: Anfrage → Doppel-Opt-in → Match → Chat.
create type public.match_request_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

create table public.match_requests (
  id uuid primary key default gen_random_uuid(),
  from_profile uuid not null references public.profiles (id) on delete cascade,
  to_profile uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 600),
  status public.match_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_profile <> to_profile)
);

-- Je Richtung höchstens eine offene Anfrage (Doppel-Anfrage wird in der DB verhindert).
create unique index match_requests_one_pending
  on public.match_requests (from_profile, to_profile)
  where status = 'pending';

alter table public.match_requests enable row level security;

create policy "req_select_involved" on public.match_requests
  for select to authenticated
  using (from_profile = auth.uid() or to_profile = auth.uid());

create policy "req_insert_own" on public.match_requests
  for insert to authenticated
  with check (
    from_profile = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = to_profile and p.is_active = true
    )
  );

-- Hinweis: wird in 0004_matching.sql durch enge Policies ersetzt
-- (Absender nur pending→withdrawn, Empfänger nur pending→declined).
create policy "req_respond" on public.match_requests
  for update to authenticated
  using (from_profile = auth.uid() or to_profile = auth.uid());

-- Matches entstehen ausschließlich über die RPC accept_match_request (0004);
-- Nutzer haben bewusst kein Insert-/Update-Recht.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_a uuid not null references public.profiles (id) on delete cascade,
  profile_b uuid not null references public.profiles (id) on delete cascade,
  request_id uuid references public.match_requests (id),
  created_at timestamptz not null default now(),
  check (profile_a < profile_b),
  unique (profile_a, profile_b)
);

alter table public.matches enable row level security;

create policy "matches_select_involved" on public.matches
  for select to authenticated
  using (profile_a = auth.uid() or profile_b = auth.uid());

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_profile uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_match_created_idx on public.messages (match_id, created_at);

alter table public.messages enable row level security;

create policy "messages_select_involved" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.profile_a = auth.uid() or m.profile_b = auth.uid())
    )
  );

create policy "messages_insert_own" on public.messages
  for insert to authenticated
  with check (
    sender_profile = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.profile_a = auth.uid() or m.profile_b = auth.uid())
    )
  );
