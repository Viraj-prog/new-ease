-- Set explicit lifecycle statuses while preserving the existing booking behavior.
-- Earlier closed rides retain their existing status.
begin;

create or replace function public.finish_trip(ride_id uuid)
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
    return;
  end if;

  update public.rides
    set "isCompleted" = true, status = 'completed', "completedAt" = now()
    where "rideId" = ride_id;

  if coalesce(r_ride.occupied, false) then
    update public.drivers set "totalTrips" = "totalTrips" + 1 where "driverId" = auth.uid();
  end if;

  update public.ride_requests
    set status = 'declined'
    where "selectedRideId" = ride_id and status = 'pending';
end;
$$;

revoke all on function public.finish_trip(uuid) from public, anon;
grant execute on function public.finish_trip(uuid) to authenticated;

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

  update public.rides
    set "isCompleted" = true, status = 'cancelled'
    where "rideId" = ride_id;
  update public.ride_requests
    set status = 'cancelled'
    where "selectedRideId" = ride_id and status in ('pending', 'accepted');
end;
$$;

revoke all on function public.cancel_ride(uuid) from public, anon;
grant execute on function public.cancel_ride(uuid) to authenticated;

commit;
