-- Start trip, cancelling a request, and cancellations after a trip has started.
-- Run once in the Supabase SQL editor. It is safe to run again.
--
-- What it does
--  1. Records when a driver pressed Start trip (rides."startedAt"). A started ride no longer
--     shows up when riders search.
--  2. Lets a rider withdraw a request that is waiting for a driver, and hides the request from
--     THAT driver only (ride_requests."hiddenFromRides"). Other drivers can still see it.
--  3. Records who cancelled and when. If a passenger cancels after the driver pressed Start
--     trip, the driver still gets the full fare and the passenger is still charged it:
--     the request becomes 'cancelled' with "cancelledAfterStart" = true, and the ride stays
--     taken so finishing it still counts as a trip.
--
-- The app keeps working if this script has not been run yet; it just skips these behaviours.

-- 1. New columns -------------------------------------------------------------------------
alter table public.rides add column if not exists "startedAt" timestamptz;

alter table public.ride_requests add column if not exists "hiddenFromRides" uuid[] not null default '{}';
alter table public.ride_requests add column if not exists "cancelledBy" text;
alter table public.ride_requests add column if not exists "cancelledAt" timestamptz;
alter table public.ride_requests add column if not exists "cancelledAfterStart" boolean not null default false;

alter table public.ride_requests drop constraint if exists ride_requests_cancelled_by_check;
alter table public.ride_requests
  add constraint ride_requests_cancelled_by_check
  check ("cancelledBy" is null or "cancelledBy" in ('passenger', 'driver'));

-- 2. Start trip --------------------------------------------------------------------------
create or replace function public.start_trip(ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_ride public.rides%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  select * into r_ride from public.rides where "rideId" = ride_id for update;
  if not found then
    raise exception 'Ride not found';
  end if;
  if r_ride."driverId" <> auth.uid() then
    raise exception 'This is not your ride';
  end if;
  if coalesce(r_ride."isCompleted", false) then
    raise exception 'This ride is already finished';
  end if;

  update public.rides
    set "startedAt" = coalesce("startedAt", now())
    where "rideId" = ride_id;
end;
$$;

revoke all on function public.start_trip(uuid) from public, anon;
grant execute on function public.start_trip(uuid) to authenticated;

-- 3. A rider withdraws a request that is still waiting ----------------------------------
--    The request goes back to 'open' (searching) and is hidden from the driver it was sent
--    to. Returns false if the driver had already answered.
create or replace function public.withdraw_request(request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r_req public.ride_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  select * into r_req from public.ride_requests where id = request_id;
  if not found then
    raise exception 'Request not found';
  end if;
  if r_req."passengerId" <> auth.uid() then
    raise exception 'This is not your request';
  end if;

  -- Lock the ride first (same order as accept_request) so the two cannot deadlock.
  if r_req."selectedRideId" is not null then
    perform 1 from public.rides where "rideId" = r_req."selectedRideId" for update;
  end if;
  select * into r_req from public.ride_requests where id = request_id for update;

  if r_req.status <> 'pending' or r_req."selectedRideId" is null then
    return false;
  end if;

  update public.ride_requests
    set status = 'open',
        "selectedRideId" = null,
        "needsApproval" = false,
        "hiddenFromRides" = array_append("hiddenFromRides", r_req."selectedRideId")
    where id = request_id;
  return true;
end;
$$;

revoke all on function public.withdraw_request(uuid) from public, anon;
grant execute on function public.withdraw_request(uuid) to authenticated;

-- 4. A passenger cancels a booking ----------------------------------------------------------
--    Before the trip has started: the ride becomes free again, nobody is charged.
--    After the driver pressed Start trip: the ride stays taken, and the cancelled request is
--    marked "cancelledAfterStart" so the driver is still paid the full fare.
create or replace function public.cancel_booking(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_req public.ride_requests%rowtype;
  ride_started timestamptz;
  ride_done boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  select * into r_req from public.ride_requests where id = request_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if r_req."passengerId" <> auth.uid() then
    raise exception 'This is not your booking';
  end if;

  -- Lock the ride first (same order as accept_request) so the two cannot deadlock.
  if r_req."selectedRideId" is not null then
    select "startedAt", coalesce("isCompleted", false)
      into ride_started, ride_done
      from public.rides where "rideId" = r_req."selectedRideId" for update;
  end if;
  select * into r_req from public.ride_requests where id = request_id for update;

  if r_req.status not in ('pending', 'accepted') then
    return;
  end if;

  if r_req.status = 'accepted' and ride_started is not null and not ride_done then
    update public.ride_requests
      set status = 'cancelled', "cancelledBy" = 'passenger', "cancelledAt" = now(),
          "cancelledAfterStart" = true
      where id = request_id;
    return;
  end if;

  update public.ride_requests
    set status = 'cancelled', "cancelledBy" = 'passenger', "cancelledAt" = now()
    where id = request_id;

  if r_req.status = 'accepted' and r_req."selectedRideId" is not null then
    update public.rides
      set occupied = false, "requestorId" = null
      where "rideId" = r_req."selectedRideId" and not coalesce("isCompleted", false);
  end if;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- 5. A driver cancels a trip they posted (same as before, but it records who cancelled) ----
create or replace function public.cancel_ride(ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_ride public.rides%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  select * into r_ride from public.rides where "rideId" = ride_id for update;
  if not found then
    raise exception 'Ride not found';
  end if;
  if r_ride."driverId" <> auth.uid() then
    raise exception 'This is not your ride';
  end if;
  if coalesce(r_ride."isCompleted", false) then
    raise exception 'This ride is already finished';
  end if;

  update public.rides set "isCompleted" = true where "rideId" = ride_id;
  update public.ride_requests
    set status = 'cancelled', "cancelledBy" = 'driver', "cancelledAt" = now()
    where "selectedRideId" = ride_id and status in ('pending', 'accepted');
end;
$$;

revoke all on function public.cancel_ride(uuid) from public, anon;
grant execute on function public.cancel_ride(uuid) to authenticated;
