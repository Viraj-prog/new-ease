-- Refuse requests and acceptances for trips whose time has passed.
-- Run in the Supabase SQL editor, after 011. Transactional and safe to run again.
--
-- The app already hides these. This makes the database say no as well, so a screen left open, or
-- an older copy of the app, cannot book them:
--   * a rider's search counts until 1 hour after its time;
--   * a ride takes new requests until 1 hour after its time;
--   * a driver can accept a rider until 3 hours after the ride's time (when the app asks about
--     the ride).
--
-- Replaces send_offer and accept_request from 004. Only the new checks differ. No tables,
-- columns or policies change.
begin;

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
  if ride."departAt" < now() - interval '1 hour' then raise exception 'This ride has already left'; end if;

  select * into req from public.ride_requests q where q.id = request_id for no key update;
  if not found or req."passengerId" is distinct from auth.uid() then
    raise exception 'Request not found';
  end if;
  if req.status not in ('open', 'pending') or req.status is null or req."acceptedRideId" is not null then
    raise exception 'This request is no longer open';
  end if;
  if req."departAt" < now() - interval '1 hour' then
    raise exception 'This search has expired. Start a new one.';
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
  -- Already booked on this ride: accepting again changes nothing, however late it is.
  if req."acceptedRideId" = ride_id and req.status = 'accepted' then return; end if;
  if req."acceptedRideId" is not null or req.status = 'accepted' then
    raise exception 'Another driver already accepted this request';
  end if;
  if req.status not in ('open', 'pending') or req.status is null then
    raise exception 'This request is no longer open';
  end if;
  if ride."departAt" < now() - interval '3 hours' then
    raise exception 'This ride is long past its time';
  end if;
  if req."departAt" < now() - interval '1 hour' then
    raise exception 'This passenger’s search has expired';
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

revoke all on function public.send_offer(uuid, uuid),
  public.accept_request(uuid, uuid, jsonb) from public, anon;
grant execute on function public.send_offer(uuid, uuid),
  public.accept_request(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
