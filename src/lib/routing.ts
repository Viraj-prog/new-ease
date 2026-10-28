import * as Location from "expo-location";
import type { Pt } from "./geo";

// OpenStreetMap services require an identifying User-Agent. Put a real contact here.
const UA = "CMPT496-Rideshare/1.0 (randeriav@mymacewan.ca)";

// Nominatim allows about 1 request per second, so we space calls out.
let lastGeocode = 0;
export async function geocode(address: string): Promise<Pt | null> {
  const wait = 1100 - (Date.now() - lastGeocode);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocode = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.length) return null;
  return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
}

export async function getCurrentPoint(): Promise<Pt | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({});
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export type RouteInfo = {
  points: Pt[];
  distanceKm: number;
  durationMin: number;
};

// Route through any number of points, in order (OSRM wants longitude first).
export async function getRoute(stops: Pt[]): Promise<RouteInfo | null> {
  const coords = stops.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await res.json();
  if (json.code !== "Ok" || !json.routes?.length) return null;
  const r = json.routes[0];
  return {
    points: r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
      lat,
      lng,
    })),
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
  };
}
