// Run with Node 24+. Add --live to request an Edmonton matrix from OSRM.
import assert from 'node:assert/strict';
import { getDrivingTimeMatrix } from '../src/lib/osrmTable.ts';
import { pickupPlanPoints, planPickupOrder } from '../src/lib/pickupPlanner.ts';

const southgate = { lat: 53.4877, lng: -113.5156 };
const university = { lat: 53.5232, lng: -113.5263 };
const whyteAve = { lat: 53.5186, lng: -113.5011 };
const downtown = { lat: 53.5438, lng: -113.4903 };
const kingsway = { lat: 53.5620, lng: -113.5066 };
const nait = { lat: 53.5684, lng: -113.5027 };
const riderA = { requestId: 'University → Downtown', pickup: university, dropoff: downtown, directMin: 8 };
const riderB = { requestId: 'Whyte Avenue → Kingsway', pickup: whyteAve, dropoff: kingsway, directMin: 9 };
const riders = [riderA, riderB];

const lineMatrix = (positions) => positions.map((from) => positions.map((to) => Math.abs(to - from)));
const subset = (matrix, indices) => indices.map((i) => indices.map((j) => matrix[i][j]));
const stopLabels = (plan) => plan.stops.map(({ type, requestId }) => `${type} ${requestId}`);

function checkPlan(label, passengers, times, expectedMethod = 'exact') {
  const result = planPickupOrder(southgate, nait, passengers, times);
  assert.equal(result.kind, 'planned', label);
  assert.equal(result.method, expectedMethod);
  assert.equal(result.stops.length, 2 * passengers.length);

  const onboard = new Map();
  const completed = new Set();
  let elapsed = 0;
  let previous = 0;
  for (const stop of result.stops) {
    const index = passengers.findIndex(({ requestId }) => requestId === stop.requestId);
    assert.ok(index >= 0);
    const next = index * 2 + (stop.type === 'pickup' ? 1 : 2);
    assert.notEqual(times[previous][next], null);
    elapsed += times[previous][next];
    if (stop.type === 'pickup') {
      assert.ok(!onboard.has(stop.requestId) && !completed.has(stop.requestId));
      onboard.set(stop.requestId, elapsed);
    } else {
      assert.ok(onboard.has(stop.requestId));
      assert.ok(elapsed - onboard.get(stop.requestId) <= 1.5 * passengers[index].directMin + 1e-8);
      onboard.delete(stop.requestId);
      completed.add(stop.requestId);
    }
    previous = next;
  }
  assert.equal(onboard.size, 0);
  assert.equal(completed.size, passengers.length);
  assert.notEqual(times[previous].at(-1), null);
  assert.equal(result.durationMin, elapsed + times[previous].at(-1));
  console.log(`${label}: ${result.durationMin.toFixed(2)} min — ${stopLabels(result).join('; ')}`);
  return result;
}

if (process.argv.includes('--live')) {
  const matrix = await getDrivingTimeMatrix(pickupPlanPoints(southgate, nait, riders));
  if (matrix.kind === 'error') {
    console.error(matrix.message);
    process.exitCode = 1;
  } else {
    const { times } = matrix;
    assert.notEqual(times[1][2], null);
    assert.notEqual(times[3][4], null);
    const a = { ...riderA, directMin: times[1][2] };
    const b = { ...riderB, directMin: times[3][4] };
    checkPlan('Live OSRM, one rider', [a], subset(times, [0, 1, 2, 5]));
    checkPlan('Live OSRM, two riders', [a, b], times);
  }
}

// Deterministic travel times for the Edmonton landmarks, independent of the live service.
const onTheWay = lineMatrix([0, 4, 12, 7, 16, 20]);
assert.equal(checkPlan('Edmonton fixture, one rider', [riderA], subset(onTheWay, [0, 1, 2, 5])).durationMin, 20);
const two = checkPlan('Edmonton fixture, two riders', riders, onTheWay);
assert.equal(two.durationMin, 20);
assert.deepEqual(stopLabels(two), [
  `pickup ${riderA.requestId}`, `pickup ${riderB.requestId}`,
  `dropoff ${riderA.requestId}`, `dropoff ${riderB.requestId}`,
]);

// In this directed fixture, each rider fits alone. Serving both requires an
// interleaving that puts at least one rider over the nine-minute cap.
const directed = [
  [0, 2, null, 3, null, 15],
  [null, 0, 6, 5, 11, 13],
  [null, null, 0, null, 5, 7],
  [null, null, 5, 0, 6, 8],
  [null, null, null, null, 0, 2],
  [null, null, null, null, null, 0],
];
const tightA = { ...riderA, directMin: 6 };
const tightB = { ...riderB, directMin: 6 };
checkPlan('Time-cap fixture, rider A alone', [tightA], subset(directed, [0, 1, 2, 5]));
checkPlan('Time-cap fixture, rider B alone', [tightB], subset(directed, [0, 3, 4, 5]));
checkPlan('Time-cap fixture, both with relaxed caps', [
  { ...tightA, directMin: 9 }, { ...tightB, directMin: 9 },
], directed);
const rejected = planPickupOrder(southgate, nait, [tightA, tightB], directed);
assert.equal(rejected.kind, 'unavailable');
assert.equal(rejected.reason, 'no_feasible_order');
console.log(`Edmonton rejection fixture: ${rejected.message}`);

const six = Array.from({ length: 6 }, (_, index) => ({ ...riderA, requestId: `Rider ${index + 1}`, directMin: 2 }));
checkPlan('Six-rider insertion and swap fixture', six, lineMatrix([0, ...six.flatMap((_, index) => [
  index * 3 + 1, index * 3 + 3,
]), 20]), 'heuristic');
assert.equal(planPickupOrder(southgate, nait, [], [[0, 4], [4, 0]]).durationMin, 4);
assert.equal(planPickupOrder(southgate, nait, riders, [[0]]).kind, 'error');

const fetchOriginal = globalThis.fetch;
let calls = 0;
try {
  const points = [{ lat: 53.51, lng: -113.6 }, { lat: 53.52, lng: -113.6 }];
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.match(url, /\/table\/v1\/driving\/.*annotations=duration$/);
    return Response.json({ code: 'Ok', durations: [[0, 90], [null, 0]] });
  };
  const [first, second] = await Promise.all([getDrivingTimeMatrix(points), getDrivingTimeMatrix(points)]);
  assert.deepEqual(first, { kind: 'matrix', times: [[0, 1.5], [null, 0]] });
  assert.deepEqual(second, first);
  assert.deepEqual(await getDrivingTimeMatrix(points), first);
  assert.equal(calls, 1);

  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  const failed = await getDrivingTimeMatrix([...points].reverse());
  assert.equal(failed.kind, 'error');
  console.log('OSRM adapter: seconds converted, simultaneous and cached reads share one request, network failure returned as an error.');
} finally {
  globalThis.fetch = fetchOriginal;
}
