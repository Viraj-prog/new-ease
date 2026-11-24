import type { Pt } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

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
  // True when the fare is calculated from the ride's rate instead of a saved price.
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
  directKm?: number | null;
  dropoffText?: string | null;
};

function priceOf(r: RequestRow, pricePerKm: number | null): { price: number | null; estimated: boolean } {
  if (r.price != null) return { price: Number(r.price), estimated: false };
  if (pricePerKm == null) return { price: null, estimated: false };
  if (r.directKm != null) return { price: r.directKm * pricePerKm, estimated: true };
  if ([r.pickupLat, r.pickupLng, r.dropoffLat, r.dropoffLng].some((value) => !Number.isFinite(value))) {
    return { price: null, estimated: false };
  }
  const km = haversineKm(
    { lat: r.pickupLat, lng: r.pickupLng },
    { lat: r.dropoffLat, lng: r.dropoffLng },
  );
  return { price: km * 1.3 * pricePerKm, estimated: true };
}

const fullName = (u: { firstName: string | null; lastName: string | null } | null | undefined, fallback: string) =>
  `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || fallback;

// Passenger: finished rides they were accepted on.
async function loadAsRider(userId: string): Promise<PreviousTrip[]> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select(
      `*, rides!inner ( rideId, driverStartLocation, driverEndLocation, departAt, isCompleted, pricePerKm,
               drivers ( users ( firstName, lastName ) ) )`,
    )
    .eq('passengerId', userId)
    .eq('status', 'accepted')
    .eq('rides.isCompleted', true);
  if (error) throw error;

  type Row = RequestRow & {
    rides: {
      driverStartLocation: string;
      driverEndLocation: string;
      departAt: string | null;
      pricePerKm: number | null;
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
    ...priceOf(r, r.rides.pricePerKm),
  }));
}

// Driver: finished trips that had a passenger on them. Trips nobody booked, and trips that
// were cancelled (their requests become 'cancelled'), are left out.
async function loadAsDriver(userId: string): Promise<PreviousTrip[]> {
  const { data: rides, error } = await supabase
    .from('rides')
    .select('rideId, driverStartLocation, driverEndLocation, departAt, endLat, endLng, pricePerKm')
    .eq('driverId', userId)
    .eq('isCompleted', true);
  if (error) throw error;
  if (!rides?.length) return [];

  const { data: reqs, error: reqError } = await supabase
    .from('ride_requests')
    .select('*')
    .in('selectedRideId', rides.map((r) => r.rideId))
    .eq('status', 'accepted');
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
    if (!ride) return [];
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
        ...priceOf(r, ride.pricePerKm),
      },
    ];
  });
}

// Everything the user has finished, newest first.
export async function loadPreviousTrips(userId: string): Promise<PreviousTrip[]> {
  const [asRider, asDriver] = await Promise.all([loadAsRider(userId), loadAsDriver(userId)]);
  return [...asRider, ...asDriver].sort((a, b) => (b.departAt ?? '').localeCompare(a.departAt ?? ''));
}
