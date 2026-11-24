-- A driver can only have one trip in progress at a time.
-- Run once in the Supabase SQL editor, AFTER trip_rules.sql. It is safe to run again.
--
-- The app already checks this; this makes the database refuse it too. It replaces start_trip,
-- keeping the earlier rule that a trip cannot start before the chosen day and time.

create or replace function public.start_trip(ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_ride public.rides%rowtype;
  other_end text;
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
  -- Already started: nothing to do.
  if r_ride."startedAt" is not null then
    return;
  end if;
  -- To the minute: a 3:00 trip can be started from 3:00 on.
  if r_ride."departAt" is not null and date_trunc('minute', r_ride."departAt") > now() then
    raise exception 'It is not time to start this trip yet';
  end if;

  -- Lock the driver too, so two trips cannot be started at the same moment. (Ride first, then
  -- driver, the same order as finish_trip.)
  perform 1 from public.drivers where "driverId" = auth.uid() for update;

  select "driverEndLocation" into other_end
    from public.rides
    where "driverId" = auth.uid()
      and "rideId" <> ride_id
      and "startedAt" is not null
      and not coalesce("isCompleted", false)
    limit 1;
  if found then
    raise exception 'Finish your trip to % before starting another.', other_end;
  end if;

  update public.rides set "startedAt" = now() where "rideId" = ride_id;
end;
$$;

revoke all on function public.start_trip(uuid) from public, anon;
grant execute on function public.start_trip(uuid) to authenticated;
