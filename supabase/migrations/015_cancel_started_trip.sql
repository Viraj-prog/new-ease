-- Cancelling a trip that is under way now ends it for the riders too.
-- Run in the Supabase SQL editor, after 014. Transactional and safe to run again.
--
-- Replaces end_trip_early from 014. One thing differs: a rider who was still waiting to be picked
-- up is no longer put back to searching. For each accepted rider:
--   * dropped off: stays accepted, so the trip counts as completed for them;
--   * everyone else (waiting or in the car): their offer and request are cancelled.
-- The ride is completed if anyone was dropped off, and cancelled if not.
--
-- No tables, columns or policies change. Only the ride's driver can call the function. Cancelling
-- a ride before it starts (cancel_ride) still returns its riders to searching.
begin;

do $$
begin
  if to_regprocedure('public.end_trip_early(uuid)') is null then
    raise exception 'Run 014_end_trip_early.sql first.';
  end if;
end
$$;

create or replace function public.end_trip_early(ride_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  ride public.rides%rowtype;
  delivered boolean;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into ride from public.rides r where r."rideId" = ride_id for no key update;
  if not found or ride."driverId" is distinct from auth.uid() then raise exception 'Ride not found'; end if;
  -- Ending the same trip twice changes nothing.
  if ride."endedEarlyAt" is not null then return; end if;
  if ride.status <> 'in_progress' then raise exception 'Only a trip in progress can be ended early'; end if;

  perform 1 from public.ride_requests q
  where exists (
    select 1 from public.ride_offers o where o."rideId" = ride_id and o."requestId" = q.id
  )
  order by q.id for no key update;

  -- Requests first: they are picked out by the offers, which change afterwards.
  update public.ride_requests q
  set status = 'cancelled', "acceptedRideId" = null
  where q."acceptedRideId" = ride_id and q.status = 'accepted' and exists (
    select 1 from public.ride_offers o
    where o."rideId" = ride_id and o."requestId" = q.id and o.status = 'accepted'
      and o."droppedOffAt" is null
  );

  update public.ride_offers o set status = 'cancelled', "cancelledByDriver" = true
  where o."rideId" = ride_id and o.status = 'accepted' and o."droppedOffAt" is null;

  update public.ride_offers o set status = 'declined'
  where o."rideId" = ride_id and o.status = 'pending';

  delivered := exists (
    select 1 from public.ride_offers o where o."rideId" = ride_id and o.status = 'accepted'
  );
  if delivered then
    update public.drivers set "totalTrips" = "totalTrips" + 1 where "driverId" = auth.uid();
  end if;

  update public.rides r
  set status = case when delivered then 'completed' else 'cancelled' end,
      "isCompleted" = true,
      "completedAt" = case when delivered then now() else null end,
      "endedEarlyAt" = now(),
      occupied = false, "requestorId" = null
  where r."rideId" = ride_id;
end
$$;

revoke all on function public.end_trip_early(uuid) from public, anon;
grant execute on function public.end_trip_early(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
