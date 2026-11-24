-- Run in the Supabase SQL editor. The migration is transactional and rerunnable.
begin;

create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

alter table public.rides
  add column if not exists "pricePerKm" numeric,
  add column if not exists status text not null default 'scheduled',
  add column if not exists "startedAt" timestamptz,
  add column if not exists "completedAt" timestamptz,
  add column if not exists plan jsonb;

-- Older clients omit the price. Existing rows keep their unknown price.
alter table public.rides alter column "pricePerKm" set default 0;

update public.rides
set status = 'completed'
where "isCompleted" is true and status = 'scheduled';

-- Resolve the three approved legacy conflicts while preserving ride history.
-- Block request writes while checking that none of these rides has a booking.
lock table public.ride_requests in share row exclusive mode;

do $$
declare
  ride_ids constant uuid[] := array[
    '3f878209-c27d-49d1-979a-3750c78c81f8',
    '75f44e61-4e88-4f58-ba4b-dd7696d5f129',
    '68e0be31-2e94-4c11-a44f-dbde86c6c9f1'
  ]::uuid[];
begin
  if exists (
    select 1
    from public.rides r
    where r."rideId" = any(ride_ids)
      and r.status <> 'cancelled'
      and (
        r."driverId" <> 'a0000000-0000-0000-0000-000000000006'::uuid
        or r.status <> 'scheduled'
        or r."isCompleted" is true
        or r.occupied is distinct from false
        or r."requestorId" is not null
        or exists (
          select 1 from public.ride_requests q where q."selectedRideId" = r."rideId"
        )
      )
  ) then
    raise exception 'An approved legacy cancellation no longer meets the conditions reviewed in Phase 1.';
  end if;

  update public.rides
  set status = 'cancelled', "isCompleted" = true
  where "rideId" = any(ride_ids) and status = 'scheduled';
end
$$;

-- Compute the window in UTC so it can be used in an exclusion index.
create or replace function public.ride_schedule_window(
  departure timestamptz, original_route jsonb, pickup_plan jsonb
)
returns tsrange
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when isfinite(departure)
      and jsonb_typeof(original_route -> 'durationMin') = 'number'
      and original_route -> 'durationMin' > '0'::jsonb
      and (
        pickup_plan is null or (
          jsonb_typeof(pickup_plan -> 'durationMin') = 'number'
          and pickup_plan -> 'durationMin' > '0'::jsonb
        )
      )
    then tsrange(
      departure at time zone 'UTC',
      (departure at time zone 'UTC') + interval '1 minute' * greatest(
        (original_route ->> 'durationMin')::double precision,
        (pickup_plan ->> 'durationMin')::double precision
      ),
      '[)'
    )
  end
$$;

do $$
declare
  invalid_ride uuid;
begin
  select "rideId" into invalid_ride
  from public.rides
  where status in ('scheduled', 'in_progress')
    and coalesce(isempty(public.ride_schedule_window("departAt", route, plan)), true)
  order by "rideId"
  limit 1;

  if found then
    raise exception 'Active ride % needs a finite departure time and positive route duration before scheduling can be migrated.', invalid_ride;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rides'::regclass and conname = 'rides_scheduling_fields_check'
  ) then
    alter table public.rides add constraint rides_scheduling_fields_check check (
      status in ('scheduled', 'in_progress', 'completed', 'cancelled')
      and ("pricePerKm" is null or ("pricePerKm" >= 0 and "pricePerKm" < 'Infinity'::numeric))
      and (
        status not in ('scheduled', 'in_progress')
        or not coalesce(isempty(public.ride_schedule_window("departAt", route, plan)), true)
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rides'::regclass and conname = 'rides_driver_schedule_no_overlap'
  ) then
    alter table public.rides add constraint rides_driver_schedule_no_overlap
      exclude using gist (
        "driverId" with =,
        public.ride_schedule_window("departAt", route, plan) with &&
      ) where (status in ('scheduled', 'in_progress'));
  end if;
end
$$;

-- Keep legacy finish/cancel calls compatible until the status-aware RPCs ship.
create or replace function public.sync_legacy_ride_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new."pricePerKm" is null then
      raise exception 'Enter a price per kilometre.';
    end if;
  elsif new."isCompleted" is true
      and old."isCompleted" is distinct from new."isCompleted"
      and new.status in ('scheduled', 'in_progress') then
    new.status := 'completed';
  end if;

  return new;
end
$$;

drop trigger if exists sync_legacy_ride_schedule on public.rides;
create trigger sync_legacy_ride_schedule
  before insert or update of "isCompleted" on public.rides
  for each row execute function public.sync_legacy_ride_schedule();

drop trigger if exists guard_one_trip_per_day on public.rides;

commit;
