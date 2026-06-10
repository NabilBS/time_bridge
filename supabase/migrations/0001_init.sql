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

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

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
