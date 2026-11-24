begin;

alter table public.ride_requests
  add column if not exists "acceptedRideId" uuid references public.rides ("rideId");

-- Preserve the shipped requests → rides embed after adding a second foreign key.
-- This computed relationship runs with the caller's existing rides SELECT policy.
create or replace function public.rides(request_row public.ride_requests)
returns setof public.rides rows 1
language sql stable security invoker set search_path = public
as $$
  select r.* from public.rides r
  where r."rideId" = coalesce(request_row."acceptedRideId", request_row."selectedRideId")
$$;

revoke all on function public.rides(public.ride_requests) from public, anon;
grant execute on function public.rides(public.ride_requests) to authenticated;

create table if not exists public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  "requestId" uuid not null references public.ride_requests (id) on delete cascade,
  "rideId" uuid not null references public.rides ("rideId") on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'taken', 'cancelled')),
  fare numeric check (fare >= 0 and fare < 'Infinity'::numeric),
  "createdAt" timestamptz not null default now(),
  unique ("requestId", "rideId")
);

create index if not exists ride_offers_ride_status_idx on public.ride_offers ("rideId", status);
create index if not exists ride_requests_accepted_ride_idx on public.ride_requests ("acceptedRideId");
create unique index if not exists ride_offers_one_accepted_idx
  on public.ride_offers ("requestId") where status = 'accepted';

-- Preserve legacy links while the clients move to offers. A historical fare can be unknown.
insert into public.ride_offers ("requestId", "rideId", status, fare, "createdAt")
select q.id, r."rideId", q.status,
       case
         when q.status <> 'pending' and q.price >= 0 and q.price < 'Infinity'::numeric then q.price
         else round(r."pricePerKm" * q."directKm", 2)
       end,
       coalesce(q.created_at, now())
from public.ride_requests q
join public.rides r on r."rideId" = q."selectedRideId"
where q.status in ('pending', 'accepted', 'declined', 'cancelled')
on conflict ("requestId", "rideId") do nothing;

update public.ride_requests q
set "acceptedRideId" = o."rideId"
from public.ride_offers o
where o."requestId" = q.id and o.status = 'accepted'
  and q.status = 'accepted' and q."acceptedRideId" is null;

alter table public.ride_offers enable row level security;
revoke all on public.ride_offers from public, anon, authenticated;
grant select on public.ride_offers to authenticated;

-- Owner-executed checks prevent recursion between request, offer, and profile policies.
create or replace function public.owns_offer_request(target_request uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.ride_requests q
    where q.id = target_request and q."passengerId" = auth.uid()
  )
$$;

create or replace function public.can_read_offer_request(target_request uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.ride_offers o
    join public.rides r on r."rideId" = o."rideId"
    where o."requestId" = target_request and r."driverId" = auth.uid()
  )
$$;

create or replace function public.can_read_offer_passenger(target_passenger uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.ride_requests q
    join public.ride_offers o on o."requestId" = q.id
    join public.rides r on r."rideId" = o."rideId"
    where q."passengerId" = target_passenger and r."driverId" = auth.uid()
      and o.status in ('pending', 'accepted')
  )
$$;

revoke all on function public.owns_offer_request(uuid),
  public.can_read_offer_request(uuid), public.can_read_offer_passenger(uuid) from public, anon;
grant execute on function public.owns_offer_request(uuid),
  public.can_read_offer_request(uuid), public.can_read_offer_passenger(uuid) to authenticated;

drop policy if exists "offers read participants" on public.ride_offers;
create policy "offers read participants" on public.ride_offers for select to authenticated
using (
  public.owns_offer_request("requestId")
  or exists (select 1 from public.rides r where r."rideId" = ride_offers."rideId"
    and r."driverId" = auth.uid())
);

drop policy if exists "dev all ride_requests" on public.ride_requests;
drop policy if exists "dev all rides" on public.rides;
drop policy if exists "dev read rides" on public.rides;
drop policy if exists "dev read users" on public.users;
drop policy if exists "dev read drivers" on public.drivers;

drop policy if exists "requests read" on public.ride_requests;
create policy "requests read" on public.ride_requests for select to authenticated
using (
  "passengerId" = auth.uid()
  or public.can_read_offer_request(id)
  -- Keep existing single-driver clients working until they switch to offers.
  or "selectedRideId" in (select r."rideId" from public.rides r where r."driverId" = auth.uid())
  or (status = 'open' and exists (select 1 from public.drivers d where d."driverId" = auth.uid()))
);

drop policy if exists "users read requesters of my rides" on public.users;
drop policy if exists "users read offer passengers" on public.users;
create policy "users read offer passengers" on public.users for select to authenticated
using (public.can_read_offer_passenger("userId"));

-- Offer-managed booking state can only be changed by the RPCs. The older direct
-- decline/withdraw operations still work on legacy pending requests during rollout.
create or replace function public.guard_offer_booking_fields()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status is distinct from 'open' or new."acceptedRideId" is not null or new.price is not null then
      raise exception 'New requests must be open and have no agreed fare.';
    end if;
  elsif old.status = 'accepted' or old."acceptedRideId" is not null
      or new.status = 'accepted' or new."acceptedRideId" is not null
      or new.price is distinct from old.price then
    raise exception 'Use the booking functions to change accepted requests or fares.';
  elsif new."passengerId" is distinct from old."passengerId" then
    raise exception 'The request owner cannot change.';
  elsif old."passengerId" is distinct from auth.uid() then
    if old.status is distinct from 'pending' or new.status is distinct from 'declined'
        or (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'Use the offer functions to respond to requests.';
    end if;
  elsif old.status not in ('open', 'pending') or old.status is null
      or new.status not in ('open', 'pending') or new.status is null then
    raise exception 'Use the booking functions to change closed requests.';
  elsif old.status = 'pending' and (
      new.status <> 'open' or new."selectedRideId" is not null
      or (to_jsonb(new) - array['status', 'selectedRideId', 'needsApproval'])
         is distinct from (to_jsonb(old) - array['status', 'selectedRideId', 'needsApproval'])
  ) then
    raise exception 'Withdraw the pending request before changing the trip.';
  elsif old.status = 'open' and exists (
    select 1 from public.ride_offers o where o."requestId" = old.id and o.status = 'pending'
  ) then
    raise exception 'Start a new search to change a request that has offers.';
  end if;
  return new;
end
$$;

drop trigger if exists guard_offer_booking_fields on public.ride_requests;
create trigger guard_offer_booking_fields before insert or update on public.ride_requests
for each row execute function public.guard_offer_booking_fields();

-- Lock the ride first, then the request. NO KEY UPDATE is compatible with FK
-- key-share locks when an offer is inserted. Never lock another ride once a
-- request is locked. The app enforces MDD and the 1.5x time cap in the plan phase.
create or replace function public.send_offer(request_id uuid, ride_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  ride public.rides%rowtype;
  req public.ride_requests%rowtype;
  quote numeric;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into ride from public.rides r where r."rideId" = ride_id for no key update;
  if not found or ride.status <> 'scheduled' then raise exception 'Ride is no longer available'; end if;
  if ride."driverId" = auth.uid() then raise exception 'You cannot request your own ride'; end if;

  select * into req from public.ride_requests q where q.id = request_id for no key update;
  if not found or req."passengerId" is distinct from auth.uid() then
    raise exception 'Request not found';
  end if;
  if req.status not in ('open', 'pending') or req.status is null or req."acceptedRideId" is not null then
    raise exception 'This request is no longer open';
  end if;
  quote := round(ride."pricePerKm" * req."directKm", 2);
  if quote >= 1000000 then raise exception 'The fare exceeds the supported amount'; end if;

  insert into public.ride_offers ("requestId", "rideId", fare)
  values (request_id, ride_id, quote)
  on conflict ("requestId", "rideId") do update
    set status = 'pending',
        fare = case when ride_offers.status = 'pending' then ride_offers.fare else excluded.fare end
    where ride_offers.status in ('pending', 'taken');
  if not found then raise exception 'This driver has already responded to this offer'; end if;
end
$$;

create or replace function public.accept_request(request_id uuid, ride_id uuid, new_plan jsonb default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  ride public.rides%rowtype;
  req public.ride_requests%rowtype;
  offer public.ride_offers%rowtype;
  quote numeric;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into ride from public.rides r where r."rideId" = ride_id for no key update;
  if not found or ride."driverId" is distinct from auth.uid() then raise exception 'Ride not found'; end if;
  if ride.status <> 'scheduled' then raise exception 'Ride is no longer available'; end if;

  select * into req from public.ride_requests q where q.id = request_id for no key update;
  if not found then raise exception 'Request not found'; end if;
  if req."passengerId" is null or req."passengerId" = auth.uid() then
    raise exception 'This passenger cannot join your ride';
  end if;
  if req."acceptedRideId" = ride_id and req.status = 'accepted' then return; end if;
  if req."acceptedRideId" is not null or req.status = 'accepted' then
    raise exception 'Another driver already accepted this request';
  end if;
  if req.status not in ('open', 'pending') or req.status is null then
    raise exception 'This request is no longer open';
  end if;

  select * into offer from public.ride_offers o
  where o."requestId" = request_id and o."rideId" = ride_id;
  if found and offer.status <> 'pending' then raise exception 'This offer is no longer pending'; end if;
  if offer.id is null and req.status = 'pending' and req."selectedRideId" is distinct from ride_id then
    raise exception 'This request was sent to a different ride';
  end if;
  quote := coalesce(offer.fare, round(ride."pricePerKm" * req."directKm", 2));
  if quote >= 1000000 then raise exception 'The fare exceeds the supported amount'; end if;

  insert into public.ride_offers ("requestId", "rideId", status, fare)
  values (request_id, ride_id, 'accepted', quote)
  on conflict ("requestId", "rideId") do update set status = 'accepted', fare = excluded.fare;

  update public.ride_requests q
  set status = 'accepted', "acceptedRideId" = ride_id, price = quote,
      "selectedRideId" = ride_id
  where q.id = request_id;

  update public.ride_offers o set status = 'taken'
  where o."requestId" = request_id and o."rideId" <> ride_id and o.status = 'pending';

  if new_plan is not null then
    update public.rides r set plan = new_plan where r."rideId" = ride_id;
  end if;
exception when exclusion_violation then
  raise exception 'The pickup plan would overlap another scheduled ride';
end
$$;

-- Compatibility for the shipped one-argument caller.
create or replace function public.accept_request(request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  target_ride uuid;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select q."selectedRideId" into target_ride from public.ride_requests q
  where q.id = request_id and q.status = 'pending';
  if target_ride is null then raise exception 'This request is no longer pending'; end if;
  perform public.accept_request(request_id, target_ride, null);
end
$$;

create or replace function public.decline_offer(request_id uuid, ride_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  perform 1 from public.rides r where r."rideId" = ride_id
    and r."driverId" = auth.uid() for no key update;
  if not found then raise exception 'Ride not found'; end if;
  perform 1 from public.ride_requests q where q.id = request_id for no key update;
  if not found then raise exception 'Request not found'; end if;
  update public.ride_offers o set status = 'declined'
  where o."requestId" = request_id and o."rideId" = ride_id and o.status = 'pending';
  if not found then raise exception 'This offer is no longer pending'; end if;
  update public.ride_requests q set status = 'declined'
  where q.id = request_id and q.status = 'pending' and q."selectedRideId" = ride_id;
end
$$;

-- Project legacy sends and withdrawals into offers during the app rollout.
create or replace function public.sync_legacy_ride_offer()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'pending' and old."selectedRideId" is not null
      and (new.status in ('open', 'declined') or (
        new.status = 'pending' and new."selectedRideId" is distinct from old."selectedRideId"
      )) then
    update public.ride_offers o
    set status = case when new.status = 'declined' then 'declined' else 'cancelled' end
    where o."requestId" = old.id and o."rideId" = old."selectedRideId" and o.status = 'pending';
  end if;

  if new.status = 'pending' and new."selectedRideId" is not null then
    insert into public.ride_offers ("requestId", "rideId", fare)
    select new.id, r."rideId", round(r."pricePerKm" * new."directKm", 2)
    from public.rides r where r."rideId" = new."selectedRideId"
    on conflict ("requestId", "rideId") do update set status = 'pending', fare = excluded.fare
      where ride_offers.status in ('pending', 'cancelled');
  end if;
  return new;
end
$$;

drop trigger if exists sync_legacy_ride_offer on public.ride_requests;
create trigger sync_legacy_ride_offer after update of status, "selectedRideId" on public.ride_requests
for each row execute function public.sync_legacy_ride_offer();

create or replace function public.cancel_booking(request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  req public.ride_requests%rowtype;
  locked_rides uuid[];
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into req from public.ride_requests q where q.id = request_id
    and q."passengerId" = auth.uid();
  if not found then raise exception 'Request not found'; end if;

  select array(
    select r."rideId" from public.rides r
    where r."rideId" in (req."acceptedRideId", req."selectedRideId")
      or r."rideId" in (select o."rideId" from public.ride_offers o where o."requestId" = request_id)
    order by r."rideId" for no key update
  ) into locked_rides;

  select * into req from public.ride_requests q where q.id = request_id
    and q."passengerId" = auth.uid() for no key update;
  if not found then raise exception 'Request not found'; end if;
  if (req."acceptedRideId" is not null and not req."acceptedRideId" = any(locked_rides))
      or (req."selectedRideId" is not null and not req."selectedRideId" = any(locked_rides))
      or exists (select 1 from public.ride_offers o where o."requestId" = request_id
                 and not o."rideId" = any(locked_rides)) then
    raise exception using errcode = '40001', message = 'The booking just changed. Please retry.';
  end if;
  if req.status = 'cancelled' then return; end if;
  if req.status is null or req.status not in ('open', 'pending', 'accepted') then
    raise exception 'This request can no longer be cancelled';
  end if;
  if req.status = 'accepted' and exists (
    select 1 from public.rides r where r."rideId" = coalesce(req."acceptedRideId", req."selectedRideId")
      and r.status in ('completed', 'cancelled')
  ) then
    raise exception 'This ride is already closed';
  end if;

  update public.ride_offers o set status = 'cancelled'
  where o."requestId" = request_id and o.status in ('pending', 'accepted');

  update public.ride_requests q
  set status = 'cancelled', "acceptedRideId" = null
  where q.id = request_id;

  -- Release the old single-passenger flag on rides booked before the migration.
  update public.rides r set occupied = false, "requestorId" = null
  where r."rideId" = coalesce(req."acceptedRideId", req."selectedRideId")
    and r."requestorId" = req."passengerId" and req.status = 'accepted';
end
$$;

-- Shared close operation preserves the existing finish/cancel RPC signatures.
create or replace function public.close_offer_ride(target_ride uuid, cancelled boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  ride public.rides%rowtype;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into ride from public.rides r where r."rideId" = target_ride for no key update;
  if not found or ride."driverId" is distinct from auth.uid() then
    raise exception 'Ride not found';
  end if;
  if (cancelled and ride.status = 'cancelled') or (not cancelled and ride.status = 'completed') then return; end if;
  if ride.status not in ('scheduled', 'in_progress') then raise exception 'This ride is already closed'; end if;

  -- Order request locks deterministically when several rides have offers for the same requests.
  perform 1 from public.ride_requests q
  where q."acceptedRideId" = target_ride or q."selectedRideId" = target_ride
    or exists (select 1 from public.ride_offers o
               where o."rideId" = target_ride and o."requestId" = q.id and o.status = 'pending')
  order by q.id for no key update;

  if cancelled then
    update public.ride_offers o set status = 'cancelled'
    where o."rideId" = target_ride and o.status = 'accepted';
    update public.ride_requests q
    set status = 'open', "acceptedRideId" = null, "selectedRideId" = null, price = null
    where q."acceptedRideId" = target_ride and q.status = 'accepted';
  elsif exists (select 1 from public.ride_offers o where o."rideId" = target_ride and o.status = 'accepted') then
    update public.drivers set "totalTrips" = "totalTrips" + 1 where "driverId" = auth.uid();
  end if;

  update public.ride_offers o set status = 'declined'
  where o."rideId" = target_ride and o.status = 'pending';
  update public.ride_requests q set status = case when cancelled then 'cancelled' else 'declined' end
  where q."selectedRideId" = target_ride and q.status = 'pending';
  update public.rides r
  set status = case when cancelled then 'cancelled' else 'completed' end,
      "isCompleted" = true, "completedAt" = case when cancelled then null else now() end
  where r."rideId" = target_ride;
end
$$;

create or replace function public.cancel_ride(ride_id uuid)
returns void language sql security definer set search_path = public
as $$ select public.close_offer_ride(ride_id, true) $$;

create or replace function public.finish_trip(ride_id uuid)
returns void language sql security definer set search_path = public
as $$ select public.close_offer_ride(ride_id, false) $$;

create or replace function public.start_trip(ride_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  ride public.rides%rowtype;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into ride from public.rides r where r."rideId" = ride_id for no key update;
  if not found or ride."driverId" is distinct from auth.uid() then raise exception 'Ride not found'; end if;
  if ride.status = 'in_progress' then return; end if;
  if ride.status <> 'scheduled' then raise exception 'Only scheduled rides can start'; end if;

  update public.rides r set status = 'in_progress', "startedAt" = now() where r."rideId" = ride_id;
end
$$;

revoke all on function public.close_offer_ride(uuid, boolean),
  public.sync_legacy_ride_offer(), public.guard_offer_booking_fields() from public, anon, authenticated;
revoke all on function public.send_offer(uuid, uuid), public.accept_request(uuid, uuid, jsonb),
  public.accept_request(uuid), public.decline_offer(uuid, uuid), public.cancel_booking(uuid),
  public.cancel_ride(uuid), public.finish_trip(uuid), public.start_trip(uuid) from public, anon;
grant execute on function public.send_offer(uuid, uuid), public.accept_request(uuid, uuid, jsonb),
  public.accept_request(uuid), public.decline_offer(uuid, uuid), public.cancel_booking(uuid),
  public.cancel_ride(uuid), public.finish_trip(uuid), public.start_trip(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
