import type { Pt } from '@/lib/geo';
import { useNotify } from '@/lib/notify';
import { errText, resolveDestination, resolveStart } from '@/lib/places';
import {
  cancelBooking,
  cancelOtherSearches,
  loadRequestOffers,
  loadOpenPassengerRequest,
  saveRequest,
  searchRides,
  sendRequest,
  type OfferStatus,
  type Result,
} from '@/lib/rides';
import { getRoute } from '@/lib/routing';
import { useCallback, useEffect, useRef, useState } from 'react';

function mergeOfferStatuses(
  current: Partial<Record<string, OfferStatus>>,
  { offers, acceptedRideId }: Awaited<ReturnType<typeof loadRequestOffers>>,
) {
  const next = { ...current };
  for (const offer of offers) {
    // A losing offer can be sent again once a cancelled booking reopens the request.
    if (offer.status === 'taken' && !acceptedRideId) delete next[offer.rideId];
    else next[offer.rideId] = offer.status;
  }
  return next;
}

// Passenger side: search drivers, look at one, and ask for a ride.
export function usePassengerFlow(userId: string | undefined, onAccepted?: (driverName: string) => void) {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [pickup, setPickup] = useState<Pt | null>(null);
  const [dropoff, setDropoff] = useState<Pt | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [offerStatuses, setOfferStatuses] = useState<Partial<Record<string, OfferStatus>>>({});
  const [sendingRideId, setSendingRideId] = useState<string | null>(null);
  const sending = useRef<string | null>(null);
  const lastSentRequest = useRef<string | null>(null);
  const driverNames = useRef(new Map<string, string>());
  const notifiedRequest = useRef<string | null>(null);
  const acceptedRef = useRef(onAccepted);
  useEffect(() => {
    acceptedRef.current = onAccepted;
  });

  // A request can be accepted directly or through any of its outstanding offers.
  useEffect(() => {
    if (!requestId) return;
    const id = requestId;
    let cancelled = false;
    let checking = false;

    async function check() {
      if (checking) return;
      checking = true;
      try {
        const snapshot = await loadRequestOffers(id);
        const { acceptedRideId, offers } = snapshot;
        if (cancelled) return;
        if (offers.length) lastSentRequest.current = id;
        setOfferStatuses((current) => mergeOfferStatuses(current, snapshot));
        if (acceptedRideId && notifiedRequest.current !== id) {
          notifiedRequest.current = id;
          acceptedRef.current?.(driverNames.current.get(acceptedRideId) ?? '');
        } else if (!acceptedRideId && notifiedRequest.current === id) {
          notifiedRequest.current = null;
        }
      } catch (e) {
        console.error(e);
      } finally {
        checking = false;
      }
    }

    void check();
    const t = setInterval(check, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [requestId]);

  const clear = useCallback(() => {
    setMsg('');
    setResults([]);
    setPickup(null);
    setDropoff(null);
  }, []);

  async function resume(id: string): Promise<'found' | 'none' | 'error'> {
    if (!userId || sending.current) return 'error';
    clear();
    setLoading(true);
    try {
      const saved = await loadOpenPassengerRequest(id, userId);
      if (!saved || !saved.departAt ||
          ![saved.pickupLat, saved.pickupLng, saved.dropoffLat, saved.dropoffLng].every(Number.isFinite)) {
        setMsg('This request can no longer be reopened. Start a new search to find a ride.');
        return 'error';
      }
      const from = { lat: saved.pickupLat, lng: saved.pickupLng };
      const to = { lat: saved.dropoffLat, lng: saved.dropoffLng };
      const when = new Date(saved.departAt);
      const [matches, snapshot] = await Promise.all([
        searchRides(from, to, when, userId, saved.directKm),
        loadRequestOffers(id),
      ]);
      if (snapshot.acceptedRideId) {
        setMsg('Another driver already accepted this request. Check Scheduled Trips for your booking.');
        return 'error';
      }
      lastSentRequest.current = id;
      notifiedRequest.current = null;
      const statuses = mergeOfferStatuses({}, snapshot);
      const list = matches.filter((ride) => !statuses[ride.rideId] || statuses[ride.rideId] === 'pending');
      driverNames.current = new Map(list.map((ride) => [ride.rideId, ride.driverName]));
      setOfferStatuses(statuses);
      setRequestId(id);
      setPickup(from);
      setDropoff(to);
      setResults(list);
      if (!list.length) setMsg('No other drivers are available right now');
      return list.length ? 'found' : 'none';
    } catch (error) {
      setMsg(errText(error));
      return 'error';
    } finally {
      setLoading(false);
    }
  }

  // 'found' when at least one driver matched, 'none' when nobody did.
  async function search(
    fromText: string,
    toText: string,
    when: Date,
    // The places a route preview already found. Passing them skips looking them up again,
    // which for a blank start would ask the phone for its location a second time.
    known?: { from: Pt; to: Pt; distanceKm: number; durationMin: number },
  ): Promise<'found' | 'none' | 'error'> {
    if (!userId || sending.current) return 'error';
    clear();
    setLoading(true);
    try {
      const from = known?.from ?? (await resolveStart(fromText));
      const to = known?.to ?? (await resolveDestination(toText));
      if (!to) {
        setMsg('Enter a destination.');
        return 'error';
      }
      if (!from) {
        setMsg('Could not find your starting point. Try adding the city, or allow location.');
        return 'error';
      }
      const direct = known ?? await getRoute([from, to]);
      if (!direct) {
        setMsg('No road route found between those places.');
        return 'error';
      }
      setPickup(from);
      setDropoff(to);

      const nextRequestId = await saveRequest({
        passengerId: userId, from, to, when,
        requestId: requestId === lastSentRequest.current ? null : requestId,
        directKm: direct.distanceKm, directMin: direct.durationMin, dropoffText: toText,
      });
      if (nextRequestId !== requestId) setOfferStatuses({});
      setRequestId(nextRequestId);
      try {
        if (await cancelOtherSearches(userId, nextRequestId, when)) {
          notify({
            kind: 'alert',
            title: 'Earlier search replaced',
            subtitle: 'Requests from your other search that day were withdrawn.',
          });
        }
      } catch (e) {
        // The new search still works; the old one stays listed under Scheduled Trips.
        console.warn('Could not close an earlier search', e);
      }

      const list = await searchRides(from, to, when, userId, direct.distanceKm);
      driverNames.current = new Map(list.map((ride) => [ride.rideId, ride.driverName]));
      setResults(list);
      return list.length > 0 ? 'found' : 'none';
    } catch (e) {
      console.error(e);
      setMsg(errText(e));
      return 'error';
    } finally {
      setLoading(false);
    }
  }

  // The rider backed out without asking any driver, so the search is closed and nobody can book
  // them on it. A search that was sent to a driver, accepted or reopened is left alone.
  const abandon = useCallback(() => {
    const id = requestId;
    if (!id || sending.current || lastSentRequest.current === id || notifiedRequest.current === id) return;
    setRequestId(null);
    // Check the database first: a driver may have accepted the rider a moment ago.
    loadRequestOffers(id)
      .then(({ acceptedRideId, offers }) => (acceptedRideId || offers.length ? undefined : cancelBooking(id)))
      .catch((e) => console.warn('Could not close the search', e));
  }, [requestId]);

  // Close the search for good: the rider pressed Cancel on it.
  async function cancelSearch(): Promise<boolean> {
    if (!requestId || sending.current) return false;
    try {
      await cancelBooking(requestId);
      setRequestId(null);
      return true;
    } catch (e) {
      console.error(e);
      notify({ kind: 'alert', title: 'Could not cancel', subtitle: errText(e) });
      return false;
    }
  }

  async function request(r: Result) {
    if (!requestId || sending.current || offerStatuses[r.rideId] || notifiedRequest.current === requestId) {
      return false;
    }
    sending.current = r.rideId;
    setSendingRideId(r.rideId);
    try {
      await sendRequest(requestId, r.rideId);
      lastSentRequest.current = requestId;
      setOfferStatuses((current) => ({ ...current, [r.rideId]: current[r.rideId] ?? 'pending' }));
      setMsg('');
      return true;
    } catch (e) {
      console.error(e);
      const message = errText(e);
      if (/no longer available/i.test(message)) {
        setResults((rs) => rs.filter((x) => x.rideId !== r.rideId));
      }
      notify({ kind: 'alert', title: 'Could not send request', subtitle: message });
      return false;
    } finally {
      sending.current = null;
      setSendingRideId(null);
    }
  }

  return {
    loading, msg, results, pickup, dropoff, offerStatuses, sendingRideId,
    search, resume, request, clear, abandon, cancelSearch,
  };
}
