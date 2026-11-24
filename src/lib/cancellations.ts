import { supabase } from '@/lib/supabase';

// A cancellation the user has not been told about yet.
export type CancellationNotice = {
  requestId: string;
  // 'driver' = you drove and your passenger cancelled. 'passenger' = your driver cancelled.
  side: 'driver' | 'passenger';
  title: string;
  subtitle: string;
};

// True once the database has answered with the columns from supabase/trip_rules.sql. Until then the
// Home screen's own "your passenger is gone" check is the only warning a driver gets.
let tracked = false;
export const cancellationsTracked = () => tracked;

type Row = {
  id: string;
  passengerId: string;
  cancelledAfterStart: boolean | null;
  price?: number | string | null;
  rides: { driverEndLocation: string; departAt: string | null } | null;
};

const tripText = (r: Row) => {
  if (!r.rides) return 'your trip';
  const day = r.rides.departAt
    ? ` on ${new Date(r.rides.departAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
    : '';
  return `the trip to ${r.rides.driverEndLocation}${day}`;
};

export async function loadUnseenCancellations(userId: string): Promise<CancellationNotice[]> {
  const columns = '*, rides!inner ( driverId, driverEndLocation, departAt )';
  const [asDriver, asPassenger] = await Promise.all([
    // Your passenger cancelled a booking (and you have not since cancelled the trip yourself).
    supabase
      .from('ride_requests')
      .select(columns)
      .eq('rides.driverId', userId)
      .eq('status', 'cancelled')
      .eq('cancelledBy', 'passenger')
      .eq('wasBooked', true)
      .is('refundedAt', null)
      .is('driverSeenAt', null),
    // Your driver cancelled a trip you were booked on.
    supabase
      .from('ride_requests')
      .select(columns)
      .eq('passengerId', userId)
      .not('refundedAt', 'is', null)
      .is('passengerSeenAt', null),
  ]);
  const error = asDriver.error ?? asPassenger.error;
  if (error) {
    // Before supabase/trip_rules.sql has been run the columns do not exist.
    if (/wasBooked|refundedAt|driverSeenAt|passengerSeenAt/i.test(error.message)) return [];
    throw error;
  }
  tracked = true;

  const mine = (asDriver.data ?? []) as unknown as Row[];
  const names = new Map<string, string>();
  if (mine.length) {
    const { data } = await supabase
      .from('users')
      .select('userId, firstName, lastName')
      .in('userId', mine.map((r) => r.passengerId));
    for (const u of data ?? []) {
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
      if (name) names.set(u.userId, name);
    }
  }

  return [
    ...mine.map((r) => ({
      requestId: r.id,
      side: 'driver' as const,
      title: 'Passenger cancelled',
      subtitle: `${names.get(r.passengerId) ?? 'A passenger'} cancelled ${tripText(r)}.${
        r.cancelledAfterStart ? ' It had started, so you will still be paid.' : ''
      }`,
    })),
    ...((asPassenger.data ?? []) as unknown as Row[]).map((r) => ({
      requestId: r.id,
      side: 'passenger' as const,
      title: 'Driver cancelled the trip',
      subtitle: `Your driver cancelled ${tripText(r)}. ${
        r.price != null ? `$${Number(r.price).toFixed(2)} was` : 'You were'
      } refunded in full.`,
    })),
  ];
}

export async function markCancellationsSeen(requestIds: string[]) {
  const { error } = await supabase.rpc('mark_cancellations_seen', { request_ids: requestIds });
  if (error) console.warn('Could not mark the cancellation as seen:', error.message);
}
