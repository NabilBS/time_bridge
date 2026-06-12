-- Auftrag 004 – Matching & Chat: Doppel-Opt-in wird in der Datenbank erzwungen.

-- 1. RLS-Härtung match_requests: req_respond erlaubte Beteiligten beliebige
-- Updates – damit hätte der Absender selbst auf 'accepted' stellen können.
drop policy "req_respond" on public.match_requests;

create policy "req_withdraw_sender" on public.match_requests
  for update to authenticated
  using (from_profile = auth.uid() and status = 'pending')
  with check (from_profile = auth.uid() and status = 'withdrawn');

create policy "req_decline_recipient" on public.match_requests
  for update to authenticated
  using (to_profile = auth.uid() and status = 'pending')
  with check (to_profile = auth.uid() and status = 'declined');

-- responded_at wird automatisch gesetzt, sobald eine Anfrage beantwortet wird.
create or replace function public.set_responded_at()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    new.responded_at = now();
  end if;
  return new;
end;
$$;

create trigger match_requests_set_responded_at
  before update on public.match_requests
  for each row execute function public.set_responded_at();

-- 2. Annahme ausschließlich über diese RPC ('accepted' ist per Update unmöglich).
create or replace function public.accept_match_request(p_request uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.match_requests%rowtype;
  v_a uuid;
  v_b uuid;
  v_match uuid;
begin
  select * into req from public.match_requests where id = p_request for update;

  if not found then
    raise exception 'Anfrage nicht gefunden.';
  end if;
  if req.to_profile <> auth.uid() then
    raise exception 'Nur die empfangende Person kann eine Anfrage annehmen.';
  end if;
  if req.status <> 'pending' then
    raise exception 'Diese Anfrage ist nicht mehr offen.';
  end if;
  if not exists (
    select 1 from public.profiles where id = req.from_profile and is_active = true
  ) or not exists (
    select 1 from public.profiles where id = req.to_profile and is_active = true
  ) then
    raise exception 'Dieses Profil ist nicht mehr aktiv.';
  end if;

  update public.match_requests
  set status = 'accepted', responded_at = now()
  where id = p_request;

  v_a := least(req.from_profile, req.to_profile);
  v_b := greatest(req.from_profile, req.to_profile);

  select id into v_match from public.matches where profile_a = v_a and profile_b = v_b;
  if v_match is null then
    insert into public.matches (profile_a, profile_b, request_id)
    values (v_a, v_b, p_request)
    returning id into v_match;
  end if;

  return v_match;
end;
$$;

revoke execute on function public.accept_match_request(uuid) from public;
grant execute on function public.accept_match_request(uuid) to authenticated;

-- 3. Realtime für Chat-Nachrichten. Realtime respektiert RLS – der Negativtest
-- (Dritter empfängt keine Events eines fremden Matches) ist in supabase/CLAUDE.md
-- dokumentiert und gehört zum Abnahmepaket.
alter publication supabase_realtime add table public.messages;

-- 4. Entdecken-Performance
create index profiles_discover_idx
  on public.profiles (role, district, trust_level)
  where is_active = true;
