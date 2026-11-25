import { useNotify } from '@/lib/notify';
import { secureStorage } from '@/lib/secureStorage';
import { loadSnapshot, nameEvent, tripEvents, type Snapshot } from '@/lib/tripUpdates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

const CHECK_MS = 10000;

// Tells the user what the other people on their trips have done, on whatever screen they are on:
// a request accepted, declined, withdrawn or new, a cancellation, a trip started or finished. The
// last check is saved, so something that happened while the app was closed is reported when it
// opens. Nothing arrives while the app is closed; that needs push notifications. It only shows a
// notice: the user stays on the page they are on.
export function useTripUpdates(userId: string | undefined) {
  const notify = useNotify();

  useEffect(() => {
    if (!userId) return;
    const id = userId;
    const storageKey = `tripUpdates.${id}`;
    let stopped = false;
    let checking = false;
    // undefined = not read yet; null = never saved.
    let before: Snapshot | null | undefined;

    async function check() {
      if (stopped || checking || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      checking = true;
      try {
        if (before === undefined) {
          const saved = await secureStorage.getItem(storageKey);
          before = saved ? (JSON.parse(saved) as Snapshot) : null;
        }
        const after = await loadSnapshot(id);
        if (stopped) return;
        // The very first check only records how things stand.
        const events = before ? tripEvents(before, after) : [];
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        before = after;
        if (events.length) {
          const first = await nameEvent(events[0]);
          if (stopped) return;
          const more = events.length - 1;
          notify({
            kind: first.kind,
            title: first.title,
            subtitle: more
              ? `${more} more ${more === 1 ? 'update' : 'updates'} in Scheduled Trips.`
              : first.subtitle,
          });
        }
        if (changed) await secureStorage.setItem(storageKey, JSON.stringify(after));
      } catch (error) {
        console.warn('Could not check for trip updates', error);
      } finally {
        checking = false;
      }
    }

    void check();
    const interval = setInterval(check, CHECK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      stopped = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [notify, userId]);
}
