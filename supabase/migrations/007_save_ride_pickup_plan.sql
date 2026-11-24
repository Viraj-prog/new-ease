begin;

-- Save a derived plan without changing bookings. Lock the ride before inspecting
-- offers, matching the lock order used by acceptance and cancellation.
create or replace function public.save_plan(ride_id uuid, plan jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.rides%rowtype;
  expected_requests text[];
  expected_passengers text[];
  supplied_passengers text[];
  pickup_requests text[];
  dropoff_requests text[];
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  select * into target from public.rides r
  where r."rideId" = $1
  for no key update;
  if not found or target."driverId" is distinct from auth.uid() then
    raise exception 'Ride not found';
  end if;
  if target.status <> 'scheduled' then
    raise exception 'Only scheduled rides can update their pickup plan';
  end if;

  select coalesce(array_agg(o."requestId"::text order by o."requestId"::text), array[]::text[]),
         coalesce(array_agg(distinct q."passengerId"::text order by q."passengerId"::text), array[]::text[])
  into expected_requests, expected_passengers
  from public.ride_offers o
  join public.ride_requests q on q.id = o."requestId"
  where o."rideId" = $1 and o.status = 'accepted';

  if $2 is null then
    if cardinality(expected_requests) <> 0 then
      raise exception 'The accepted passenger list changed. Refresh and try again.';
    end if;
  else
    if jsonb_typeof($2) is distinct from 'object'
       or jsonb_typeof($2 -> 'points') is distinct from 'array'
       or jsonb_typeof($2 -> 'stops') is distinct from 'array'
       or jsonb_typeof($2 -> 'passengerIds') is distinct from 'array'
       or jsonb_typeof($2 -> 'distanceKm') is distinct from 'number'
       or jsonb_typeof($2 -> 'durationMin') is distinct from 'number' then
      raise exception 'Invalid pickup plan';
    end if;
    if jsonb_array_length($2 -> 'points') < 2
       or ($2 -> 'distanceKm') < '0'::jsonb
       or ($2 -> 'durationMin') <= '0'::jsonb then
      raise exception 'Invalid pickup plan';
    end if;

    select coalesce(array_agg(id order by id), array[]::text[])
    into supplied_passengers from jsonb_array_elements_text($2 -> 'passengerIds') as p(id);

    select coalesce(array_agg(s.stop ->> 'requestId' order by s.stop ->> 'requestId')
             filter (where s.stop ->> 'type' = 'pickup'), array[]::text[]),
           coalesce(array_agg(s.stop ->> 'requestId' order by s.stop ->> 'requestId')
             filter (where s.stop ->> 'type' = 'dropoff'), array[]::text[])
    into pickup_requests, dropoff_requests
    from jsonb_array_elements($2 -> 'stops') as s(stop);

    if supplied_passengers is distinct from expected_passengers
       or pickup_requests is distinct from expected_requests
       or dropoff_requests is distinct from expected_requests
       or jsonb_array_length($2 -> 'stops') <> 2 * cardinality(expected_requests) then
      raise exception 'The accepted passenger list changed. Refresh and try again.';
    end if;

    if exists (
      select 1 from jsonb_array_elements($2 -> 'stops') with ordinality as s(stop, stop_index)
      group by s.stop ->> 'requestId'
      having min(s.stop_index) filter (where s.stop ->> 'type' = 'dropoff')
           < min(s.stop_index) filter (where s.stop ->> 'type' = 'pickup')
    ) then
      raise exception 'Each pickup must come before its drop-off';
    end if;
  end if;

  -- The ride's existing exclusion constraint checks the updated time window.
  -- OSRM travel times and the 1.5x cap are validated in the app.
  update public.rides r set plan = $2
  where r."rideId" = $1 and r.plan is distinct from $2;
exception when exclusion_violation then
  raise exception 'The pickup plan would overlap another scheduled ride';
end
$$;

revoke all on function public.save_plan(uuid, jsonb) from public, anon;
grant execute on function public.save_plan(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
