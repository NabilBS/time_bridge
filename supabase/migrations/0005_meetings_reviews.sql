-- Auftrag 005 – Treffen am Partner-Ort & Bewertungen
-- Das erste Treffen am verifizierten Partner-Ort wird in der DB erzwungen.

create type public.meeting_status as enum ('planned', 'completed', 'cancelled');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  partner_location_id uuid references public.partner_locations (id),
  scheduled_at timestamptz not null,
  status public.meeting_status not null default 'planned',
  created_at timestamptz not null default now()
);

create index meetings_match_idx on public.meetings (match_id, scheduled_at);

alter table public.meetings enable row level security;

create policy "meetings_select_member" on public.meetings
  for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and (m.profile_a = auth.uid() or m.profile_b = auth.uid())
    )
  );

create policy "meetings_insert_member" on public.meetings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and (m.profile_a = auth.uid() or m.profile_b = auth.uid())
    )
  );

create policy "meetings_update_member" on public.meetings
  for update to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and (m.profile_a = auth.uid() or m.profile_b = auth.uid())
    )
  );

-- 1. Ersttreffen-Pflicht: Solange für das Match noch kein planned/completed
-- Treffen existiert, muss partner_location_id gesetzt und verifiziert sein.
create or replace function public.enforce_first_meeting_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.meetings
    where match_id = new.match_id and status in ('planned', 'completed')
  ) then
    if new.partner_location_id is null then
      raise exception 'Das erste Treffen findet an einem Partner-Ort statt.';
    end if;
    if not exists (
      select 1 from public.partner_locations
      where id = new.partner_location_id and is_verified = true
    ) then
      raise exception 'Das erste Treffen findet an einem Partner-Ort statt.';
    end if;
  end if;
  return new;
end;
$$;

create trigger meetings_enforce_first_location
  before insert on public.meetings
  for each row execute function public.enforce_first_meeting_location();

-- Bewertungen: genau eine je Person und Treffen.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  unique (meeting_id, reviewer_id)
);

alter table public.reviews enable row level security;

-- 2. Einzelkommentare sind nicht öffentlich: nur Match-Mitglieder lesen sie;
-- Aggregate laufen über review_stats. Insert nur durch Match-Mitglied und nur
-- für abgeschlossene Treffen.
create policy "review_read" on public.reviews
  for select to authenticated
  using (
    exists (
      select 1
      from public.meetings mt
      join public.matches m on m.id = mt.match_id
      where mt.id = meeting_id and (m.profile_a = auth.uid() or m.profile_b = auth.uid())
    )
  );

create policy "review_write" on public.reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
      from public.meetings mt
      join public.matches m on m.id = mt.match_id
      where mt.id = meeting_id
        and mt.status = 'completed'
        and (m.profile_a = auth.uid() or m.profile_b = auth.uid())
    )
  );

-- 3. Aggregierte Bewertungen über ein Profil (bewertete Person = das jeweils
-- andere Match-Mitglied). Nur Aggregate, nie Einzelzeilen.
create or replace function public.review_stats(p_profile uuid)
returns table (review_count bigint, avg_stars numeric)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint as review_count,
    round(avg(r.stars)::numeric, 1) as avg_stars
  from public.reviews r
  join public.meetings mt on mt.id = r.meeting_id
  join public.matches m on m.id = mt.match_id
  where p_profile in (m.profile_a, m.profile_b)
    and r.reviewer_id <> p_profile
    and r.reviewer_id in (m.profile_a, m.profile_b);
$$;

revoke execute on function public.review_stats(uuid) from public;
grant execute on function public.review_stats(uuid) to authenticated;

-- 4. Datenhygiene: lange überfällige geplante Treffen automatisch absagen.
select cron.schedule(
  'cancel-stale-meetings',
  '30 3 * * *',
  $$
    update public.meetings
    set status = 'cancelled'
    where status = 'planned'
      and scheduled_at < now() - interval '14 days'
  $$
);
