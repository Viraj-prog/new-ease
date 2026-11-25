import { classifyTrip, dayRange, localDate, type Pt } from './geo';
import { buildGoogleMapsLegs } from './googleMapsRoute';
import { getDrivingTimeMatrix, queuePlanningOsrmRequest } from './osrmTable';
import { pickupPlanMatches, pickupPlanPoints, planPickupOrder, type PickupPassenger, type PickupStop } from './pickupPlanner';
import { getRoute } from './routing';
import { supabase } from './supabase';

export type RideStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type RidePlan = {
  stops: PickupStop[];
  points: Pt[];
  distanceKm: number;
  durationMin: number;
  passengerIds: string[];
};
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
  status: RideStatus;
  startText: string;
  endText: string;
  start: Pt;
  destination: Pt;
  route: Pt[];
  plan: RidePlan | null;
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
  planning: PlanningRequest;
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
    status: 'scheduled',
    startText: args.startText || 'Current location',
    endText: args.endText,
    start: args.start,
    destination: args.end,
    route: r.points,
    plan: null,
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    mdd: args.mdd,
    pricePerKm: args.pricePerKm,
    when: args.when,
  };
}

const tripFields = 'rideId, status, driverStartLocation, driverEndLocation, route, tripMdd, departAt, pricePerKm, startLat, startLng, endLat, endLng, plan';

// Driver: their earliest unfinished trip, so it can be shown again after a restart.
export async function loadActiveTrip(driverId: string): Promise<Trip | null> {
  if (!isUuid(driverId)) return null;
  const { data, error } = await supabase
    .from('rides')
    .select(tripFields)
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
    .select(tripFields)
    .eq('rideId', rideId)
    .eq('driverId', driverId)
    .in('status', activeRideStatuses)
    .maybeSingle();
  if (error) throw error;
  return asTrip(data);
}

function asTrip(data: {
  rideId: string;
  status: RideStatus;
  driverStartLocation: string;
  driverEndLocation: string;
  route: { points: Pt[]; distanceKm: number; durationMin: number } | null;
  tripMdd: number | null;
  departAt: string | null;
  pricePerKm: number | null;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  plan: RidePlan | null;
} | null): Trip | null {
  if (!isUuid(data?.rideId) || !data.route?.points?.length) return null;
  return {
    rideId: data.rideId,
    status: data.status,
    startText: data.driverStartLocation,
    endText: data.driverEndLocation,
    start: data.startLat == null || data.startLng == null
      ? data.route.points[0] : { lat: data.startLat, lng: data.startLng },
    destination: data.endLat == null || data.endLng == null
      ? data.route.points[data.route.points.length - 1] : { lat: data.endLat, lng: data.endLng },
    route: data.route.points,
    plan: data.plan?.points?.length && Array.isArray(data.plan.stops) && Array.isArray(data.plan.passengerIds)
      ? data.plan : null,
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
async function loadRequests(trip: Trip, driverId: string) {
  const { from, to } = dayRange(trip.when);
  const fields = `${planningFields}, departAt, directKm` as const;
  const [searching, offers] = await Promise.all([
    trip.status === 'scheduled'
      ? supabase.from('ride_requests').select(fields).eq('status', 'open').neq('passengerId', driverId)
        .gte('departAt', from).lte('departAt', to)
      : Promise.resolve({ data: null, error: null }),
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
      status === 'accepted' || (trip.status === 'scheduled' && status === 'pending'
        && ['open', 'pending'].includes(ride_requests.status)),
    ).map((offer) => ({ row: offer.ride_requests, status: offer.status, fare: offer.fare })),
    ...(searching.data ?? []).filter((row) => !offeredIds.has(row.id))
      .map((row) => ({ row, status: 'open', fare: null })),
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
      fare: status === 'accepted' || trip.pricePerKm == null || r.directKm == null
        ? fare : Math.round(trip.pricePerKm * r.directKm * 100) / 100,
      planning: pickPlanningFields(r),
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
  return {
    requests: found,
    accepted: linked.filter((offer) => offer.status === 'accepted')
      .map((offer) => pickPlanningFields(offer.ride_requests))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export async function declineRequest(rideId: string, requestId: string) {
  const { error } = await supabase.rpc('decline_offer', { request_id: requestId, ride_id: rideId });
  if (error) throw error;
}

const planningFields = 'id, passengerId, pickupLat, pickupLng, dropoffLat, dropoffLng, directMin, status';
type PlanningRequest = {
  id: string;
  passengerId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  directMin: number | null;
  status: string | null;
};
function pickPlanningFields(r: PlanningRequest): PlanningRequest {
  return {
    id: r.id, passengerId: r.passengerId, pickupLat: r.pickupLat, pickupLng: r.pickupLng,
    dropoffLat: r.dropoffLat, dropoffLng: r.dropoffLng, directMin: r.directMin, status: r.status,
  };
}
type PlannedAcceptance =
  | { kind: 'accepted'; trip: Trip }
  | { kind: 'blocked' | 'retry'; message: string };

const acceptingRides = new Set<string>();
const tooLong = 'Accepting this passenger would make another passenger’s ride too long.';

function loadPlanningRequest(requestId: string) {
  return supabase.from('ride_requests').select(planningFields).eq('id', requestId).maybeSingle();
}

async function loadAcceptedPlanningRequests(rideId: string) {
  const { data, error } = await supabase.from('ride_offers')
    .select(`ride_requests!inner(${planningFields})`)
    .eq('rideId', rideId)
    .eq('status', 'accepted')
    .order('requestId');
  if (error) throw error;
  return ((data ?? []) as unknown as { ride_requests: PlanningRequest }[]).map((offer) => offer.ride_requests);
}

type PlanBuild = { kind: 'planned'; plan: RidePlan } | { kind: 'blocked' | 'retry'; message: string };
const PLAN_CACHE_MS = 10 * 60 * 1000;
const plannedRoutes = new Map<string, { result: PlanBuild; expiresAt: number }>();
const planningRoutes = new Map<string, Promise<PlanBuild>>();

function planKey(trip: Trip, requests: readonly PlanningRequest[]) {
  return JSON.stringify([trip.rideId, trip.start, trip.destination, requests.map((r) => [
    r.id, r.passengerId, r.pickupLat, r.pickupLng, r.dropoffLat, r.dropoffLng, r.directMin,
  ])]);
}

function planRide(trip: Trip, requests: readonly PlanningRequest[]): Promise<PlanBuild> {
  const key = planKey(trip, requests);
  const cached = plannedRoutes.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result);
  const pending = planningRoutes.get(key);
  if (pending) return pending;
  const job = buildPickupPlan(trip, requests).then((result) => {
    if (result.kind !== 'retry') {
      plannedRoutes.delete(key);
      plannedRoutes.set(key, { result, expiresAt: Date.now() + PLAN_CACHE_MS });
      const oldest = plannedRoutes.keys().next().value;
      if (plannedRoutes.size > 48 && oldest !== undefined) plannedRoutes.delete(oldest);
    }
    return result;
  }).finally(() => planningRoutes.delete(key));
  planningRoutes.set(key, job);
  return job;
}

function fetchPlannedRoute(stops: Pt[]) {
  return queuePlanningOsrmRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      return { route: await getRoute(stops, controller.signal) };
    } catch {
      return { message: controller.signal.aborted
        ? 'The routing service timed out. Try again.'
        : 'Could not load the planned route. Try again.' };
    } finally {
      clearTimeout(timeout);
    }
  });
}

async function buildPickupPlan(trip: Trip, requests: readonly PlanningRequest[]): Promise<PlanBuild> {
  if (requests.some((r) => ![r.pickupLat, r.pickupLng, r.dropoffLat, r.dropoffLng].every(Number.isFinite))) {
    return { kind: 'blocked', message: 'A passenger is missing a pickup or drop-off location.' };
  }
  const passengers: PickupPassenger[] = requests.map((r) => ({
    requestId: r.id,
    pickup: { lat: r.pickupLat, lng: r.pickupLng },
    dropoff: { lat: r.dropoffLat, lng: r.dropoffLng },
    directMin: r.directMin ?? 0,
  }));
  const matrix = await getDrivingTimeMatrix(pickupPlanPoints(trip.start, trip.destination, passengers));
  if (matrix.kind === 'error') return { kind: 'retry', message: matrix.message };

  // Legacy bookings can lack a stored direct duration. Use their direct table leg.
  for (const [i, passenger] of passengers.entries()) {
    if (requests[i].directMin !== null) continue;
    const direct = matrix.times[2 * i + 1][2 * i + 2];
    if (direct === null) return { kind: 'blocked', message: 'A passenger’s direct trip could not be routed.' };
    passenger.directMin = direct;
  }
  const order = planPickupOrder(trip.start, trip.destination, passengers, matrix.times);
  if (order.kind === 'unavailable') return { kind: 'blocked', message: tooLong };
  if (order.kind === 'error') return { kind: 'blocked', message: order.message };

  const { route, message } = await fetchPlannedRoute([trip.start, ...order.stops, trip.destination]);
  if (message) return { kind: 'retry', message };
  if (!route || route.points.length < 2 || route.legDurationsMin.length !== order.stops.length + 1 ||
      ![route.distanceKm, route.durationMin, ...route.legDurationsMin].every((n) => Number.isFinite(n) && n >= 0)) {
    return { kind: 'retry', message: 'The routing service did not return a complete route. Try again.' };
  }

  // Verify the actual multi-stop road route, which can differ from the table legs.
  const onboardSince = new Map<string, number>();
  const caps = new Map(passengers.map((p) => [p.requestId, 1.5 * p.directMin]));
  let elapsed = 0;
  for (const [i, stop] of order.stops.entries()) {
    elapsed += route.legDurationsMin[i];
    if (stop.type === 'pickup') onboardSince.set(stop.requestId, elapsed);
    else if (elapsed - onboardSince.get(stop.requestId)! > caps.get(stop.requestId)! + 1e-8) {
      return { kind: 'blocked', message: tooLong };
    }
  }

  const plan: RidePlan = {
    stops: order.stops,
    points: route.points,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    passengerIds: [...new Set(requests.map((r) => r.passengerId))],
  };
  return { kind: 'planned', plan };
}

export type DriverRideState = {
  trip: Trip;
  requests: Req[];
  accepted: PlanningRequest[];
  planError?: string;
};

const savingPlans = new Map<string, Promise<RidePlan | null>>();

function reconcilePickupPlan(trip: Trip, accepted: readonly PlanningRequest[]) {
  const key = planKey(trip, accepted);
  const pending = savingPlans.get(key);
  if (pending) return pending;
  const job = (async () => {
    let plan: RidePlan | null = null;
    if (accepted.length > 0) {
      const result = await planRide(trip, accepted);
      if (result.kind !== 'planned') {
        throw new Error(result.kind === 'retry' ? result.message : 'No valid pickup plan for the remaining passengers.');
      }
      plan = result.plan;
    }
    const { error } = await supabase.rpc('save_plan', { ride_id: trip.rideId, plan });
    if (error) throw error;
    return plan;
  })().finally(() => savingPlans.delete(key));
  savingPlans.set(key, job);
  return job;
}

export async function loadDriverRideState(trip: Trip, driverId: string): Promise<DriverRideState> {
  const { requests, accepted } = await loadRequests(trip, driverId);
  if (trip.status !== 'scheduled' || pickupPlanMatches(trip.plan, accepted)) {
    return { trip, requests, accepted };
  }
  try {
    const plan = await reconcilePickupPlan(trip, accepted);
    return { trip: { ...trip, plan }, requests, accepted };
  } catch (error) {
    const detail = (error as { message?: string } | null)?.message;
    return {
      trip: { ...trip, plan: null }, requests, accepted,
      planError: detail ? `Could not update the pickup plan. ${detail}` : 'Could not update the pickup plan. Refresh to retry.',
    };
  }
}

export async function startTrip(driverId: string, rideId: string) {
  const trip = await loadDriverTrip(rideId, driverId);
  if (!trip) throw new Error('This scheduled ride is no longer available.');
  if (trip.status === 'in_progress') return;

  const accepted = await loadAcceptedPlanningRequests(rideId);
  const plan = pickupPlanMatches(trip.plan, accepted) ? trip.plan : await reconcilePickupPlan(trip, accepted);
  buildGoogleMapsLegs(trip.start, trip.destination, plan?.stops ?? []);
  const { error } = await supabase.rpc('start_trip', { ride_id: rideId });
  if (error) throw error;
}

export type CandidateEstimate =
  | { kind: 'available'; extraKm: number }
  | { kind: 'blocked' | 'retry'; message: string };

export function requestEstimateKey(state: DriverRideState, request: Req) {
  return JSON.stringify([
    state.trip.status,
    planKey(state.trip, [...state.accepted, request.planning]),
    state.trip.plan?.distanceKm ?? state.trip.distanceKm,
  ]);
}

export async function estimateDriverRequest(state: DriverRideState, request: Req): Promise<CandidateEstimate> {
  if (state.trip.status !== 'scheduled') return { kind: 'blocked', message: 'This ride has already started.' };
  const result = await planRide(state.trip, [...state.accepted, request.planning]);
  if (result.kind !== 'planned') return result;
  return {
    kind: 'available',
    extraKm: result.plan.distanceKm - (state.trip.plan?.distanceKm ?? state.trip.distanceKm),
  };
}

// Road planning completes before the single atomic booking-and-plan RPC.
export async function acceptPlannedRequest(
  driverId: string, rideId: string, requestId: string,
): Promise<PlannedAcceptance> {
  if (![driverId, rideId, requestId].every(isUuid)) {
    return { kind: 'blocked', message: 'This ride or passenger request is no longer available.' };
  }
  if (acceptingRides.has(rideId)) {
    return { kind: 'blocked', message: 'An acceptance is already in progress for this ride.' };
  }
  acceptingRides.add(rideId);
  try {
    const [trip, accepted, candidate] = await Promise.all([
      loadDriverTrip(rideId, driverId),
      loadAcceptedPlanningRequests(rideId),
      loadPlanningRequest(requestId),
    ]);
    if (candidate.error) throw candidate.error;
    if (!trip || trip.status !== 'scheduled' || !candidate.data) {
      return { kind: 'blocked', message: 'This ride or passenger request is no longer available.' };
    }
    if (accepted.some(({ id }) => id === requestId)) return { kind: 'accepted', trip };
    if (candidate.data.status === 'accepted') {
      return { kind: 'blocked', message: 'Another driver already accepted this request.' };
    }
    if (candidate.data.status !== 'open' && candidate.data.status !== 'pending') {
      return { kind: 'blocked', message: 'This request is no longer open.' };
    }

    const candidatePickup = { lat: candidate.data.pickupLat, lng: candidate.data.pickupLng };
    const candidateDropoff = { lat: candidate.data.dropoffLat, lng: candidate.data.dropoffLng };
    if (classifyTrip(trip.route, candidatePickup, candidateDropoff, trip.mdd).zone === 'out') {
      return { kind: 'blocked', message: 'This passenger’s stops are outside your route limits.' };
    }
    const planned = await planRide(trip, [...accepted, pickPlanningFields(candidate.data)]);
    if (planned.kind !== 'planned') return planned;
    const { plan } = planned;

    const [latest, latestCandidate] = await Promise.all([
      loadAcceptedPlanningRequests(rideId), loadPlanningRequest(requestId),
    ]);
    if (latestCandidate.error) throw latestCandidate.error;
    if (latestCandidate.data?.status === 'accepted') {
      if (latest.some(({ id }) => id === requestId)) {
        const latestTrip = await loadDriverTrip(rideId, driverId);
        if (latestTrip) return { kind: 'accepted', trip: latestTrip };
      }
      return { kind: 'blocked', message: 'Another driver already accepted this request.' };
    }
    if (JSON.stringify(latestCandidate.data) !== JSON.stringify(candidate.data)) {
      return { kind: 'retry', message: 'This passenger’s request changed while planning. Try again.' };
    }
    if (JSON.stringify(latest) !== JSON.stringify(accepted)) {
      return { kind: 'retry', message: 'The passenger list changed while planning. Retry with the current list.' };
    }
    const { error } = await supabase.rpc('accept_request', {
      request_id: requestId, ride_id: rideId, new_plan: plan,
    });
    if (error) throw error;
    return { kind: 'accepted', trip: { ...trip, plan } };
  } finally {
    acceptingRides.delete(rideId);
  }
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

export async function loadReopenedPassengerRequests(passengerId: string) {
  const { data, error } = await supabase.from('ride_offers')
    .select('id, requestId, ride_requests!inner(passengerId, status)')
    .eq('ride_requests.passengerId', passengerId)
    .eq('ride_requests.status', 'open')
    .eq('cancelledByDriver', true)
    .eq('status', 'cancelled')
    .order('createdAt', { ascending: false })
    .order('id');
  if (error) throw error;
  return data ?? [];
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

// A rider's search with no request waiting on any driver: it is still visible to drivers, who
// can accept it directly.
export type OpenSearch = { requestId: string; destination: string | null; departAt: string | null };

export async function loadOpenSearches(passengerId: string): Promise<OpenSearch[]> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('id, departAt, dropoffText, ride_offers(status)')
    .eq('passengerId', passengerId)
    .eq('status', 'open')
    .is('acceptedRideId', null)
    .order('departAt', { ascending: true });
  if (error) throw error;

  type Row = {
    id: string;
    departAt: string | null;
    dropoffText: string | null;
    ride_offers: { status: OfferStatus }[] | null;
  };
  return ((data ?? []) as unknown as Row[])
    // A search with a request still waiting is already listed under that driver.
    .filter((r) => !r.ride_offers?.some((offer) => offer.status === 'pending'))
    .map((r) => ({ requestId: r.id, destination: r.dropoffText?.trim() || null, departAt: r.departAt }));
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
