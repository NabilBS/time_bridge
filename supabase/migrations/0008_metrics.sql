-- Auftrag 008 – Wirkungsmessung: Surveys + KPI-Views (nur Aggregate, n ≥ 5)

create type public.survey_kind as enum ('nps', 'wellbeing_senior', 'relief_family');

-- Befragungs-Rhythmus: 60-Tage-Buckets seit Epoche über eine generierte
-- period-Spalte; der Unique-Index ist die DB-Obergrenze (die UI fragt
-- seltener). Grenzfall dokumentiert: zwei Antworten kurz vor/nach einer
-- Bucket-Grenze sind möglich – akzeptiert, da die UI zusätzlich lokal drosselt.
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.survey_kind not null,
  score integer not null,
  comment text check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  period bigint generated always as (floor(extract(epoch from created_at) / 5184000)::bigint) stored,
  check (
    (kind = 'nps' and score between 0 and 10)
    or (kind <> 'nps' and score between 1 and 5)
  )
);

create unique index surveys_one_per_period
  on public.surveys (profile_id, kind, period);

alter table public.surveys enable row level security;

create policy "surveys_insert_own" on public.surveys
  for insert to authenticated with check (profile_id = auth.uid());

create policy "surveys_select_own" on public.surveys
  for select to authenticated using (profile_id = auth.uid());
-- Kein Lesezugriff auf fremde Antworten – Auswertung nur über Service-Role.

-- KPI-Views: ausschließlich Aggregate, Zellen mit n < 5 als null
-- (verhindert Rückschlüsse auf Einzelpersonen in kleinen Bezirken).
-- Keine Grants für authenticated/anon – nur Service-Role liest.

create view public.kpi_profiles_weekly as
select
  date_trunc('week', created_at)::date as week,
  role::text as role,
  district,
  case when count(*) >= 5 then count(*) end as new_profiles
from public.profiles
group by 1, 2, 3;

create view public.kpi_seniors_by_trust as
select
  trust_level,
  case when count(*) >= 5 then count(*) end as seniors
from public.profiles
where role = 'senior' and is_active = true
group by 1;

create view public.kpi_funnel_weekly as
with req as (
  select date_trunc('week', created_at)::date as week,
         count(*) as requests,
         count(*) filter (where status = 'accepted') as accepted
  from public.match_requests
  group by 1
), mat as (
  select date_trunc('week', created_at)::date as week,
         count(*) as matches
  from public.matches
  group by 1
), matmeet as (
  select date_trunc('week', m.created_at)::date as week,
         count(distinct m.id) as matches_with_completed_meeting
  from public.matches m
  join public.meetings mt on mt.match_id = m.id and mt.status = 'completed'
  group by 1
)
select
  week,
  case when req.requests >= 5 then req.requests end as requests,
  case when req.accepted >= 5 then req.accepted end as accepted,
  case when mat.matches >= 5 then mat.matches end as matches,
  case when matmeet.matches_with_completed_meeting >= 5
       then matmeet.matches_with_completed_meeting end as matches_with_completed_meeting
from req
full join mat using (week)
full join matmeet using (week);

create view public.kpi_meetings_weekly as
with base as (
  select date_trunc('week', scheduled_at)::date as week,
         count(*) filter (where status = 'planned') as planned,
         count(*) filter (where status = 'completed') as completed,
         count(*) filter (where status = 'cancelled') as cancelled
  from public.meetings
  group by 1
), first_meetings as (
  -- Kontrollmetrik für den Trigger aus 0005: Anteil Erst-Treffen an Partner-Orten.
  select date_trunc('week', f.scheduled_at)::date as week,
         count(*) as total_first,
         count(*) filter (where f.partner_location_id is not null) as at_partner
  from (
    select distinct on (match_id) match_id, scheduled_at, partner_location_id
    from public.meetings
    where status in ('planned', 'completed')
    order by match_id, scheduled_at
  ) f
  group by 1
)
select
  week,
  case when base.planned >= 5 then base.planned end as planned,
  case when base.completed >= 5 then base.completed end as completed,
  case when base.cancelled >= 5 then base.cancelled end as cancelled,
  case when first_meetings.total_first >= 5
       then round(100.0 * first_meetings.at_partner / first_meetings.total_first, 1)
  end as first_meeting_partner_pct
from base
full join first_meetings using (week);

create view public.kpi_retention as
select
  (select case when count(*) >= 5 then count(*) end from public.matches) as total_matches,
  case when count(*) >= 5 then count(*) end as matches_with_two_completed
from (
  select match_id
  from public.meetings
  where status = 'completed'
  group by match_id
  having count(*) >= 2
) recurring;

create view public.kpi_surveys_weekly as
select
  date_trunc('week', created_at)::date as week,
  kind::text as kind,
  case when count(*) >= 5 then count(*) end as responses,
  case when count(*) >= 5 then round(avg(score)::numeric, 2) end as avg_score,
  case when kind = 'nps' and count(*) >= 5 then
    round(
      100.0 * (count(*) filter (where score >= 9) - count(*) filter (where score <= 6))
      / count(*),
      0
    )
  end as nps
from public.surveys
group by 1, 2;

-- Nur Service-Role liest die KPI-Views.
revoke all on public.kpi_profiles_weekly from anon, authenticated;
revoke all on public.kpi_seniors_by_trust from anon, authenticated;
revoke all on public.kpi_funnel_weekly from anon, authenticated;
revoke all on public.kpi_meetings_weekly from anon, authenticated;
revoke all on public.kpi_retention from anon, authenticated;
revoke all on public.kpi_surveys_weekly from anon, authenticated;
