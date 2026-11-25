import type { PickupStop } from '@/lib/pickupPlanner';
import { supabase } from '@/lib/supabase';

// What has happened to each booked passenger on a trip that is under way.

export type StopMark = 'picked_up' | 'dropped_off' | 'no_show';

export type StopProgress = {
  requestId: string;
  pickedUpAt: string | null;
  droppedOffAt: string | null;
};

export type BookedStop = { stop: PickupStop; done: boolean; pickedUp: boolean };

// The plan's stops that still have a booked passenger, in order. A no-show is no longer booked,
// so both of their stops drop out.
export function bookedStops(stops: readonly PickupStop[], progress: readonly StopProgress[]): BookedStop[] {
  return stops.flatMap((stop) => {
    const rider = progress.find((p) => p.requestId === stop.requestId);
    if (!rider) return [];
    const pickedUp = !!rider.pickedUpAt;
    return [{ stop, pickedUp, done: stop.type === 'pickup' ? pickedUp : !!rider.droppedOffAt }];
  });
}

export async function loadStopProgress(rideId: string): Promise<StopProgress[]> {
  const { data, error } = await supabase
    .from('ride_offers')
    .select('requestId, pickedUpAt, droppedOffAt')
    .eq('rideId', rideId)
    .eq('status', 'accepted');
  if (error) throw error;
  return data ?? [];
}

// The first and last name on a booking on the driver's trip.
export async function loadPassengerName(requestId: string): Promise<string> {
  const { data: request } = await supabase
    .from('ride_requests').select('passengerId').eq('id', requestId).maybeSingle();
  if (!request) return 'your passenger';
  const { data } = await supabase
    .from('users').select('firstName, lastName').eq('userId', request.passengerId).maybeSingle();
  return `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim() || 'your passenger';
}

// Driver, trip under way: record a pickup, a drop-off, or a passenger who did not show up.
export async function markStop(rideId: string, requestId: string, mark: StopMark) {
  const { error } = await supabase.rpc('mark_stop', { ride_id: rideId, request_id: requestId, mark });
  if (error) throw error;
}

// Driver: cancel a trip under way. Riders dropped off stay completed; everyone else on it is
// cancelled. (Needs the 015 database script.)
export async function endTripEarly(rideId: string) {
  const { error } = await supabase.rpc('end_trip_early', { ride_id: rideId });
  if (error) throw error;
}
