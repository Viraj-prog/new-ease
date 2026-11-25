-- Let a driver end a trip that is under way.
-- Run in the Supabase SQL editor, after 013. Transactional and safe to run again.
--
-- What happens to each accepted rider depends on the marks from 013:
--   * dropped off: stays accepted, so the trip counts as completed for them;
--   * picked up but not dropped off: their offer and request are cancelled;
--   * still waiting: their search opens again so another driver can take them, and its time
--     moves up to now if it had passed.
-- The ride is completed if anyone was dropped off, and cancelled if not.
--
-- Adds rides."endedEarlyAt" and one function, end_trip_early. Row-level security does not
-- change. Only the ride's driver can call it. The guard from 008 still stops the app from
-- writing the new column or the ride's status directly.
begin;

do $$
begin
  if to_regprocedure('public.mark_stop(uuid, uuid, text)') is null then
    raise exception 'Run 013_stop_progress.sql first.';
  end if;
end
$$;

alter table public.rides
  add column if not exists "endedEarlyAt" timestamptz;

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
  set status = 'open', "acceptedRideId" = null, "selectedRideId" = null, price = null,
      "departAt" = greatest(q."departAt", now())
  where q."acceptedRideId" = ride_id and q.status = 'accepted' and exists (
    select 1 from public.ride_offers o
    where o."rideId" = ride_id and o."requestId" = q.id and o.status = 'accepted'
      and o."pickedUpAt" is null
  );

  update public.ride_requests q
  set status = 'cancelled', "acceptedRideId" = null
  where q."acceptedRideId" = ride_id and q.status = 'accepted' and exists (
    select 1 from public.ride_offers o
    where o."rideId" = ride_id and o."requestId" = q.id and o.status = 'accepted'
      and o."pickedUpAt" is not null and o."droppedOffAt" is null
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
