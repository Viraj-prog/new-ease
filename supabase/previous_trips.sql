-- Price and drop-off name of a ride, for the Previous Trips tab and Recent trips. Run once in the Supabase SQL editor.
-- It is safe to run again, and it only adds a column: nothing existing is changed.
--
-- The app writes the rider's price here when a request is sent (distance x $2.50 for now).
-- Requests made before this column existed keep a null price; the app shows an estimate
-- for those.
alter table public.ride_requests add column if not exists price numeric(8, 2);

-- The place the rider asked to go to, as they typed it. Recent trips uses it, so a rider
-- sees where they went rather than where the driver's trip ended.
alter table public.ride_requests add column if not exists "dropoffText" text;
