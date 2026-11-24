import { loadUnseenCancellations, markCancellationsSeen } from '@/lib/cancellations';
import { useNotify } from '@/lib/notify';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

// Tells the user about cancellations they have not seen: as soon as the app opens or comes back to
// the front, and then every 10 seconds. A notice stays until it is tapped, and only then is it
// recorded as seen, so it comes back next time if the app was closed first.
export function useCancellationNotices(userId: string | undefined) {
  const notify = useNotify();
  // Already on screen (or shown) in this session, so a poll does not repeat it.
  const shown = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    let stopped = false;

    async function check() {
      if (!userId || AppState.currentState !== 'active') return;
      try {
        const fresh = (await loadUnseenCancellations(userId)).filter((n) => !shown.current.has(n.requestId));
        if (stopped || fresh.length === 0) return;
        const ids = fresh.map((n) => n.requestId);
        ids.forEach((id) => shown.current.add(id));
        notify({
          kind: 'alert',
          title: fresh.length === 1 ? fresh[0].title : `${fresh.length} cancellations`,
          subtitle: fresh.map((n) => n.subtitle).join('\n'),
          sticky: true,
          onDismiss: () => markCancellationsSeen(ids),
        });
      } catch (e) {
        console.error(e);
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
