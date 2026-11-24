-- Run after the driver app sends request_id, ride_id and new_plan.
begin;

drop function if exists public.accept_request(uuid);
notify pgrst, 'reload schema';

commit;
