import type { MapMarker } from '@/components/map';
import { errText, resolveDestination, resolveStart } from '@/lib/places';
import {
  answerRequest,
  finishTrip,
  hasUnfinishedTrip,
  isTripActive,
  loadActiveTrip,
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
  // A dot the driver tapped; otherwise the popup shows the next unanswered request.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Requests the driver closed with "Not now", so the popup does not keep coming back.
  const [dismissed, setDismissed] = useState<string[]>([]);

  function clear() {
    setMsg('');
    setTrip(null);
    setRequests([]);
    setSelectedId(null);
    setDismissed([]);
  }

  // Returns true when the trip was posted.
  async function post(
    startText: string,
    endText: string,
    when: Date,
    mdd: number,
    extra: number,
  ): Promise<boolean> {
    if (!userId) return false;
    clear();
    setLoading(true);
    try {
      if (await hasUnfinishedTrip(userId, when)) {
        setMsg('You already have an unfinished trip on that day. Finish it before posting another.');
        return false;
      }
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
        extra,
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
      setMsg(errText(e));
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
  async function sync() {
    if (!userId) return;
    try {
      const shown = tripRef.current;
      if (shown) {
        if (!(await isTripActive(shown.rideId))) clear();
        return;
      }
      const t = await loadActiveTrip(userId);
      if (t) {
        setTrip((current) => current ?? t);
        setMsg((m) => m || 'You have an unfinished trip. Finish it to post another.');
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Check every time the Home screen comes back into view (in driver mode).
  useFocusEffect(
    useCallback(() => {
      if (active) sync();
    }, [active, userId]),
  );

  // Mark the shown trip finished and clear it from the screen.
  async function finish() {
    if (!trip) return;
    try {
      await finishTrip(trip.rideId);
      clear();
      setMsg('Trip finished.');
    } catch (e) {
      console.error(e);
      setMsg(errText(e));
    }
  }

  // Load passengers near the route, and refresh every 10 seconds.
  useEffect(() => {
    if (!trip) return;
    let cancelled = false;

    async function load() {
      if (!trip) return;
      try {
        const found = await loadRequests(trip);
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
  }, [trip]);

  async function respond(req: Req, accept: boolean) {
    if (!trip) return;
    try {
      await answerRequest(req, accept);
      setRequests((rs) => rs.filter((r) => r.id !== req.id));
      setSelectedId(null);
    } catch (e) {
      console.error(e);
      setMsg(errText(e));
      // Close the popup so the message is visible (for example "This ride is already taken").
      setSelectedId(null);
      setDismissed((d) => [...d, req.id]);
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

  const markers: MapMarker[] = requests.map((r) => ({
    id: r.id,
    point: r.pickup,
    color: r.zone === 'in_range' ? '#16a34a' : '#f97316',
    onPress: () => setSelectedId(r.id),
  }));

  return {
    loading, msg, trip, requests, popup, markers,
    post, respond, clear, closePopup, finish,
  };
}
