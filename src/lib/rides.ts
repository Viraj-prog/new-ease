import { classifyTrip, dayRange, localDate, type Pt } from './geo';
import { getRoute } from './routing';
import { supabase } from './supabase';

export type RideStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
const activeRideStatuses: RideStatus[] = ['scheduled', 'in_progress'];
const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function isActiveRide(status: RideStatus) {
  return activeRideStatuses.includes(status);
}

// A trip a driver has posted, with the road route drawn for it.
export type Trip = {
  rideId: string;
  route: Pt[];
  distanceKm: number;
  durationMin: number;
  mdd: number;
  pricePerKm: number | null;
  when: Date;
};

// A passenger request that falls near a driver's route.
export type Req = {
  id: string;
  status: string;
  pickupKm: number;
  dropoffKm: number;
  pickup: Pt;
  passengerId: string;
  // First and last name; null if the database does not let this driver read it.
  passengerName: string | null;
  departAt: string | null;
  fare: number | null;
};

type RideRow = {
  rideId: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  tripMdd: number | null;
  departAt: string;
  pricePerKm: number | null;
  route: { points: Pt[]; distanceKm: number; durationMin: number } | null;
  drivers: {
    driverRating: number | null;
    mdd: number | null;
    users: { firstName: string | null; lastName: string | null } | null;
  } | null;
};

// A driver's trip that matches what the passenger asked for.
export type Result = {
  rideId: string;
  driverName: string;
  rating: number | null;
  departAt: string;
  fare: number | null;
  pickupKm: number;
  dropoffKm: number;
  tripKm: number;
  tripMin: number;
  route: Pt[];
  start: Pt;
  end: Pt;
};

// Driver: route the trip and save it. Returns null when no road route exists.
export async function postTrip(args: {
  driverId: string;
  startText: string;
  endText: string;
  start: Pt;
  end: Pt;
  when: Date;
  mdd: number;
  pricePerKm: number;
}): Promise<Trip | null> {
  const r = await getRoute([args.start, args.end]);
  if (!r) return null;

  const { data, error } = await supabase
    .from('rides')
    .insert({
      driverId: args.driverId,
      driverStartLocation: args.startText || 'Current location',
      driverEndLocation: args.endText,
      date: localDate(args.when),
      departAt: args.when.toISOString(),
      startLat: args.start.lat,
      startLng: args.start.lng,
      endLat: args.end.lat,
      endLng: args.end.lng,
      tripMdd: args.mdd,
      pricePerKm: args.pricePerKm,
      status: 'scheduled',
      route: { points: r.points, distanceKm: r.distanceKm, durationMin: r.durationMin },
      isCompleted: false,
      occupied: false,
    })
    .select('rideId')
    .single();
  if (error) throw error;
  if (!isUuid(data?.rideId)) throw new Error('The scheduled ride did not return a valid ID.');

  return {
    rideId: data.rideId,
    route: r.points,
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    mdd: args.mdd,
    pricePerKm: args.pricePerKm,
    when: args.when,
  };
}

// Driver: is this trip still unfinished? False once it was finished or cancelled anywhere.
export async function isTripActive(rideId: string): Promise<boolean> {
  if (!isUuid(rideId)) return false;
  const { data, error } = await supabase
    .from('rides')
    .select('status')
    .eq('rideId', rideId)
    .maybeSingle();
  if (error) throw error;
  return !!data && isActiveRide(data.status);
}

// Driver: their earliest unfinished trip, so it can be shown again after a restart.
export async function loadActiveTrip(driverId: string): Promise<Trip | null> {
  if (!isUuid(driverId)) return null;
  const { data, error } = await supabase
    .from('rides')
    .select('rideId, route, tripMdd, departAt, pricePerKm')
    .eq('driverId', driverId)
    .in('status', activeRideStatuses)
    .order('departAt', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return asTrip(data);
}

export async function loadDriverTrip(rideId: string, driverId: string): Promise<Trip | null> {
  if (!isUuid(rideId) || !isUuid(driverId)) return null;
  const { data, error } = await supabase.from('rides')
    .select('rideId, route, tripMdd, departAt, pricePerKm')
    .eq('rideId', rideId)
    .eq('driverId', driverId)
    .in('status', activeRideStatuses)
    .maybeSingle();
  if (error) throw error;
  return asTrip(data);
}

function asTrip(data: {
  rideId: string;
  route: { points: Pt[]; distanceKm: number; durationMin: number } | null;
  tripMdd: number | null;
  departAt: string | null;
  pricePerKm: number | null;
} | null): Trip | null {
  if (!isUuid(data?.rideId) || !data.route?.points?.length) return null;
  return {
    rideId: data.rideId,
    route: data.route.points,
    distanceKm: data.route.distanceKm,
    durationMin: data.route.durationMin,
    mdd: data.tripMdd ?? 2,
    pricePerKm: data.pricePerKm,
    when: data.departAt ? new Date(data.departAt) : new Date(),
  };
}

// Driver: mark the trip finished (also declines requests still waiting on it).
export async function finishTrip(rideId: string) {
  const { error } = await supabase.rpc('finish_trip', { ride_id: rideId });
  if (error) throw error;
}

// Driver: passengers whose requests fall near the trip's route.
export async function loadRequests(trip: Trip, driverId: string): Promise<Req[]> {
  if (!isUuid(trip.rideId) || !isUuid(driverId)) return [];
  const { from, to } = dayRange(trip.when);
  const fields = 'id, passengerId, pickupLat, pickupLng, dropoffLat, dropoffLng, departAt, directKm, status';
  const [searching, offers] = await Promise.all([
    supabase.from('ride_requests').select(fields)
      .eq('status', 'open').neq('passengerId', driverId)
      .gte('departAt', from).lte('departAt', to),
    supabase.from('ride_offers').select(`status, fare, ride_requests!inner(${fields})`)
      .eq('rideId', trip.rideId),
  ]);
  if (searching.error) throw searching.error;
  if (offers.error) throw offers.error;

  type RequestRow = NonNullable<typeof searching.data>[number];
  type OfferRow = { status: OfferStatus; fare: number | null; ride_requests: RequestRow };
  const linked = (offers.data ?? []) as unknown as OfferRow[];
  const offeredIds = new Set(linked.map((offer) => offer.ride_requests.id));
  const candidates = [
    ...linked.filter(({ status, ride_requests }) =>
      status === 'accepted' || (status === 'pending' && ['open', 'pending'].includes(ride_requests.status)),
    ).map((offer) => ({ row: offer.ride_requests, status: offer.status, fare: offer.fare })),
    ...(searching.data ?? []).filter((row) => !offeredIds.has(row.id)).map((row) => ({
      row, status: 'open',
      fare: trip.pricePerKm == null || row.directKm == null ? null : trip.pricePerKm * row.directKm,
    })),
  ];
  const found: Req[] = [];
  for (const { row: r, status, fare } of candidates) {
    if (![r.pickupLat, r.pickupLng, r.dropoffLat, r.dropoffLng].every(Number.isFinite)) continue;
    const pickup = { lat: r.pickupLat, lng: r.pickupLng };
    const dropoff = { lat: r.dropoffLat, lng: r.dropoffLng };
    const c = classifyTrip(trip.route, pickup, dropoff, trip.mdd);
    if (c.zone === 'out' && status !== 'accepted') continue;
    found.push({
      id: r.id,
      status,
      pickup,
      passengerId: r.passengerId,
      passengerName: null,
      departAt: r.departAt ?? null,
      pickupKm: c.pickupKm,
      dropoffKm: c.dropoffKm,
      fare,
    });
  }

  // Names are only needed for passengers who have actually asked for this ride.
  const askingIds = [...new Set(found.filter((r) => r.status !== 'open').map((r) => r.passengerId))];
  if (askingIds.length > 0) {
    const { data: people, error: peopleError } = await supabase
      .from('users')
      .select('userId, firstName, lastName')
      .in('userId', askingIds);
    if (peopleError) console.warn('Could not load passenger names', peopleError.message);
    for (const r of found) {
      if (r.status === 'open') continue;
      const p = people?.find((u) => u.userId === r.passengerId);
      const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '';
      r.passengerName = name || null;
    }
  }
  return found;
}

// The database awards the passenger to the first driver who accepts.
export async function answerRequest(rideId: string, requestId: string, accept: boolean) {
  if (accept) {
    const { error } = await supabase.rpc('accept_request', {
      request_id: requestId, ride_id: rideId, new_plan: null,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.rpc('decline_offer', { request_id: requestId, ride_id: rideId });
  if (error) throw error;
}

// Passenger: save (or update) their open request so drivers can see it.
export async function saveRequest(args: {
  passengerId: string;
  from: Pt;
  to: Pt;
  when: Date;
  requestId: string | null;
  directKm: number;
  directMin: number;
  dropoffText: string;
}): Promise<string> {
  const row = {
    passengerId: args.passengerId,
    pickupLat: args.from.lat,
    pickupLng: args.from.lng,
    dropoffLat: args.to.lat,
    dropoffLng: args.to.lng,
    departAt: args.when.toISOString(),
    directKm: args.directKm,
    directMin: args.directMin,
    dropoffText: args.dropoffText.trim() || null,
    price: null,
    status: 'open',
    needsApproval: false,
  };
  if (args.requestId) {
    const { data, error } = await supabase.from('ride_requests').update(row)
      .eq('id', args.requestId)
      .eq('passengerId', args.passengerId)
      .eq('status', 'open')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }
  const { data, error } = await supabase.from('ride_requests').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

// Passenger: scheduled rides on the same local day, closest departure first.
export async function searchRides(
  from: Pt, to: Pt, when: Date, userId: string, directKm: number | null,
): Promise<Result[]> {
  const { from: a, to: b } = dayRange(when);
  const requestedTime = when.getTime();
  const { data, error } = await supabase
    .from('rides')
    .select(
      `rideId, driverId, startLat, startLng, endLat, endLng, tripMdd, route, departAt, pricePerKm,
       drivers ( driverRating, mdd, users ( firstName, lastName ) )`,
    )
    .neq('driverId', userId)
    .gte('departAt', a)
    .lte('departAt', b)
    .eq('status', 'scheduled');
  if (error) throw error;

  const list: Result[] = [];
  for (const r of (data ?? []) as unknown as RideRow[]) {
    if (!r.route?.points?.length) continue;
    const mdd = r.tripMdd ?? r.drivers?.mdd ?? 2;
    const c = classifyTrip(r.route.points, from, to, mdd);
    if (c.zone === 'out') continue;
    const u = r.drivers?.users;
    const name = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
    list.push({
      rideId: r.rideId,
      driverName: name || 'Driver',
      rating: r.drivers?.driverRating ?? null,
      departAt: r.departAt,
      fare: r.pricePerKm == null || directKm == null ? null : directKm * r.pricePerKm,
      pickupKm: c.pickupKm,
      dropoffKm: c.dropoffKm,
      tripKm: r.route.distanceKm,
      tripMin: r.route.durationMin,
      route: r.route.points,
      start: { lat: r.startLat, lng: r.startLng },
      end: { lat: r.endLat, lng: r.endLng },
    });
  }
  const byTime = new Map<number, Result[]>();
  for (const ride of list) {
    const difference = Math.abs(Date.parse(ride.departAt) - requestedTime);
    const group = byTime.get(difference);
    if (group) group.push(ride);
    else byTime.set(difference, [ride]);
  }

  const ranked: Result[] = [];
  for (const [, group] of [...byTime].sort(([a], [b]) => a - b)) {
    if (group.length > 1) {
      const detours = new Map<string, number>();
      for (const ride of group) {
        try {
          const route = await getRoute([ride.start, from, to, ride.end]);
          if (route) detours.set(ride.rideId, Math.max(0, route.distanceKm - ride.tripKm));
        } catch (error) {
          console.warn('Could not calculate a detour for tied rides', error);
        }
      }
      const detour = (ride: Result) => detours.size === group.length
        ? detours.get(ride.rideId)!
        : ride.pickupKm + ride.dropoffKm;
      group.sort((a, b) => detour(a) - detour(b) || a.rideId.localeCompare(b.rideId));
    }
    ranked.push(...group);
  }
  return ranked;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'taken' | 'cancelled';

export const offerStatusLabels: Record<OfferStatus, string> = {
  pending: 'Request sent',
  accepted: 'Accepted',
  declined: 'Declined',
  taken: 'Closed',
  cancelled: 'Cancelled',
};

export async function loadRequestOffers(requestId: string) {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('acceptedRideId, ride_offers(rideId, status)')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  return {
    acceptedRideId: (data?.acceptedRideId as string | null | undefined) ?? null,
    offers: (data?.ride_offers ?? []) as { rideId: string; status: OfferStatus }[],
  };
}

export async function loadDriverCancelledOfferIds(passengerId: string): Promise<string[]> {
  const { data, error } = await supabase.from('ride_offers')
    .select('id, ride_requests!inner(passengerId)')
    .eq('ride_requests.passengerId', passengerId)
    .eq('status', 'cancelled')
    .eq('cancelledByDriver', true);
  if (error) throw error;
  return (data ?? []).map((offer) => offer.id);
}

export async function loadOpenPassengerRequest(requestId: string, passengerId: string) {
  if (!isUuid(requestId) || !isUuid(passengerId)) return null;
  const { data, error } = await supabase.from('ride_requests')
    .select('pickupLat, pickupLng, dropoffLat, dropoffLng, departAt, directKm')
    .eq('id', requestId)
    .eq('passengerId', passengerId)
    .eq('status', 'open')
    .is('acceptedRideId', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function sendRequest(requestId: string, rideId: string) {
  const { error } = await supabase.rpc('send_offer', { request_id: requestId, ride_id: rideId });
  if (error) throw error;
}

// ---- Rides tab ----

// A trip the driver posted.
export type PostedRide = {
  rideId: string;
  start: string;
  end: string;
  departAt: string | null;
  status: RideStatus;
  // The accepted passenger, if any.
  passenger: { name: string } | null;
};

// A ride the passenger has asked for (waiting) or booked (accepted).
export type BookedRide = {
  requestId: string;
  rideId: string;
  start: string;
  end: string;
  departAt: string | null;
  status: string;
  rideStatus: RideStatus;
  driver: { name: string; rating: number | null };
};

export async function loadPostedRides(driverId: string, includeHistory = false): Promise<PostedRide[]> {
  const query = supabase
    .from('rides')
    .select('rideId, driverStartLocation, driverEndLocation, departAt, status')
    .eq('driverId', driverId)
    .order('departAt', { ascending: true });
  const { data, error } = await (includeHistory ? query : query.in('status', activeRideStatuses));
  if (error) throw error;
  const rides = data ?? [];
  if (rides.length === 0) return [];

  // Who has been accepted on each trip.
  const { data: accepted } = await supabase
    .from('ride_offers')
    .select('rideId, ride_requests!inner(passengerId)')
    .in('rideId', rides.map((r) => r.rideId))
    .eq('status', 'accepted');
  const bookings = (accepted ?? []) as unknown as { rideId: string; ride_requests: { passengerId: string } }[];
  const ids = [...new Set(bookings.map((a) => a.ride_requests.passengerId))];
  const { data: people } = ids.length
    ? await supabase.from('users').select('userId, firstName, lastName').in('userId', ids)
    : { data: [] };

  return rides.map((r) => {
    const a = bookings.find((x) => x.rideId === r.rideId);
    const p = a && people?.find((u) => u.userId === a.ride_requests.passengerId);
    const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '';
    return {
      rideId: r.rideId,
      start: r.driverStartLocation,
      end: r.driverEndLocation,
      departAt: r.departAt,
      status: r.status,
      passenger: a ? { name: name || 'Passenger' } : null,
    };
  });
}

export async function loadBookedRides(passengerId: string): Promise<BookedRide[]> {
  const { data, error } = await supabase
    .from('ride_offers')
    .select(
      `requestId, status, ride_requests!inner(passengerId),
       rides ( rideId, driverStartLocation, driverEndLocation, departAt, status,
               drivers ( driverRating, users ( firstName, lastName ) ) )`,
    )
    .eq('ride_requests.passengerId', passengerId);
  if (error) throw error;

  type Row = {
    requestId: string;
    status: string;
    rides: {
      rideId: string;
      driverStartLocation: string;
      driverEndLocation: string;
      departAt: string | null;
      status: RideStatus;
      drivers: {
        driverRating: number | null;
        users: { firstName: string | null; lastName: string | null } | null;
      } | null;
    } | null;
  };

  const list: BookedRide[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.rides) continue;
    const u = r.rides.drivers?.users;
    const name = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
    list.push({
      requestId: r.requestId,
      rideId: r.rides.rideId,
      start: r.rides.driverStartLocation,
      end: r.rides.driverEndLocation,
      departAt: r.rides.departAt,
      status: r.status,
      rideStatus: r.rides.status,
      driver: { name: name || 'Driver', rating: r.rides.drivers?.driverRating ?? null },
    });
  }
  list.sort((a, b) => (a.departAt ?? '').localeCompare(b.departAt ?? ''));
  return list;
}

// Passenger: cancel a booking (frees the ride again if it had been accepted).
export async function cancelBooking(requestId: string) {
  const { error } = await supabase.rpc('cancel_booking', { request_id: requestId });
  if (error) throw error;
}

// Driver: cancel a posted trip.
export async function cancelPostedRide(rideId: string) {
  const { error } = await supabase.rpc('cancel_ride', { ride_id: rideId });
  if (error) throw error;
}
