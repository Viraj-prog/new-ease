import type { Pt } from '@/lib/geo';
import { errText, resolveDestination, resolveStart } from '@/lib/places';
import {
  cancelRequest,
  getRequestStatus,
  saveRequest,
  searchRides,
  sendRequest,
  type Result,
} from '@/lib/rides';
import { getRoute } from '@/lib/routing';
import { useEffect, useState } from 'react';

// Passenger side: search drivers, look at one, and ask for a ride.
export function usePassengerFlow(userId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [pickup, setPickup] = useState<Pt | null>(null);
  const [dropoff, setDropoff] = useState<Pt | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Result | null>(null);
  const [alt, setAlt] = useState<Pt[]>([]);
  const [extra, setExtra] = useState<{ km: number; min: number } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Where the sent request stands: 'pending' until the driver answers.
  const [status, setStatus] = useState<string | null>(null);
  // Result popup shown once when the driver answers.
  const [notice, setNotice] = useState<'accepted' | 'declined' | null>(null);

  // While a request is waiting, check every 8 seconds whether the driver answered.
  useEffect(() => {
    if (!requestId || status !== 'pending') return;
    let cancelled = false;

    async function check() {
      try {
        const s = await getRequestStatus(requestId!);
        if (cancelled) return;
        if (s === 'accepted') {
          setStatus('accepted');
          setNotice('accepted');
        } else if (s === 'declined' || s === 'cancelled') {
          setStatus('declined');
          setSentTo(null);
          setNotice('declined');
        }
      } catch (e) {
        console.error(e);
      }
    }

    const t = setInterval(check, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [requestId, status]);

  function clear() {
    setMsg('');
    setResults([]);
    setPickup(null);
    setDropoff(null);
    setSelected(null);
    setAlt([]);
    setExtra(null);
    setSentTo(null);
    setStatus(null);
    setNotice(null);
  }

  // Returns true when at least one driver matched.
  async function search(fromText: string, toText: string, when: Date): Promise<boolean> {
    if (!userId) return false;
    clear();
    setLoading(true);
    try {
      const from = await resolveStart(fromText);
      const to = await resolveDestination(toText);
      if (!to) {
        setMsg('Enter a destination.');
        return false;
      }
      if (!from) {
        setMsg('Could not find your starting point. Try adding the city, or allow location.');
        return false;
      }
      setPickup(from);
      setDropoff(to);

      setRequestId(await saveRequest({ passengerId: userId, from, to, when, requestId }));

      const list = await searchRides(from, to, when);
      setResults(list);
      if (list.length === 0) setMsg('No drivers on your route for that time.');
      return list.length > 0;
    } catch (e) {
      console.error(e);
      setMsg(errText(e));
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Show the driver's route, plus a new route that goes through the passenger's points.
  async function select(r: Result) {
    setSelected(r);
    setAlt([]);
    setExtra(null);
    if (!pickup || !dropoff) return;
    const rr = await getRoute([r.start, pickup, dropoff, r.end]);
    if (rr) {
      setAlt(rr.points);
      setExtra({ km: rr.distanceKm - r.tripKm, min: rr.durationMin - r.tripMin });
    }
  }

  function back() {
    setSelected(null);
    setAlt([]);
    setExtra(null);
  }

  async function request(r: Result) {
    if (!requestId) return;
    try {
      await sendRequest(requestId, r);
      setSentTo(r.rideId);
      setStatus('pending');
      setMsg('');
    } catch (e) {
      console.error(e);
      const m = errText(e);
      if (/no longer available/i.test(m)) {
        // Someone else's request was accepted first; drop this driver from the list.
        setResults((rs) => rs.filter((x) => x.rideId !== r.rideId));
        back();
        setMsg('That ride was just taken. Pick another driver.');
      } else {
        setMsg(`Could not send the request. ${m}`);
      }
    }
  }

  // Withdraw the request while it is still waiting for the driver.
  async function cancel() {
    if (!requestId) return;
    try {
      const withdrawn = await cancelRequest(requestId);
      if (withdrawn) {
        setSentTo(null);
        setStatus(null);
        setMsg('Request cancelled.');
      }
      // Otherwise the driver answered first; the next check shows the result.
    } catch (e) {
      console.error(e);
      setMsg(`Could not cancel. ${errText(e)}`);
    }
  }

  return {
    loading, msg, results, pickup, dropoff, selected, alt, extra, sentTo,
    accepted: status === 'accepted',
    confirming: status === 'pending',
    notice,
    closeNotice: () => setNotice(null),
    cancel,
    search, select, back, request, clear,
  };
}
