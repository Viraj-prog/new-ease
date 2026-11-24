-- Start-trip timing, saved cancellation notices, and refunds when a driver cancels.
-- Run once in the Supabase SQL editor, AFTER cancellations.sql. It is safe to run again.
--
-- What it does
--  1. A driver can only start a trip on or after the day and time they chose.
--  2. Records whether a cancelled request had been booked, and whether the other person has seen
--     the cancellation, so they can be told the next time they open the app.
--  3. When a driver cancels a trip, every passenger who was booked on it (including one who
--     cancelled after the trip started and was charged) is marked as refunded in full.
--
-- There is no real payment yet: "refunded" is a record the app shows, not a money transfer.

-- 1. New columns -------------------------------------------------------------------------
alter table public.ride_requests add column if not exists "wasBooked" boolean not null default false;
alter table public.ride_requests add column if not exists "refundedAt" timestamptz;
alter table public.ride_requests add column if not exists "driverSeenAt" timestamptz;
alter table public.ride_requests add column if not exists "passengerSeenAt" timestamptz;

-- 2. Start trip, not before the chosen time ----------------------------------------------
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
  -- To the minute: a 3:00 trip can be started from 3:00 on.
  if r_ride."departAt" is not null and date_trunc('minute', r_ride."departAt") > now() then
    raise exception 'It is not time to start this trip yet';
  end if;

  update public.rides
    set "startedAt" = coalesce("startedAt", now())
    where "rideId" = ride_id;
end;
$$;

revoke all on function public.start_trip(uuid) from public, anon;
grant execute on function public.start_trip(uuid) to authenticated;

-- 3. A passenger cancels a booking (as before, and records that it had been booked) -------
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
          "cancelledAfterStart" = true, "wasBooked" = true, "driverSeenAt" = null
      where id = request_id;
    return;
  end if;

  update public.ride_requests
    set status = 'cancelled', "cancelledBy" = 'passenger', "cancelledAt" = now(),
        "wasBooked" = (r_req.status = 'accepted'), "driverSeenAt" = null
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

-- 4. A driver cancels a trip: booked passengers are refunded in full ----------------------
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

  -- Everyone booked, or already charged for cancelling after the start. Do this before the
  -- statuses change below.
  update public.ride_requests
    set "refundedAt" = now(), "wasBooked" = true, "passengerSeenAt" = null
    where "selectedRideId" = ride_id
      and (status = 'accepted' or (status = 'cancelled' and "cancelledAfterStart"));

  update public.ride_requests
    set status = 'cancelled', "cancelledBy" = 'driver', "cancelledAt" = now()
    where "selectedRideId" = ride_id and status in ('pending', 'accepted');
end;
$$;

revoke all on function public.cancel_ride(uuid) from public, anon;
grant execute on function public.cancel_ride(uuid) to authenticated;

-- 5. Mark cancellation notices as seen --------------------------------------------------
--    Only touches the caller's own side: a driver for rides they posted, a passenger for
--    their own refunded requests.
create or replace function public.mark_cancellations_seen(request_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  update public.ride_requests rr
    set "driverSeenAt" = now()
    where rr.id = any(request_ids)
      and rr."cancelledBy" = 'passenger'
      and exists (
        select 1 from public.rides r
        where r."rideId" = rr."selectedRideId" and r."driverId" = auth.uid()
      );

  update public.ride_requests
    set "passengerSeenAt" = now()
    where id = any(request_ids)
      and "passengerId" = auth.uid()
      and "refundedAt" is not null;
end;
$$;

revoke all on function public.mark_cancellations_seen(uuid[]) from public, anon;
grant execute on function public.mark_cancellations_seen(uuid[]) to authenticated;
