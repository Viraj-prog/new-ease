import * as Location from 'expo-location';
import type { Pt } from './geo';
import { geocode, getCurrentPoint, UA } from './routing';

// The words that stand for "where I am now" in the Start or End cell.
export const CURRENT_LABEL = 'Current location';
export const isCurrentLabel = (text: string) => text.trim().toLowerCase() === CURRENT_LABEL.toLowerCase();

// The phone's position. If location is off or blocked there is no point waiting for a fix, so that
// is checked first and answers at once (null = "could not be found").
async function currentPoint(): Promise<Pt | null> {
  if (!(await Location.hasServicesEnabledAsync())) return null;
  const permission = await Location.getForegroundPermissionsAsync();
  // Blocked for good. If it has simply not been asked yet, the lookup below asks.
  if (permission.status === 'denied' && !permission.canAskAgain) return null;
  return getCurrentPoint();
}

// Empty start (or "Current location") means "where I am now".
export async function resolveStart(text: string): Promise<Pt | null> {
  if (!text.trim() || isCurrentLabel(text)) return currentPoint();
  return geocode(text);
}

// "Current location" can also be the End, after the Start and End cells are swapped.
export async function resolveDestination(text: string): Promise<Pt | null> {
  if (!text.trim()) return null;
  return isCurrentLabel(text) ? currentPoint() : geocode(text);
}

// Supabase errors are plain objects with a message, not Error instances.
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' ? m : 'Something went wrong.';
}

// ---- City and province for places already on the map ----
const addressCache = new Map<string, string | null>();
let lastReverse = 0;

// "Edmonton, AB" for a point, or null if nothing useful is found. Results are remembered, and calls
// are spaced out because the free lookup service allows about one a second.
export async function cityAndRegion(pt: Pt): Promise<string | null> {
  const key = `${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`;
  if (addressCache.has(key)) return addressCache.get(key) ?? null;

  const wait = 1100 - (Date.now() - lastReverse);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReverse = Date.now();

  let result: string | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=14&lat=${pt.lat}&lon=${pt.lng}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const a = (await res.json())?.address ?? {};
      const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
      // "CA-AB" -> "AB"; fall back to the full name (such as "Alberta") if there is no code.
      const code = typeof a['ISO3166-2-lvl4'] === 'string' ? a['ISO3166-2-lvl4'].split('-')[1] : undefined;
      const region = code ?? a.state ?? a.province;
      result = [city, region].filter(Boolean).join(', ') || null;
    }
  } catch {
    // No network or the service is busy: leave it out; the place still shows its name.
  }
  // Only remember real answers, so a failure is tried again next time.
  if (result) addressCache.set(key, result);
  return result;
}
