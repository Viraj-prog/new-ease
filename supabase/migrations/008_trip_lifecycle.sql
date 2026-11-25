-- Enforce trip start and in-progress booking rules under the existing RLS policies.
begin;

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
      and r.status = 'in_progress'
  ) then
    raise exception 'You cannot cancel after the driver starts the trip';
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
  if cancelled and ride.status = 'in_progress' then
    raise exception 'A trip in progress can only be finished';
  end if;

  -- Order request locks deterministically when several rides have offers for the same requests.
  perform 1 from public.ride_requests q
  where q."acceptedRideId" = target_ride or q."selectedRideId" = target_ride
    or exists (select 1 from public.ride_offers o
               where o."rideId" = target_ride and o."requestId" = q.id and o.status = 'pending')
  order by q.id for no key update;

  if cancelled then
    update public.ride_offers o set status = 'cancelled', "cancelledByDriver" = true
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

-- The ride lock serializes start with acceptance, replanning and cancellation.
create or replace function public.start_trip(ride_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  ride public.rides%rowtype;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into ride from public.rides r where r."rideId" = ride_id for no key update;
  if not found or ride."driverId" is distinct from auth.uid() then raise exception 'Ride not found'; end if;
  if ride.status not in ('scheduled', 'in_progress') then
    raise exception 'Only scheduled rides can start';
  end if;

  if ride.status = 'scheduled' then
    -- Check that the saved plan still covers exactly the accepted bookings.
    perform public.save_plan(ride_id, ride.plan);
  end if;

  perform 1 from public.ride_requests q
  where (q.status = 'pending' and q."selectedRideId" = ride_id)
    or exists (
      select 1 from public.ride_offers o where o."rideId" = ride_id
        and o."requestId" = q.id and o.status = 'pending'
    )
  order by q.id for no key update;

  update public.ride_offers o set status = 'declined'
  where o."rideId" = ride_id and o.status = 'pending';

  -- Close legacy single-ride requests without withdrawing any other open offers.
  update public.ride_requests q
  set status = case when exists (
    select 1 from public.ride_offers o
    where o."requestId" = q.id and o."rideId" <> ride_id and o.status = 'pending'
  ) then 'open' else 'declined' end,
  "selectedRideId" = null
  where q."selectedRideId" = ride_id and q.status = 'pending';

  update public.rides r
  set status = 'in_progress', "startedAt" = now()
  where r."rideId" = ride_id and r.status = 'scheduled';
end
$$;

-- The existing owner UPDATE policy still applies to scheduled ride data.
-- Lifecycle and pickup-plan writes must go through the checked RPCs.
create or replace function public.guard_ride_lifecycle()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'scheduled' or new."isCompleted" is true
       or new."startedAt" is not null or new."completedAt" is not null or new.plan is not null then
      raise exception 'New rides must be scheduled and have no pickup plan';
    end if;
  elsif old.status = 'in_progress'
      or new.status is distinct from old.status
      or new."isCompleted" is distinct from old."isCompleted"
      or new."startedAt" is distinct from old."startedAt"
      or new."completedAt" is distinct from old."completedAt"
      or new.plan is distinct from old.plan then
    raise exception 'Use the ride functions to change the trip lifecycle or pickup plan';
  end if;
  return new;
end
$$;

drop trigger if exists guard_ride_lifecycle on public.rides;
create trigger guard_ride_lifecycle
before insert or update on public.rides
for each row execute function public.guard_ride_lifecycle();

revoke all on function public.guard_ride_lifecycle(),
  public.close_offer_ride(uuid, boolean) from public, anon, authenticated;
revoke all on function public.start_trip(uuid), public.cancel_booking(uuid) from public, anon;
grant execute on function public.start_trip(uuid), public.cancel_booking(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
