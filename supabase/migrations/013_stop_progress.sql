-- Record what happened at each stop of a trip: picked up, dropped off, or no show.
-- Run in the Supabase SQL editor, after 012. Transactional and safe to run again.
--
-- Adds three times to ride_offers and one function, mark_stop. Row-level security does not
-- change: a rider and the ride's driver can read their offers, and nobody can write to them
-- directly. Only the ride's driver can call mark_stop, and only while the trip is under way.
--
-- A no show ends that rider's booking: their offer and request become cancelled, with
-- "noShowAt" set to tell it apart from other cancellations.
begin;

alter table public.ride_offers
  add column if not exists "pickedUpAt" timestamptz,
  add column if not exists "droppedOffAt" timestamptz,
  add column if not exists "noShowAt" timestamptz;

create or replace function public.mark_stop(ride_id uuid, request_id uuid, mark text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  ride public.rides%rowtype;
  offer public.ride_offers%rowtype;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  if mark is null or mark not in ('picked_up', 'dropped_off', 'no_show') then
    raise exception 'Unknown stop mark';
  end if;

  -- Ride first, then the request, as everywhere else.
  select * into ride from public.rides r where r."rideId" = ride_id for no key update;
  if not found or ride."driverId" is distinct from auth.uid() then raise exception 'Ride not found'; end if;
  if ride.status <> 'in_progress' then raise exception 'This trip is not in progress'; end if;
  perform 1 from public.ride_requests q where q.id = request_id for no key update;
  if not found then raise exception 'Request not found'; end if;

  select * into offer from public.ride_offers o
  where o."requestId" = request_id and o."rideId" = ride_id for no key update;
  if not found then raise exception 'This passenger is not on your trip'; end if;
  -- Marking the same thing twice changes nothing.
  if mark = 'no_show' and offer."noShowAt" is not null then return; end if;
  if offer.status <> 'accepted' then raise exception 'This passenger is not on your trip'; end if;

  if mark = 'picked_up' then
    update public.ride_offers o set "pickedUpAt" = coalesce(o."pickedUpAt", now())
    where o.id = offer.id;
  elsif mark = 'dropped_off' then
    if offer."pickedUpAt" is null then raise exception 'Mark this passenger picked up first'; end if;
    update public.ride_offers o set "droppedOffAt" = coalesce(o."droppedOffAt", now())
    where o.id = offer.id;
  else
    if offer."pickedUpAt" is not null then raise exception 'This passenger was already picked up'; end if;
    update public.ride_offers o set status = 'cancelled', "noShowAt" = now()
    where o.id = offer.id;
    update public.ride_requests q set status = 'cancelled', "acceptedRideId" = null
    where q.id = request_id;
    -- Release the old single-passenger flag on rides booked before the offers table.
    update public.rides r set occupied = false, "requestorId" = null
    where r."rideId" = ride_id and r."requestorId" = (
      select q."passengerId" from public.ride_requests q where q.id = request_id
    );
  end if;
end
$$;

revoke all on function public.mark_stop(uuid, uuid, text) from public, anon;
grant execute on function public.mark_stop(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
