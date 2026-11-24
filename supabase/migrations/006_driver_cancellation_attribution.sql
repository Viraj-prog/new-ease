-- Preserve who cancelled an accepted offer, including after the rider rebooks.
-- Existing cancellations have unknown attribution and retain their stored status.
begin;

alter table public.ride_offers
  add column if not exists "cancelledByDriver" boolean not null default false;

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

revoke all on function public.close_offer_ride(uuid, boolean) from public, anon, authenticated;
notify pgrst, 'reload schema';

commit;
