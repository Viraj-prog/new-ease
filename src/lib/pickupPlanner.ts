import type { Pt } from './geo';

export type PickupPassenger = {
  requestId: string;
  pickup: Pt;
  dropoff: Pt;
  directMin: number;
};

export type PickupStop = Pt & { type: 'pickup' | 'dropoff'; requestId: string };
export type DrivingTimeMatrix = readonly (readonly (number | null)[])[];
export type PickupPlanResult =
  | { kind: 'planned'; stops: PickupStop[]; durationMin: number; method: 'exact' | 'heuristic' }
  | { kind: 'unavailable'; reason: 'no_feasible_order' | 'heuristic_exhausted'; message: string }
  | { kind: 'error'; message: string };

const TIME_CAP = 1.5;
const EXACT_PASSENGER_LIMIT = 5;
const TIME_EPSILON = 1e-8;

// Matrix rows and columns share this order. Values are in minutes and null means unreachable.
export function pickupPlanPoints(start: Pt, destination: Pt, passengers: readonly PickupPassenger[]): Pt[] {
  return [start, ...passengers.flatMap(({ pickup, dropoff }) => [pickup, dropoff]), destination];
}

function evaluateOrder(order: readonly number[], times: DrivingTimeMatrix, caps: readonly number[]) {
  const pickedAt: (number | undefined)[] = [];
  let previous = 0;
  let elapsed = 0;
  for (const stop of order) {
    const leg = times[previous][stop];
    if (leg === null) return Infinity;
    elapsed += leg;
    const passenger = Math.floor((stop - 1) / 2);
    if (stop % 2 === 1) pickedAt[passenger] = elapsed;
    else {
      const pickup = pickedAt[passenger];
      if (pickup === undefined || elapsed - pickup > caps[passenger] + TIME_EPSILON) return Infinity;
    }
    previous = stop;
  }
  const lastLeg = times[previous][times.length - 1];
  return lastLeg === null ? Infinity : elapsed + lastLeg;
}

function exactOrder(times: DrivingTimeMatrix, caps: readonly number[]) {
  const current: number[] = [];
  const pickedAt = caps.map(() => 0);
  const all = (1 << caps.length) - 1;
  const destination = times.length - 1;
  let bestDuration = Infinity;
  let best: number[] | null = null;

  function visit(previous: number, elapsed: number, picked: number, dropped: number) {
    if (elapsed >= bestDuration) return;
    if (dropped === all) {
      const lastLeg = times[previous][destination];
      if (lastLeg !== null && elapsed + lastLeg < bestDuration) {
        bestDuration = elapsed + lastLeg;
        best = [...current];
      }
      return;
    }

    for (let p = 0; p < caps.length; p += 1) {
      const bit = 1 << p;
      if (dropped & bit) continue;
      const isPickup = !(picked & bit);
      const stop = 2 * p + (isPickup ? 1 : 2);
      const leg = times[previous][stop];
      if (leg === null) continue;
      const arrival = elapsed + leg;

      // An onboard rider can only accumulate more time from this point onward.
      if (caps.some((cap, rider) =>
        (picked & ~dropped & (1 << rider)) !== 0 && arrival - pickedAt[rider] > cap + TIME_EPSILON,
      )) continue;

      if (isPickup) pickedAt[p] = arrival;
      current.push(stop);
      visit(stop, arrival, picked | bit, isPickup ? dropped : dropped | bit);
      current.pop();
    }
  }

  visit(0, 0, 0, 0);
  return best;
}

function insertPassengers(passengers: readonly number[], times: DrivingTimeMatrix, caps: readonly number[]) {
  let order: number[] = [];
  for (const p of passengers) {
    let best: number[] | null = null;
    let bestDuration = Infinity;
    for (let pickup = 0; pickup <= order.length; pickup += 1) {
      for (let dropoff = pickup; dropoff <= order.length; dropoff += 1) {
        const candidate = [
          ...order.slice(0, pickup), 2 * p + 1,
          ...order.slice(pickup, dropoff), 2 * p + 2,
          ...order.slice(dropoff),
        ];
        const duration = evaluateOrder(candidate, times, caps);
        if (duration < bestDuration) {
          best = candidate;
          bestDuration = duration;
        }
      }
    }
    if (!best) return null;
    order = best;
  }
  return order;
}

function heuristicOrder(times: DrivingTimeMatrix, caps: readonly number[]) {
  const tightestFirst = caps.map((_, index) => index).sort((a, b) => caps[a] - caps[b] || a - b);
  const routes = [tightestFirst, [...tightestFirst].reverse()];
  let best: number[] | null = null;
  let bestDuration = Infinity;
  for (const passengers of routes) {
    const order = insertPassengers(passengers, times, caps);
    if (!order) continue;
    const duration = evaluateOrder(order, times, caps);
    if (duration < bestDuration) {
      best = order;
      bestDuration = duration;
    }
  }
  if (!best) return null;

  // Bound local search for larger rides. Each swap must respect pickup order and the time cap.
  for (let pass = 0; pass < 4; pass += 1) {
    let improved: number[] | null = null;
    for (let a = 0; a < best.length - 1; a += 1) {
      for (let b = a + 1; b < best.length; b += 1) {
        const candidate: number[] = [...best];
        [candidate[a], candidate[b]] = [candidate[b], candidate[a]];
        const duration = evaluateOrder(candidate, times, caps);
        if (duration < bestDuration) {
          bestDuration = duration;
          improved = candidate;
        }
      }
    }
    if (!improved) break;
    best = improved;
  }
  return best;
}

// Pure solver. The driver starts before the returned stops and ends at destination after them.
export function planPickupOrder(
  start: Pt,
  destination: Pt,
  passengers: readonly PickupPassenger[],
  times: DrivingTimeMatrix,
): PickupPlanResult {
  const points = pickupPlanPoints(start, destination, passengers);
  const caps = passengers.map((passenger) => passenger.directMin * TIME_CAP);
  if (new Set(passengers.map(({ requestId }) => requestId)).size !== passengers.length ||
      passengers.some(({ requestId }) => !requestId.trim()) ||
      caps.some((cap) => !Number.isFinite(cap) || cap < 0)) {
    return { kind: 'error', message: 'Each passenger needs a unique request ID and a valid direct trip time.' };
  }
  if (times.length !== points.length || times.some((row) =>
    row.length !== points.length || row.some((leg) => leg !== null && (!Number.isFinite(leg) || leg < 0)),
  )) {
    return { kind: 'error', message: 'The driving time matrix does not match the ride stops.' };
  }

  const exact = passengers.length <= EXACT_PASSENGER_LIMIT;
  const order = exact ? exactOrder(times, caps) : heuristicOrder(times, caps);
  const complete = order !== null && order.length === points.length - 2 && new Set(order).size === order.length;
  const durationMin = complete ? evaluateOrder(order, times, caps) : Infinity;
  if (order === null || !Number.isFinite(durationMin)) {
    return exact
      ? { kind: 'unavailable', reason: 'no_feasible_order', message: 'No stop order satisfies the passenger time cap and available roads.' }
      : { kind: 'unavailable', reason: 'heuristic_exhausted', message: 'The planner could not find a stop order that satisfies every passenger’s time cap.' };
  }
  return {
    kind: 'planned',
    method: exact ? 'exact' : 'heuristic',
    durationMin,
    stops: order.map((stop) => ({
      ...points[stop],
      type: stop % 2 === 1 ? 'pickup' : 'dropoff',
      requestId: passengers[Math.floor((stop - 1) / 2)].requestId,
    })),
  };
}
