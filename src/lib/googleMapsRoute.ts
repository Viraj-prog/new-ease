import type { Pt } from './geo';

// The universal URL can open in a mobile browser, which supports three waypoints.
const MAX_WAYPOINTS = 3;
const MAPS_DIRECTIONS = 'https://www.google.com/maps/dir/';

function coordinate({ lat, lng }: Pt) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('This ride has an invalid navigation stop.');
  }
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function buildGoogleMapsLegs(start: Pt, destination: Pt, stops: readonly Pt[]): string[] {
  const targets = [...stops, destination].map(coordinate);
  // Omitting origin lets Google Maps start at the device location.
  let origin = stops.length ? undefined : coordinate(start);
  const legs: string[] = [];
  for (let offset = 0; offset < targets.length; offset += MAX_WAYPOINTS + 1) {
    const targetsForLeg = targets.slice(offset, offset + MAX_WAYPOINTS + 1);
    const end = targetsForLeg.pop()!;
    const query = ['api=1', 'travelmode=driving', 'dir_action=navigate', `destination=${encodeURIComponent(end)}`];
    if (origin) query.push(`origin=${encodeURIComponent(origin)}`);
    if (targetsForLeg.length) query.push(`waypoints=${encodeURIComponent(targetsForLeg.join('|'))}`);
    legs.push(`${MAPS_DIRECTIONS}?${query.join('&')}`);
    origin = end;
  }
  return legs;
}
