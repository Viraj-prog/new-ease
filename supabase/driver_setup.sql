-- Run this once in the Supabase SQL editor. It is safe to run again.
--
-- WARNING: this turns on row-level security (RLS) for users, drivers, rides and
-- ride_requests. Any app that talks to these tables without logging in (for
-- example the partner's test app, which uses hardcoded user ids) will stop
-- working until it logs users in. Policies that already exist under other names
-- are NOT removed here, and they still apply; review them in Authentication >
-- Policies.

-- 1. Drivers no longer need a car VIN up front (onboarding is just a flag for now).
--    Postgres still enforces UNIQUE for VINs that are filled in.
alter table public.drivers alter column "carVin" drop not null;

-- 2. Create a users row whenever someone signs up. The app sends firstName and
--    lastName as signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users ("userId", email, "firstName", "lastName", "isVerified", "isDriver")
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'firstName',
    new.raw_user_meta_data->>'lastName',
    false,
    false
  )
  on conflict ("userId") do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. One-time backfill: logins that have no users row yet. Existing rows are untouched.
insert into public.users ("userId", email, "firstName", "lastName", "isVerified", "isDriver")
select a.id, a.email, a.raw_user_meta_data->>'firstName', a.raw_user_meta_data->>'lastName', false, false
from auth.users a
where not exists (select 1 from public.users u where u."userId" = a.id);

-- 4. Create the drivers row automatically when isDriver becomes true.
create or replace function public.handle_driver_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new."isDriver" then
    insert into public.drivers ("driverId") values (new."userId")
    on conflict ("driverId") do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_user_driver_flag on public.users;
create trigger on_user_driver_flag
  after insert or update of "isDriver" on public.users
  for each row execute function public.handle_driver_flag();

-- 4b. Users who are already marked as drivers but have no drivers row yet.
insert into public.drivers ("driverId")
select u."userId" from public.users u
where u."isDriver" and not exists (select 1 from public.drivers d where d."driverId" = u."userId");

-- 5. The only way an app user becomes a driver: this function, for themselves only.
--    For testing it is a one-tap switch. Later, add real checks here (licence,
--    insurance, ...) and the app does not need to change.
create or replace function public.become_driver()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;
  perform set_config('app.allow_driver_change', 'on', true);
  update public.users set "isDriver" = true where "userId" = auth.uid();
end;
$$;

revoke all on function public.become_driver() from public, anon;
grant execute on function public.become_driver() to authenticated;

-- 6. Block logged-in users from changing isDriver / isVerified directly.
--    (Changes from the SQL editor or service role have no auth.uid(), so they pass.)
create or replace function public.guard_protected_user_flags()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.allow_driver_change', true), '') <> 'on'
     and (new."isDriver" is distinct from old."isDriver"
          or new."isVerified" is distinct from old."isVerified") then
    raise exception 'isDriver and isVerified cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_protected_user_flags on public.users;
create trigger guard_protected_user_flags
  before update on public.users
  for each row execute function public.guard_protected_user_flags();

-- 7. Row-level security policies
alter table public.users enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;
alter table public.ride_requests enable row level security;

-- users: read your own row, and (known trade-off) every logged-in user can read
-- the rows of drivers, which includes their email, phone and date of birth.
drop policy if exists "users read own" on public.users;
create policy "users read own" on public.users
  for select to authenticated using (auth.uid() = "userId");

drop policy if exists "users read drivers" on public.users;
create policy "users read drivers" on public.users
  for select to authenticated
  using (exists (select 1 from public.drivers d where d."driverId" = users."userId"));

drop policy if exists "users insert own" on public.users;
create policy "users insert own" on public.users
  for insert to authenticated
  with check (auth.uid() = "userId" and "isDriver" = false and "isVerified" = false);

drop policy if exists "users update own" on public.users;
create policy "users update own" on public.users
  for update to authenticated
  using (auth.uid() = "userId") with check (auth.uid() = "userId");

-- drivers: readable by logged-in users (rating, mdd). Rows are created by the trigger.
drop policy if exists "drivers read" on public.drivers;
create policy "drivers read" on public.drivers
  for select to authenticated using (true);

-- rides: anyone logged in can search them; only the driver can create or change theirs.
drop policy if exists "rides read" on public.rides;
create policy "rides read" on public.rides
  for select to authenticated using (true);

drop policy if exists "rides insert own" on public.rides;
create policy "rides insert own" on public.rides
  for insert to authenticated with check (auth.uid() = "driverId");

drop policy if exists "rides update own" on public.rides;
create policy "rides update own" on public.rides
  for update to authenticated
  using (auth.uid() = "driverId") with check (auth.uid() = "driverId");

-- ride_requests: a passenger manages their own; a driver can see open requests and
-- the requests sent to their rides, and can answer those.
drop policy if exists "requests read" on public.ride_requests;
create policy "requests read" on public.ride_requests
  for select to authenticated
  using (
    "passengerId" = auth.uid()
    or "selectedRideId" in (select "rideId" from public.rides where "driverId" = auth.uid())
    or (status = 'open' and exists (select 1 from public.drivers d where d."driverId" = auth.uid()))
  );

drop policy if exists "requests insert own" on public.ride_requests;
create policy "requests insert own" on public.ride_requests
  for insert to authenticated with check ("passengerId" = auth.uid());

drop policy if exists "requests update" on public.ride_requests;
create policy "requests update" on public.ride_requests
  for update to authenticated
  using (
    "passengerId" = auth.uid()
    or "selectedRideId" in (select "rideId" from public.rides where "driverId" = auth.uid())
  )
  with check (
    "passengerId" = auth.uid()
    or "selectedRideId" in (select "rideId" from public.rides where "driverId" = auth.uid())
  );

-- 8. Accepting a request is one atomic step. The driver of the ride locks it, checks
--    it is still free, marks the request accepted and the ride occupied (with the
--    passenger as requestorId), and declines every other pending request for it.
create or replace function public.accept_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_req public.ride_requests%rowtype;
  r_ride public.rides%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  select * into r_req from public.ride_requests where id = request_id;
  if not found then
    raise exception 'Request not found';
  end if;
  if r_req."selectedRideId" is null or r_req.status <> 'pending' then
    raise exception 'This request is not waiting for an answer';
  end if;

  -- Lock the ride so two accepts for the same ride cannot run at the same time.
  select * into r_ride from public.rides where "rideId" = r_req."selectedRideId" for update;
  if not found then
    raise exception 'Ride not found';
  end if;
  if r_ride."driverId" <> auth.uid() then
    raise exception 'This is not your ride';
  end if;
  if coalesce(r_ride.occupied, false) then
    raise exception 'This ride is already taken';
  end if;

  update public.ride_requests set status = 'accepted' where id = r_req.id;
  update public.rides
    set occupied = true, "requestorId" = r_req."passengerId"
    where "rideId" = r_ride."rideId";
  update public.ride_requests
    set status = 'declined'
    where "selectedRideId" = r_ride."rideId" and status = 'pending' and id <> r_req.id;
end;
$$;

revoke all on function public.accept_request(uuid) from public, anon;
grant execute on function public.accept_request(uuid) to authenticated;

-- 9. A request cannot be sent to a ride that is already taken or completed.
create or replace function public.guard_request_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  taken boolean;
begin
  if new.status = 'pending'
     and new."selectedRideId" is not null
     and (tg_op = 'INSERT'
          or new.status is distinct from old.status
          or new."selectedRideId" is distinct from old."selectedRideId") then
    select coalesce(occupied, false) or coalesce("isCompleted", false)
      into taken
      from public.rides where "rideId" = new."selectedRideId";
    if taken is null then
      raise exception 'That ride does not exist';
    end if;
    if taken then
      raise exception 'This ride is no longer available';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_request_target on public.ride_requests;
create trigger guard_request_target
  before insert or update on public.ride_requests
  for each row execute function public.guard_request_target();

-- 10. A driver can read the name of a passenger who has asked for one of their rides
--     (shown in the request popup). Other users' rows stay private.
drop policy if exists "users read requesters of my rides" on public.users;
create policy "users read requesters of my rides" on public.users
  for select to authenticated
  using (
    exists (
      select 1
      from public.ride_requests rr
      join public.rides r on r."rideId" = rr."selectedRideId"
      where rr."passengerId" = users."userId" and r."driverId" = auth.uid()
    )
  );

-- 11. A driver can have only one unfinished trip per day. A new trip is allowed on a
--     different day, or once the earlier trip has been finished.
create or replace function public.guard_one_trip_per_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.rides r
    where r."driverId" = new."driverId"
      and coalesce(r."isCompleted", false) = false
      and r."date" is not distinct from new."date"
  ) then
    raise exception 'You already have an unfinished trip on this day. Finish it before posting another.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_one_trip_per_day on public.rides;
create trigger guard_one_trip_per_day
  before insert on public.rides
  for each row execute function public.guard_one_trip_per_day();

-- 12. Finishing a trip: marks it completed, counts it for the driver if a passenger was
--     on it, and declines any request that was still waiting on it.
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

  update public.rides set "isCompleted" = true where "rideId" = ride_id;

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

-- 13. Cancelling rides (used by the Rides tab).
--     A passenger cancels their booking; the ride becomes free again if it was accepted.
create or replace function public.cancel_booking(request_id uuid)
returns void
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
    raise exception 'Booking not found';
  end if;
  if r_req."passengerId" <> auth.uid() then
    raise exception 'This is not your booking';
  end if;

  -- Lock the ride first (same order as accept_request) so the two cannot deadlock.
  if r_req."selectedRideId" is not null then
    perform 1 from public.rides where "rideId" = r_req."selectedRideId" for update;
  end if;
  select * into r_req from public.ride_requests where id = request_id for update;

  if r_req.status not in ('pending', 'accepted') then
    return;
  end if;

  update public.ride_requests set status = 'cancelled' where id = request_id;

  if r_req.status = 'accepted' and r_req."selectedRideId" is not null then
    update public.rides
      set occupied = false, "requestorId" = null
      where "rideId" = r_req."selectedRideId" and not coalesce("isCompleted", false);
  end if;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

--     A driver cancels a trip they posted. It is closed (so they can post again) without
--     counting as a finished trip, and its pending or accepted requests become cancelled.
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
    set status = 'cancelled'
    where "selectedRideId" = ride_id and status in ('pending', 'accepted');
end;
$$;

revoke all on function public.cancel_ride(uuid) from public, anon;
grant execute on function public.cancel_ride(uuid) to authenticated;
