import type { Pt } from './geo';
import type { DrivingTimeMatrix } from './pickupPlanner';

type TableResult = { kind: 'matrix'; times: DrivingTimeMatrix } | { kind: 'error'; message: string };

const TABLE_URL = 'https://router.project-osrm.org/table/v1/driving/';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 64;
const REQUEST_SPACING_MS = 1100;
const REQUEST_TIMEOUT_MS = 12000;
const cache = new Map<string, { times: DrivingTimeMatrix; expiresAt: number }>();
const pending = new Map<string, Promise<TableResult>>();
let queue = Promise.resolve();
let nextRequestAt = 0;

function parseTimes(body: unknown, size: number): DrivingTimeMatrix | null {
  const payload = body as { code?: unknown; durations?: unknown } | null;
  if (payload?.code !== 'Ok' || !Array.isArray(payload.durations) || payload.durations.length !== size) {
    return null;
  }
  const minutes: (readonly (number | null)[])[] = [];
  for (const row of payload.durations) {
    if (!Array.isArray(row) || row.length !== size) return null;
    const converted: (number | null)[] = [];
    for (const value of row) {
      if (value === null) converted.push(null);
      else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) converted.push(value / 60);
      else return null;
    }
    minutes.push(Object.freeze(converted));
  }
  return Object.freeze(minutes);
}

export function queuePlanningOsrmRequest<T>(run: () => Promise<T>): Promise<T> {
  const request = queue.then(async () => {
    const wait = nextRequestAt - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    nextRequestAt = Date.now() + REQUEST_SPACING_MS;
    return run();
  });
  queue = request.then(() => undefined, () => undefined);
  return request;
}

async function requestTable(key: string, size: number): Promise<TableResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${TABLE_URL}${key}?annotations=duration`, { signal: controller.signal });
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retryAt = retryAfter && /^\d+$/.test(retryAfter)
        ? Date.now() + Number(retryAfter) * 1000
        : Date.parse(retryAfter ?? '');
      nextRequestAt = Math.max(nextRequestAt, Date.now() + 5000, Number.isFinite(retryAt) ? retryAt : 0);
      return { kind: 'error', message: 'The routing service is rate limited. Try again shortly.' };
    }
    if (!response.ok) {
      return { kind: 'error', message: `The routing service could not calculate driving times (HTTP ${response.status}).` };
    }
    const times = parseTimes(await response.json(), size);
    if (times === null) {
      return { kind: 'error', message: 'The routing service returned an invalid driving time matrix.' };
    }
    return { kind: 'matrix', times };
  } catch {
    return {
      kind: 'error',
      message: controller.signal.aborted
        ? 'The routing service timed out. Try again shortly.'
        : 'Could not load driving times from the routing service.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Share identical requests in flight and cache successful results for the same ordered stops.
export function getDrivingTimeMatrix(points: readonly Pt[]): Promise<TableResult> {
  if (points.length < 2 || points.some(({ lat, lng }) =>
    !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180,
  )) {
    return Promise.resolve({ kind: 'error', message: 'The ride needs at least two valid stop coordinates.' });
  }

  const key = points.map(({ lat, lng }) => `${lng},${lat}`).join(';');
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    if (cached.expiresAt > Date.now()) {
      cache.set(key, cached);
      return Promise.resolve({ kind: 'matrix', times: cached.times });
    }
  }
  const existing = pending.get(key);
  if (existing) return existing;

  const request = queuePlanningOsrmRequest(() => requestTable(key, points.length)).then((result) => {
    if (result.kind === 'matrix') {
      cache.set(key, { times: result.times, expiresAt: Date.now() + CACHE_TTL_MS });
      if (cache.size > MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
    }
    return result;
  }).finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}
