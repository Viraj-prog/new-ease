import { useNotify } from '@/lib/notify';
import { loadPendingRequests } from '@/lib/rides';
import { supabase } from '@/lib/supabase';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

// Tells a driver about new ride requests on any of their trips, not only the one on screen: when
// the app opens or comes back to the front, and then every 10 seconds.
export function useRequestNotices(userId: string | undefined) {
  const notify = useNotify();
  // The requests that were waiting at the last check.
  const known = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let busy = false;

    async function check() {
      if (!userId || busy || AppState.currentState !== 'active') return;
      busy = true;
      try {
        const pending = await loadPendingRequests(userId);
        if (stopped) return;
        // A rider reuses one request row, so the trip is part of what makes a request new.
        const keys = pending.map((r) => `${r.requestId}:${r.rideId}`);
        const fresh = pending.filter((_, i) => !known.current.has(keys[i]));
        known.current = new Set(keys);
        if (fresh.length === 0) return;

        const first = fresh[0];
        let who = 'A passenger';
        if (fresh.length === 1) {
          const { data } = await supabase
            .from('users')
            .select('firstName, lastName')
            .eq('userId', first.passengerId)
            .maybeSingle();
          who = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim() || who;
        }
        const day = first.departAt
          ? ` on ${new Date(first.departAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
          : '';
        notify({
          kind: 'success',
          title: fresh.length === 1 ? 'New ride request' : `${fresh.length} new ride requests`,
          subtitle:
            fresh.length === 1
              ? `${who} wants to join your trip to ${first.destination}${day}. Open it from Scheduled Trips.`
              : 'Open them from Scheduled Trips.',
        });
      } catch (e) {
        console.error(e);
      } finally {
        busy = false;
      }
    }

    check();
    const timer = setInterval(check, 10000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId, notify]);
}
