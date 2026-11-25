-- Put driver cancellation back on the offer-based version, repair rides it recorded wrongly, and
-- remove two functions the app no longer calls.
-- Run in the Supabase SQL editor, after 008. Transactional and safe to run again.
--
-- Why: a script from the earlier app branch replaced cancel_ride with a version that does not
-- know about ride_offers or rides.status. Cancelled rides were recorded as completed, their
-- offers stayed open and accepted riders were not returned to searching.
--
-- No tables or columns are dropped. Do not re-run driver_setup.sql after this: it would put
-- older functions back.
begin;

-- 1. Cancel through the same checked function as finishing a ride.
create or replace function public.cancel_ride(ride_id uuid)
returns void language sql security definer set search_path = public
as $$ select public.close_offer_ride(ride_id, true) $$;

revoke all on function public.cancel_ride(uuid) from public, anon;
grant execute on function public.cancel_ride(uuid) to authenticated;

-- 2. Rides the replaced function cancelled. They can be told apart from finished rides when a
--    request on them says the driver cancelled it, and the ride has no completion time.
--    A cancelled ride that nobody had requested looks like a finished one and is left alone.
do $$
declare
  ride_ids uuid[];
begin
  -- "cancelledBy" only exists where the earlier branch's scripts were run.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ride_requests' and column_name = 'cancelledBy'
  ) then
    select array_agg(r."rideId") into ride_ids
    from public.rides r
    where r.status = 'completed'
      and r."completedAt" is null
      and exists (
        select 1 from public.ride_requests q
        where q."selectedRideId" = r."rideId"
          and q.status = 'cancelled'
          and q."cancelledBy" = 'driver'
      );

    -- "cancelledByDriver" stays false, so riders are not sent notices about old rides now.
    update public.ride_offers o set status = 'declined'
    where o."rideId" = any(ride_ids) and o.status = 'pending';
    update public.ride_offers o set status = 'cancelled'
    where o."rideId" = any(ride_ids) and o.status = 'accepted';
    update public.rides r set status = 'cancelled'
    where r."rideId" = any(ride_ids);

    raise notice 'Rides changed from completed to cancelled: %', coalesce(cardinality(ride_ids), 0);
  end if;
end
$$;

-- 3. Only the earlier branch called these. It carries on without them.
drop function if exists public.withdraw_request(uuid);
drop function if exists public.mark_cancellations_seen(uuid[]);

notify pgrst, 'reload schema';
commit;
