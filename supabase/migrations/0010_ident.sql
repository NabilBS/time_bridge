-- Auftrag 010 – Video-Ident-Integration (anbieterneutral)
-- Datenminimierung: nur bestanden/nicht bestanden + Anbieter-Referenz –
-- keine Ausweisdaten, kein Geburtsdatum, keine Bilddaten.

create type public.ident_session_status as enum ('created', 'completed', 'failed', 'expired');

create table public.ident_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  -- Interne Anbieter-Referenz, nicht im Shared-Schema – der Client braucht sie nie.
  provider_session_id text not null unique,
  status public.ident_session_status not null default 'created',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.ident_sessions enable row level security;

create policy "ident_sessions_select_own" on public.ident_sessions
  for select to authenticated using (profile_id = auth.uid());
-- Insert/Update nur über die Service-Role (Edge Functions).

-- Doppelstart verhindern: eine offene Session je Profil.
create unique index ident_sessions_one_open_per_profile
  on public.ident_sessions (profile_id)
  where status = 'created';

-- Aufräum-Job: hängengebliebene Sessions nach 24 h ablaufen lassen –
-- danach ist ein erneuter Start möglich.
select cron.schedule(
  'expire-ident-sessions',
  '45 * * * *',
  $$
    update public.ident_sessions
    set status = 'expired'
    where status = 'created'
      and created_at < now() - interval '24 hours'
  $$
);
