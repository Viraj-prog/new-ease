import { classifyTrip, dayRange, localDate, type Pt } from './geo';
import { getRoute } from './routing';
import { supabase } from './supabase';

// A trip a driver has posted, with the road route drawn for it.
export type Trip = {
  rideId: string;
  route: Pt[];
  distanceKm: number;
  durationMin: number;
  mdd: number;
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

  return {
    rideId: data.rideId,
    route: r.points,
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    mdd: args.mdd,
    when: args.when,
  };
}

// Driver: is this trip still unfinished? False once it was finished or cancelled anywhere.
export async function isTripActive(rideId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rides')
    .select('isCompleted')
    .eq('rideId', rideId)
    .maybeSingle();
  if (error) throw error;
  return !!data && !data.isCompleted;
}

// Driver: their earliest unfinished trip, so it can be shown again after a restart.
export async function loadActiveTrip(driverId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('rides')
    .select('rideId, route, tripMdd, departAt')
    .eq('driverId', driverId)
    .or('isCompleted.is.null,isCompleted.eq.false')
    .order('departAt', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.route?.points?.length) return null;
  return {
    rideId: data.rideId,
    route: data.route.points,
    distanceKm: data.route.distanceKm,
    durationMin: data.route.durationMin,
    mdd: data.tripMdd ?? 2,
    when: data.departAt ? new Date(data.departAt) : new Date(),
  };
}

// Driver: mark the trip finished (also declines requests still waiting on it).
export async function finishTrip(rideId: string) {
  const { error } = await supabase.rpc('finish_trip', { ride_id: rideId });
  if (error) throw error;
}

// Driver: passengers whose requests fall near the trip's route.
export async function loadRequests(trip: Trip): Promise<Req[]> {
  const { from, to } = dayRange(trip.when);
  const { data, error } = await supabase
    .from('ride_requests')
    .select('*')
    .gte('departAt', from)
    .lte('departAt', to)
    .or(`status.eq.open,and(status.eq.pending,selectedRideId.eq.${trip.rideId})`);
  if (error) throw error;

  const found: Req[] = [];
  for (const r of data ?? []) {
    const pickup = { lat: r.pickupLat, lng: r.pickupLng };
    const dropoff = { lat: r.dropoffLat, lng: r.dropoffLng };
    const c = classifyTrip(trip.route, pickup, dropoff, trip.mdd);
    if (c.zone === 'out') continue;
    found.push({
      id: r.id,
      status: r.status,
      pickup,
      passengerId: r.passengerId,
      passengerName: null,
      departAt: r.departAt ?? null,
      pickupKm: c.pickupKm,
      dropoffKm: c.dropoffKm,
    });
  }

  // Names are only needed for passengers who have actually asked for this ride.
  const askingIds = [...new Set(found.filter((r) => r.status === 'pending').map((r) => r.passengerId))];
  if (askingIds.length > 0) {
    const { data: people, error: peopleError } = await supabase
      .from('users')
      .select('userId, firstName, lastName')
      .in('userId', askingIds);
    // A blocked read (policy missing) returns no rows rather than an error, so check both.
    if (peopleError || !people?.length) {
      console.warn(
        'No passenger names came back. Run section 10 of supabase/driver_setup.sql.',
        peopleError?.message ?? '',
      );
    }
    for (const r of found) {
      const p = people?.find((u) => u.userId === r.passengerId);
      const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '';
      r.passengerName = name || null;
    }
  }
  return found;
}

// Driver: accept or decline a request. Accepting is one database function that checks the
// ride is still free, marks it taken, and declines the other pending requests for it.
export async function answerRequest(req: Req, accept: boolean) {
  if (accept) {
    const { error } = await supabase.rpc('accept_request', { request_id: req.id });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('ride_requests')
    .update({ status: 'declined' })
    .eq('id', req.id);
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
    selectedRideId: null,
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
  from: Pt, to: Pt, when: Date, userId: string, directKm: number,
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
    .eq('status', 'scheduled')
    .eq('isCompleted', false)
    .eq('occupied', false);
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
      fare: r.pricePerKm == null ? null : directKm * r.pricePerKm,
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

// Passenger: where their request stands (open, pending, accepted, declined).
export async function getRequestStatus(requestId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('status')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

// Passenger: withdraw a request that is still waiting. It goes back to open, so other
// drivers can still see it. Returns false if the driver had already answered.
export async function cancelRequest(requestId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ride_requests')
    .update({ status: 'open', selectedRideId: null, needsApproval: false })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Passenger: ask this driver to take them.
export async function sendRequest(requestId: string, r: Result) {
  const { data, error } = await supabase
    .from('ride_requests')
    .update({
      selectedRideId: r.rideId,
      status: 'pending',
      needsApproval: false,
    })
    .eq('id', requestId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This request has already been sent. Search again to start another request.');
}

// ---- Rides tab ----

// A trip the driver posted and has not finished.
export type PostedRide = {
  rideId: string;
  start: string;
  end: string;
  departAt: string | null;
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
  driver: { name: string; rating: number | null };
};

export async function loadPostedRides(driverId: string): Promise<PostedRide[]> {
  const { data, error } = await supabase
    .from('rides')
    .select('rideId, driverStartLocation, driverEndLocation, departAt')
    .eq('driverId', driverId)
    .or('isCompleted.is.null,isCompleted.eq.false')
    .order('departAt', { ascending: true });
  if (error) throw error;
  const rides = data ?? [];
  if (rides.length === 0) return [];

  // Who has been accepted on each trip.
  const { data: accepted } = await supabase
    .from('ride_requests')
    .select('selectedRideId, passengerId')
    .in('selectedRideId', rides.map((r) => r.rideId))
    .eq('status', 'accepted');
  const ids = [...new Set((accepted ?? []).map((a) => a.passengerId))];
  const { data: people } = ids.length
    ? await supabase.from('users').select('userId, firstName, lastName').in('userId', ids)
    : { data: [] };

  return rides.map((r) => {
    const a = accepted?.find((x) => x.selectedRideId === r.rideId);
    const p = a && people?.find((u) => u.userId === a.passengerId);
    const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '';
    return {
      rideId: r.rideId,
      start: r.driverStartLocation,
      end: r.driverEndLocation,
      departAt: r.departAt,
      passenger: a ? { name: name || 'Passenger' } : null,
    };
  });
}

export async function loadBookedRides(passengerId: string): Promise<BookedRide[]> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select(
      `id, status, selectedRideId,
       rides ( rideId, driverStartLocation, driverEndLocation, departAt, isCompleted,
               drivers ( driverRating, users ( firstName, lastName ) ) )`,
    )
    .eq('passengerId', passengerId)
    .in('status', ['pending', 'accepted']);
  if (error) throw error;

  type Row = {
    id: string;
    status: string;
    rides: {
      rideId: string;
      driverStartLocation: string;
      driverEndLocation: string;
      departAt: string | null;
      isCompleted: boolean | null;
      drivers: {
        driverRating: number | null;
        users: { firstName: string | null; lastName: string | null } | null;
      } | null;
    } | null;
  };

  const list: BookedRide[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    // A finished ride moves to the Previous Trips tab.
    if (!r.rides || r.rides.isCompleted) continue;
    const u = r.rides.drivers?.users;
    const name = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
    list.push({
      requestId: r.id,
      rideId: r.rides.rideId,
      start: r.rides.driverStartLocation,
      end: r.rides.driverEndLocation,
      departAt: r.rides.departAt,
      status: r.status,
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
