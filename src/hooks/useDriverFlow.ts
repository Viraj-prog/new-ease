import type { MapMarker } from '@/components/map';
import { errText, resolveDestination, resolveStart } from '@/lib/places';
import {
  acceptPlannedRequest,
  declineRequest,
  finishTrip,
  loadActiveTrip,
  loadDriverTrip,
  loadRequests,
  postTrip,
  type Req,
  type Trip,
} from '@/lib/rides';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// Driver side: post a trip, then see and answer passengers near the route.
export function useDriverFlow(userId: string | undefined, active = true) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [responding, setResponding] = useState(false);
  const [acceptError, setAcceptError] = useState<{ message: string; retry?: Req } | null>(null);
  // A dot the driver tapped; otherwise the popup shows the next unanswered request.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Requests the driver closed with "Not now", so the popup does not keep coming back.
  const [dismissed, setDismissed] = useState<string[]>([]);

  const clear = useCallback(() => {
    setMsg('');
    setTrip(null);
    setRequests([]);
    setAcceptError(null);
    setSelectedId(null);
    setDismissed([]);
  }, []);

  // Returns true when the trip was posted.
  async function post(
    startText: string,
    endText: string,
    when: Date,
    mdd: number,
    pricePerKm: number,
  ): Promise<boolean> {
    if (!userId) return false;
    clear();
    setLoading(true);
    try {
      const start = await resolveStart(startText);
      const end = await resolveDestination(endText);
      if (!end) {
        setMsg('Enter a destination.');
        return false;
      }
      if (!start) {
        setMsg('Could not find your starting point. Try adding the city, or allow location.');
        return false;
      }
      const t = await postTrip({
        driverId: userId,
        startText,
        endText,
        start,
        end,
        when,
        mdd,
        pricePerKm,
      });
      if (!t) {
        setMsg('No road route found between those places.');
        return false;
      }
      setTrip(t);
      setMsg(`Trip posted: ${t.distanceKm.toFixed(1)} km, about ${Math.round(t.durationMin)} min`);
      return true;
    } catch (e) {
      console.error(e);
      const overlap = (e as { code?: string } | null)?.code === '23P01';
      setMsg(overlap ? 'This ride overlaps another scheduled ride. Choose a different departure time.' : errText(e));
      return false;
    } finally {
      setLoading(false);
    }
  }

  // The latest shown trip, readable from the focus callback below.
  const tripRef = useRef<Trip | null>(null);
  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  // Match the screen to the database: drop a trip that was finished or cancelled elsewhere
  // (for example from the Rides tab), or bring back an unfinished one after a restart.
  const sync = useCallback(async () => {
    if (!userId) return;
    try {
      const shown = tripRef.current;
      if (shown) {
        const latest = await loadDriverTrip(shown.rideId, userId);
        if (tripRef.current !== shown) return;
        if (latest) {
          setTrip(latest);
          return;
        }
        clear();
      }
      const t = await loadActiveTrip(userId);
      if (t) {
        setTrip((current) => current ?? t);
      }
    } catch (e) {
      console.error(e);
    }
  }, [clear, userId]);

  // Check every time the Home screen comes back into view (in driver mode).
  useFocusEffect(
    useCallback(() => {
      if (active) sync();
    }, [active, sync]),
  );

  // Mark the shown trip finished and clear it from the screen. Returns null on success, or the
  // reason it failed. (It sets no message, so the caller can go straight back Home.)
  async function finish(): Promise<string | null> {
    if (!trip) return null;
    try {
      await finishTrip(trip.rideId);
      clear();
      return null;
    } catch (e) {
      console.error(e);
      return errText(e);
    }
  }

  // Load passengers near the route, and refresh every 10 seconds.
  useEffect(() => {
    if (!trip || !userId) return;
    let cancelled = false;

    async function load() {
      if (!trip || !userId) return;
      try {
        const found = await loadRequests(trip, userId);
        if (!cancelled) setRequests(found);
      } catch (e) {
        console.error(e);
      }
    }

    load();
    const t = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [trip, userId]);

  async function respond(req: Req, accept: boolean) {
    if (!trip || !userId || responding) return false;
    setResponding(true);
    setAcceptError(null);
    try {
      if (accept) {
        const result = await acceptPlannedRequest(userId, trip.rideId, req.id);
        if (result.kind !== 'accepted') {
          setAcceptError({ message: result.message, retry: result.kind === 'retry' ? req : undefined });
          return false;
        }
        setTrip((shown) => shown?.rideId === result.trip.rideId ? result.trip : shown);
      } else {
        await declineRequest(trip.rideId, req.id);
      }
      setRequests((rs) => rs.filter((r) => r.id !== req.id));
      setSelectedId(null);
      return true;
    } catch (e) {
      setAcceptError({ message: errText(e) });
      return false;
    } finally {
      setResponding(false);
    }
  }

  // The request shown in the popup: a tapped dot first, else the first waiting request.
  const popup =
    requests.find((r) => r.id === selectedId) ??
    requests.find((r) => r.status === 'pending' && !dismissed.includes(r.id)) ??
    null;

  function closePopup() {
    if (popup) setDismissed((d) => [...d, popup.id]);
    setSelectedId(null);
  }

  const markers: MapMarker[] = requests.filter((r) => r.status !== 'accepted').map((r) => ({
    id: r.id,
    point: r.pickup,
    color: '#16a34a',
    onPress: () => setSelectedId(r.id),
  }));

  return {
    loading, msg, trip, requests, popup, markers, responding, acceptError,
    post, respond, clear, closePopup, finish,
  };
}
