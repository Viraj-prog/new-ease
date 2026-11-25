-- Remove the ride_requests columns that only the earlier app branch used.
-- Run in the Supabase SQL editor, after 009. Transactional and safe to run again.
--
-- Nothing in the current app or its database functions reads these columns. Their values are
-- copied into ride_requests_old_branch_backup first. Row-level security is on for that table with
-- no policies, so the app cannot read it; look at it in the Supabase dashboard.
--
-- The earlier branches (ui-changes, delivery-feature) should no longer be used after this.
begin;

-- 1. Stop if 009 has not been run, or if a database function still names one of the columns.
do $$
declare
  user_of_columns text;
begin
  if to_regprocedure('public.withdraw_request(uuid)') is not null
      or to_regprocedure('public.mark_cancellations_seen(uuid[])') is not null
      or position('close_offer_ride' in
           coalesce(pg_get_functiondef(to_regprocedure('public.cancel_ride(uuid)')), '')) = 0 then
    raise exception 'Run 009_restore_driver_cancellation.sql first.';
  end if;

  select p.proname into user_of_columns
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc ~ '"(hiddenFromRides|cancelledBy|cancelledAt|cancelledAfterStart|wasBooked|refundedAt|driverSeenAt|passengerSeenAt)"'
  limit 1;

  if found then
    raise exception 'The function % still uses one of these columns. Nothing was removed.', user_of_columns;
  end if;
end
$$;

-- 2. Keep a copy of the values (only the first time, and only if the columns are there).
do $$
begin
  if to_regclass('public.ride_requests_old_branch_backup') is null and (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'ride_requests'
      and column_name in ('hiddenFromRides', 'cancelledBy', 'cancelledAt', 'cancelledAfterStart',
                          'wasBooked', 'refundedAt', 'driverSeenAt', 'passengerSeenAt')
  ) = 8 then
    execute $copy$
      create table public.ride_requests_old_branch_backup as
      select id, "selectedRideId", status, "hiddenFromRides", "cancelledBy", "cancelledAt",
             "cancelledAfterStart", "wasBooked", "refundedAt", "driverSeenAt", "passengerSeenAt",
             now() as "copiedAt"
      from public.ride_requests
    $copy$;
    execute 'alter table public.ride_requests_old_branch_backup enable row level security';
    execute 'revoke all on public.ride_requests_old_branch_backup from public, anon, authenticated';
  end if;
end
$$;

-- 3. Remove the columns. The check on "cancelledBy" goes with its column.
alter table public.ride_requests
  drop column if exists "hiddenFromRides",
  drop column if exists "cancelledBy",
  drop column if exists "cancelledAt",
  drop column if exists "cancelledAfterStart",
  drop column if exists "wasBooked",
  drop column if exists "refundedAt",
  drop column if exists "driverSeenAt",
  drop column if exists "passengerSeenAt";

notify pgrst, 'reload schema';
commit;
