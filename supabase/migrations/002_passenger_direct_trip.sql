-- Store the passenger's direct road distance and duration for fare and pickup planning.
begin;

alter table public.ride_requests
  add column if not exists "directKm" numeric,
  add column if not exists "directMin" numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ride_requests'::regclass
      and conname = 'ride_requests_direct_trip_metrics_check'
  ) then
    alter table public.ride_requests
      add constraint ride_requests_direct_trip_metrics_check check (
        ("directKm" is null or ("directKm" >= 0 and "directKm" < 'Infinity'::numeric))
        and ("directMin" is null or ("directMin" >= 0 and "directMin" < 'Infinity'::numeric))
      );
  end if;
end
$$;

commit;
