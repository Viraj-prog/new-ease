// Run with Node 24+ using node scripts/check-google-maps-route.mjs.
import assert from 'node:assert/strict';
import { buildGoogleMapsLegs } from '../src/lib/googleMapsRoute.ts';

const start = { lat: 53.4877, lng: -113.5156 };
const destination = { lat: 53.5684, lng: -113.5027 };
const coordinate = ({ lat, lng }) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
const stops = Array.from({ length: 25 }, (_, index) => ({
  lat: 53.5 + index * 0.001,
  lng: -113.5,
}));

const solo = new URL(buildGoogleMapsLegs(start, destination, [])[0]);
assert.equal(solo.searchParams.get('origin'), coordinate(start));
assert.equal(solo.searchParams.get('destination'), coordinate(destination));
assert.equal(solo.searchParams.has('waypoints'), false);

for (const count of [1, 3, 4, 7, 9, 22, 25]) {
  const plannedStops = stops.slice(0, count);
  const links = buildGoogleMapsLegs(start, destination, plannedStops);
  const targets = [];
  let previousDestination = null;
  for (const link of links) {
    const { origin, pathname, searchParams } = new URL(link);
    assert.equal(origin + pathname, 'https://www.google.com/maps/dir/');
    assert.equal(searchParams.get('api'), '1');
    assert.equal(searchParams.get('travelmode'), 'driving');
    assert.equal(searchParams.get('dir_action'), 'navigate');
    assert.equal(searchParams.get('origin'), previousDestination);
    assert.ok(link.length <= 2048);
    const waypoints = searchParams.get('waypoints')?.split('|') ?? [];
    assert.ok(waypoints.length <= 3);
    previousDestination = searchParams.get('destination');
    targets.push(...waypoints, previousDestination);
  }
  assert.deepEqual(targets, [...plannedStops, destination].map(coordinate));
  assert.deepEqual(buildGoogleMapsLegs(start, destination, plannedStops), links);
}

assert.throws(() => buildGoogleMapsLegs(start, destination, [{ lat: 100, lng: 0 }]), /invalid navigation stop/);
console.log('Google Maps links passed: solo endpoints, device origin, waypoint limit, consecutive legs, and stable resume links.');
