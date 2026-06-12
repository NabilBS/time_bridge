-- Auftrag 006 – Benachrichtigungen (Outbox-Pattern, Datensparsamkeit)

-- 1. Push-Tokens: nur eigene Zeilen sicht-/schreibbar.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own" on public.push_tokens
  for select to authenticated using (profile_id = auth.uid());

create policy "push_tokens_insert_own" on public.push_tokens
  for insert to authenticated with check (profile_id = auth.uid());

create policy "push_tokens_delete_own" on public.push_tokens
  for delete to authenticated using (profile_id = auth.uid());

-- 2. Schalter je Kategorie. Geändert über das bestehende profiles_update_own.
alter table public.profiles
  add column notification_prefs jsonb not null default '{}'::jsonb;

-- 3. Outbox – rein intern (keine RLS-Policy ⇒ nur Service-Role greift zu).
create type public.notification_kind as enum (
  'request_received',
  'request_accepted',
  'message_received',
  'verification_decided',
  'meeting_reminder'
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0
);

alter table public.notification_outbox enable row level security;
-- bewusst keine Policy: Nutzer haben keinerlei Zugriff.

create index notification_outbox_unsent_idx
  on public.notification_outbox (created_at)
  where sent_at is null;

-- Erinnerungen nicht doppelt einreihen.
create unique index notification_outbox_reminder_dedup
  on public.notification_outbox (recipient_id, (payload ->> 'meeting_id'))
  where kind = 'meeting_reminder';

-- Opt-out-Prüfung: fehlender Schlüssel = an.
create or replace function public.notif_enabled(p_recipient uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (notification_prefs ->> p_kind) is distinct from 'false'
     from public.profiles where id = p_recipient),
    true
  );
$$;

create or replace function public.enqueue_notification(
  p_recipient uuid,
  p_kind public.notification_kind,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null then
    return;
  end if;
  if not public.notif_enabled(p_recipient, p_kind::text) then
    return; -- Opt-out: gar nicht erst einreihen
  end if;
  insert into public.notification_outbox (recipient_id, kind, payload)
  values (p_recipient, p_kind, p_payload);
end;
$$;

-- 4. Trigger befüllen die Outbox (nur IDs + Anzeigename, nie Inhalte).
create or replace function public.notify_request_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare from_name text;
begin
  select display_name into from_name from public.profiles where id = new.from_profile;
  perform public.enqueue_notification(
    new.to_profile, 'request_received',
    jsonb_build_object('from_profile', new.from_profile, 'name', from_name)
  );
  return new;
end;
$$;

create trigger match_requests_notify_received
  after insert on public.match_requests
  for each row execute function public.notify_request_received();

create or replace function public.notify_request_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sender uuid; v_accepter uuid; v_name text;
begin
  select from_profile, to_profile into v_sender, v_accepter
  from public.match_requests where id = new.request_id;
  if v_sender is null then
    return new;
  end if;
  select display_name into v_name from public.profiles where id = v_accepter;
  perform public.enqueue_notification(
    v_sender, 'request_accepted',
    jsonb_build_object('match_id', new.id, 'profile_id', v_accepter, 'name', v_name)
  );
  return new;
end;
$$;

create trigger matches_notify_accepted
  after insert on public.matches
  for each row execute function public.notify_request_accepted();

create or replace function public.notify_message_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_match record; v_recipient uuid; v_name text;
begin
  select profile_a, profile_b into v_match from public.matches where id = new.match_id;
  v_recipient := case when v_match.profile_a = new.sender_profile
                      then v_match.profile_b else v_match.profile_a end;
  select display_name into v_name from public.profiles where id = new.sender_profile;
  -- bewusst ohne new.body
  perform public.enqueue_notification(
    v_recipient, 'message_received',
    jsonb_build_object('match_id', new.match_id, 'from_profile', new.sender_profile, 'name', v_name)
  );
  return new;
end;
$$;

create trigger messages_notify_received
  after insert on public.messages
  for each row execute function public.notify_message_received();

create or replace function public.notify_verification_decided()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved', 'rejected', 'expired')
     and new.status is distinct from old.status then
    perform public.enqueue_notification(
      new.profile_id, 'verification_decided',
      jsonb_build_object('verification_id', new.id, 'type', new.type, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger verifications_notify_decided
  after update on public.verifications
  for each row execute function public.notify_verification_decided();

-- 5. Treffen-Erinnerung: stündlich, 23–24 h vor scheduled_at, dedupliziert.
select cron.schedule(
  'meeting-reminders',
  '5 * * * *',
  $$
    insert into public.notification_outbox (recipient_id, kind, payload)
    select member, 'meeting_reminder',
           jsonb_build_object('meeting_id', mt.id, 'match_id', mt.match_id,
                              'scheduled_at', mt.scheduled_at)
    from public.meetings mt
    join public.matches m on m.id = mt.match_id
    cross join lateral (values (m.profile_a), (m.profile_b)) as members(member)
    where mt.status = 'planned'
      and mt.scheduled_at between now() + interval '23 hours' and now() + interval '24 hours'
      and public.notif_enabled(member, 'meeting_reminder')
      and not exists (
        select 1 from public.notification_outbox o
        where o.recipient_id = member
          and o.kind = 'meeting_reminder'
          and o.payload ->> 'meeting_id' = mt.id::text
      )
  $$
);

-- 6. Atomarer Claim für die Edge Function: zwei parallele Läufe greifen dank
-- "for update skip locked" nie dieselbe Zeile (kein Doppelversand).
create or replace function public.claim_outbox_batch(p_limit integer default 100)
returns setof public.notification_outbox
language sql
security definer
set search_path = public
as $$
  update public.notification_outbox o
  set attempts = attempts + 1
  where o.id in (
    select id from public.notification_outbox
    where sent_at is null and attempts < 5
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning o.*;
$$;

revoke execute on function public.claim_outbox_batch(integer) from public;
grant execute on function public.claim_outbox_batch(integer) to service_role;
