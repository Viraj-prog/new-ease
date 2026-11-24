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
  otherName: string | null;
  // Where the user was going: their own drop-off when they rode, the trip's end when they drove.
  destination: string;
  // Where that destination is on the map, when known (used to look up its street address).
  destinationPoint: Pt | null;
  price: number | null;
  // True when the fare is calculated from the ride's rate instead of a saved price.
  estimated: boolean;
  statusLabel?: string;
  reopenedRequestId?: string;
  reopenedOfferId?: string;
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
  status: string;
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
async function loadAsRider(userId: string, history: boolean): Promise<PreviousTrip[]> {
  const query = supabase
    .from('ride_offers')
    .select(
      `id, status, fare, cancelledByDriver, ride_requests!inner(*),
       rides!inner ( rideId, driverStartLocation, driverEndLocation, departAt, pricePerKm, status,
               drivers ( users ( firstName, lastName ) ) )`,
    )
    .eq('ride_requests.passengerId', userId);
  const { data, error } = await (history
    ? query
    : query.eq('status', 'accepted').eq('rides.status', 'completed'));
  if (error) throw error;

  type Row = {
    id: string;
    status: string;
    fare: number | null;
    cancelledByDriver: boolean;
    ride_requests: RequestRow;
    rides: {
      driverStartLocation: string;
      driverEndLocation: string;
      departAt: string | null;
      pricePerKm: number | null;
      status: string;
      drivers: { users: { firstName: string | null; lastName: string | null } | null } | null;
    };
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    key: `rider-${r.id}`,
    role: 'rider' as const,
    start: r.rides.driverStartLocation,
    end: r.rides.driverEndLocation,
    departAt: r.rides.departAt,
    destination: r.ride_requests.dropoffText?.trim() || r.rides.driverEndLocation,
    destinationPoint: { lat: r.ride_requests.dropoffLat, lng: r.ride_requests.dropoffLng },
    otherName: fullName(r.rides.drivers?.users, 'Driver'),
    statusLabel: history
      ? r.cancelledByDriver ? 'Cancelled by driver' : historyLabel(r.rides.status, r.status)
      : undefined,
    reopenedRequestId: history && r.cancelledByDriver && r.ride_requests.status === 'open'
      ? r.ride_requests.id : undefined,
    reopenedOfferId: r.cancelledByDriver ? r.id : undefined,
    ...priceOf({
      ...r.ride_requests,
      price: r.fare ?? (r.status === 'accepted' ? r.ride_requests.price : null),
    }, r.rides.pricePerKm),
  }));
}

function historyLabel(rideStatus: string, requestStatus?: string) {
  if (rideStatus === 'cancelled' || requestStatus === 'cancelled') return 'Cancelled';
  if (requestStatus === 'declined') return 'Declined';
  if (requestStatus === 'taken') return 'Closed';
  if (requestStatus === 'pending') return 'Pending';
  if (rideStatus === 'completed') return 'Completed';
  return rideStatus === 'in_progress' ? 'In progress' : 'Pending';
}

async function loadAsDriver(userId: string, history: boolean): Promise<PreviousTrip[]> {
  const query = supabase
    .from('rides')
    .select('rideId, driverStartLocation, driverEndLocation, departAt, endLat, endLng, pricePerKm, status')
    .eq('driverId', userId)
    .order('departAt', { ascending: false, nullsFirst: false });
  const { data: rides, error } = await (history ? query : query.eq('status', 'completed'));
  if (error) throw error;
  if (!rides?.length) return [];

  const requestsQuery = supabase
    .from('ride_offers')
    .select('id, rideId, status, fare, ride_requests!inner(*)')
    .in('rideId', rides.map((r) => r.rideId));
  const { data: reqs, error: reqError } = await (history
    ? requestsQuery.in('status', ['pending', 'accepted', 'cancelled']).order('createdAt', { ascending: false })
    : requestsQuery.eq('status', 'accepted'));
  if (reqError) throw reqError;
  type LinkedOffer = { id: string; rideId: string; status: string; fare: number | null; ride_requests: RequestRow };
  const linked = (reqs ?? []) as unknown as LinkedOffer[];
  const ids = [...new Set(linked.map((offer) => offer.ride_requests.passengerId))];
  const { data: people } = ids.length ? await supabase
    .from('users')
    .select('userId, firstName, lastName')
    .in('userId', ids) : { data: [] };

  return rides.flatMap((ride) => {
    const requests: (LinkedOffer | null)[] = linked.filter((offer) => offer.rideId === ride.rideId);
    if (history) {
      const passenger = requests.find((request) => request?.status === 'accepted') ?? requests[0];
      requests.splice(0, requests.length, passenger ?? null);
    }
    return requests.map((offer) => {
      const r = offer?.ride_requests;
      const person = r && people?.find((u) => u.userId === r.passengerId);
      return {
        key: offer ? `driver-${offer.id}` : `driver-ride-${ride.rideId}`,
        role: 'driver' as const,
        start: ride.driverStartLocation,
        end: ride.driverEndLocation,
        departAt: ride.departAt,
        destination: ride.driverEndLocation,
        destinationPoint:
          ride.endLat != null && ride.endLng != null ? { lat: ride.endLat, lng: ride.endLng } : null,
        otherName: r ? fullName(person || null, 'Passenger') : null,
        statusLabel: history ? historyLabel(ride.status) : undefined,
        ...(r ? priceOf({
          ...r, price: offer?.fare ?? (offer?.status === 'accepted' ? r.price : null),
        }, ride.pricePerKm) : { price: null, estimated: false }),
      };
    });
  });
}

// Everything the user has finished, newest first.
export async function loadPreviousTrips(userId: string): Promise<PreviousTrip[]> {
  return loadTrips(userId, false);
}

export async function loadRideHistory(userId: string): Promise<PreviousTrip[]> {
  return loadTrips(userId, true);
}

async function loadTrips(userId: string, history: boolean): Promise<PreviousTrip[]> {
  const [asRider, asDriver] = await Promise.all([loadAsRider(userId, history), loadAsDriver(userId, history)]);
  return [...asRider, ...asDriver].sort((a, b) => (b.departAt ?? '').localeCompare(a.departAt ?? ''));
}
