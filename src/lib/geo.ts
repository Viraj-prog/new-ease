export type Pt = { lat: number; lng: number };
export type Zone = "in_range" | "needs_approval" | "out";

const EARTH_KM = 6371;

// Closest distance (km) from a point to a route, and how far along the route that spot is.
export function nearestOnRoute(point: Pt, route: Pt[]) {
  const toXY = (p: Pt) => ({
    x:
      (((p.lng - point.lng) * Math.PI) / 180) *
      Math.cos((point.lat * Math.PI) / 180) *
      EARTH_KM,
    y: (((p.lat - point.lat) * Math.PI) / 180) * EARTH_KM,
  });

  let best = { dist: Infinity, position: 0 };
  for (let i = 0; i < route.length - 1; i++) {
    const a = toXY(route[i]);
    const b = toXY(route[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    const d = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (d < best.dist) best = { dist: d, position: i + t };
  }
  return best;
}

// in_range: within the driver's MDD. needs_approval: within MDD + the driver's extra limit.
export function classifyTrip(
  route: Pt[],
  pickup: Pt,
  dropoff: Pt,
  mdd: number,
  maxExtra: number,
) {
  const p = nearestOnRoute(pickup, route);
  const d = nearestOnRoute(dropoff, route);
  const worst = Math.max(p.dist, d.dist);

  let zone: Zone = "out";
  if (p.position < d.position) {
    if (worst <= mdd) zone = "in_range";
    else if (worst <= mdd + maxExtra) zone = "needs_approval";
  }
  return { zone, pickupKm: p.dist, dropoffKm: d.dist };
}

// [west, south, east, north] box around some points, with a little padding.
export function boundsOf(
  points: Pt[],
): [number, number, number, number] | undefined {
  if (points.length === 0) return undefined;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  const pad = 0.005;
  return [w - pad, s - pad, e + pad, n + pad];
}

export function localDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Start and end of the local day, as ISO strings for Supabase queries.
export function dayRange(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return { from: s.toISOString(), to: e.toISOString() };
}
