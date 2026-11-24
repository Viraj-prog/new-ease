import type { Pt } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

export const PRICE_PER_KM = 2.5;

// One finished ride with someone on it, as the user lived it: either they drove, or they rode.
export type PreviousTrip = {
  // requestId + role is unique: one user can be both driver and rider.
  key: string;
  // 'driver' = the user drove; 'rider' = the user was the passenger.
  role: 'driver' | 'rider';
  start: string;
  end: string;
  departAt: string | null;
  // The other person: the rider when the user drove, the driver when the user rode.
  otherName: string;
  // Where the user was going: their own drop-off when they rode, the trip's end when they drove.
  destination: string;
  // Where that destination is on the map, when known (used to look up its street address).
  destinationPoint: Pt | null;
  price: number | null;
  // The passenger cancelled after the driver pressed Start trip. The fare still counts: the driver
  // earns it and the passenger pays it.
  cancelledAfterStart: boolean;
  // The driver cancelled a trip the passenger was booked on, so the fare was paid back.
  refunded: boolean;
  // True when the price had not been saved and is worked out from the distance instead.
  estimated: boolean;
};

const rad = (d: number) => (d * Math.PI) / 180;

// Straight-line distance in km. Used to estimate the price of older rides, and to spot a start and
// end that are the same place.
export function haversineKm(a: Pt, b: Pt) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

type RequestRow = {
  id: string;
  passengerId: string;
  selectedRideId: string | null;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  // Only present once previous_trips.sql has been run.
  price?: number | string | null;
  dropoffText?: string | null;
  // Only present once supabase/cancellations.sql has been run.
  cancelledAfterStart?: boolean | null;
  // Only present once supabase/trip_rules.sql has been run.
  refundedAt?: string | null;
};

function priceOf(r: RequestRow): { price: number; estimated: boolean } {
  if (r.price != null) return { price: Number(r.price), estimated: false };
  // Roads are longer than a straight line, so add a third.
  const km = haversineKm(
    { lat: r.pickupLat, lng: r.pickupLng },
    { lat: r.dropoffLat, lng: r.dropoffLng },
  );
  return { price: Math.round(km * 1.3 * PRICE_PER_KM * 100) / 100, estimated: true };
}

const fullName = (u: { firstName: string | null; lastName: string | null } | null | undefined, fallback: string) =>
  `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || fallback;

// Passenger: finished rides they were accepted on.
async function loadAsRider(userId: string): Promise<PreviousTrip[]> {
  const find = (withCancelled: boolean, withRefunds: boolean) => {
    const q = supabase
      .from('ride_requests')
      .select(
        `*, rides!inner ( rideId, driverStartLocation, driverEndLocation, departAt, isCompleted,
                 drivers ( users ( firstName, lastName ) ) )`,
      )
      .eq('passengerId', userId)
      .eq('rides.isCompleted', true);
    // A trip cancelled after it started still counts, because the fare is still charged.
    // A trip the driver cancelled is listed too, to show the refund.
    const refunds = withRefunds ? ',refundedAt.not.is.null' : '';
    return withCancelled
      ? q.or(`status.eq.accepted,and(status.eq.cancelled,cancelledAfterStart.eq.true)${refunds}`)
      : q.eq('status', 'accepted');
  };
  let { data, error } = await find(true, true);
  // Before supabase/trip_rules.sql has been run there is no "refundedAt" column yet.
  if (error && /refundedAt/i.test(error.message)) ({ data, error } = await find(true, false));
  // Before supabase/cancellations.sql has been run there is no "cancelledAfterStart" column yet.
  if (error && /cancelledAfterStart/i.test(error.message)) ({ data, error } = await find(false, false));
  if (error) throw error;

  type Row = RequestRow & {
    rides: {
      driverStartLocation: string;
      driverEndLocation: string;
      departAt: string | null;
      drivers: { users: { firstName: string | null; lastName: string | null } | null } | null;
    };
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    key: `rider-${r.id}`,
    role: 'rider' as const,
    start: r.rides.driverStartLocation,
    end: r.rides.driverEndLocation,
    departAt: r.rides.departAt,
    destination: r.dropoffText?.trim() || r.rides.driverEndLocation,
    destinationPoint: { lat: r.dropoffLat, lng: r.dropoffLng },
    otherName: fullName(r.rides.drivers?.users, 'Driver'),
    cancelledAfterStart: !!r.cancelledAfterStart,
    refunded: !!r.refundedAt,
    ...priceOf(r),
  }));
}

// Driver: finished trips that had a passenger on them. Trips nobody booked, and trips the driver
// cancelled, are left out. A trip whose passenger cancelled after it started is kept.
async function loadAsDriver(userId: string): Promise<PreviousTrip[]> {
  const { data: rides, error } = await supabase
    .from('rides')
    .select('rideId, driverStartLocation, driverEndLocation, departAt, endLat, endLng')
    .eq('driverId', userId)
    .eq('isCompleted', true);
  if (error) throw error;
  if (!rides?.length) return [];

  const findRequests = (withCancelled: boolean) => {
    const q = supabase
      .from('ride_requests')
      .select('*')
      .in('selectedRideId', rides.map((r) => r.rideId));
    return withCancelled
      ? q.or('status.eq.accepted,and(status.eq.cancelled,cancelledAfterStart.eq.true)')
      : q.eq('status', 'accepted');
  };
  let { data: reqs, error: reqError } = await findRequests(true);
  if (reqError && /cancelledAfterStart/i.test(reqError.message)) {
    ({ data: reqs, error: reqError } = await findRequests(false));
  }
  if (reqError) throw reqError;
  const accepted = (reqs ?? []) as RequestRow[];
  if (accepted.length === 0) return [];

  const ids = [...new Set(accepted.map((r) => r.passengerId))];
  const { data: people } = await supabase
    .from('users')
    .select('userId, firstName, lastName')
    .in('userId', ids);

  return accepted.flatMap((r) => {
    const ride = rides.find((x) => x.rideId === r.selectedRideId);
    // A refunded request belongs to a trip the driver cancelled: nothing was earned.
    if (!ride || r.refundedAt) return [];
    const person = people?.find((u) => u.userId === r.passengerId);
    return [
      {
        key: `driver-${r.id}`,
        role: 'driver' as const,
        start: ride.driverStartLocation,
        end: ride.driverEndLocation,
        departAt: ride.departAt,
        destination: ride.driverEndLocation,
        destinationPoint:
          ride.endLat != null && ride.endLng != null ? { lat: ride.endLat, lng: ride.endLng } : null,
        otherName: fullName(person, 'Passenger'),
        cancelledAfterStart: !!r.cancelledAfterStart,
        refunded: false,
        ...priceOf(r),
      },
    ];
  });
}

// Everything the user has finished, newest first.
export async function loadPreviousTrips(userId: string): Promise<PreviousTrip[]> {
  const [asRider, asDriver] = await Promise.all([loadAsRider(userId), loadAsDriver(userId)]);
  return [...asRider, ...asDriver].sort((a, b) => (b.departAt ?? '').localeCompare(a.departAt ?? ''));
}

// Passenger: save the price and where they were going on their request. Best effort: it never
// fails the booking, and does nothing for a column that has not been added yet.
export async function recordRequestDetails(
  requestId: string,
  details: { price?: number; dropoffText?: string },
) {
  if (details.price != null) {
    const { error } = await supabase
      .from('ride_requests')
      .update({ price: Math.round(details.price * 100) / 100 })
      .eq('id', requestId);
    if (error) console.warn('Could not save the ride price:', error.message);
  }
  const text = details.dropoffText?.trim();
  if (text) {
    const { error } = await supabase.from('ride_requests').update({ dropoffText: text }).eq('id', requestId);
    if (error) console.warn('Could not save the drop-off name:', error.message);
  }
}
