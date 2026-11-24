import { useNotify } from '@/lib/notify';
import { loadDriverCancelledOfferIds } from '@/lib/rides';
import { secureStorage } from '@/lib/secureStorage';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// Check even if Home no longer has the accepted request in memory.
export function useDriverCancellationNotice(userId: string | undefined) {
  const notify = useNotify();

  useEffect(() => {
    if (!userId) return;
    const passengerId = userId;
    const storageKey = `driverCancellationNotice.${passengerId}`;
    let disposed = false;
    let checking = false;
    let seen: Set<string> | undefined;

    async function check() {
      if (disposed || checking || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      checking = true;
      try {
        if (!seen) {
          const saved = await secureStorage.getItem(storageKey);
          seen = new Set(saved?.split(',').filter(Boolean));
        }
        const ids = await loadDriverCancelledOfferIds(passengerId);
        if (disposed) return;
        const unseen: string[] = [];
        for (const id of ids) {
          if (seen.has(id)) continue;
          const homeDisposition = await secureStorage.getItem(`reopenedSearch.${passengerId}.${id}`);
          if (homeDisposition) seen.add(id);
          else unseen.push(id);
        }
        if (disposed) return;
        if (!unseen.length) return;

        notify({
          kind: 'alert',
          title: unseen.length === 1 ? 'Your driver cancelled' : 'Drivers cancelled your rides',
          subtitle: 'Open Trips → History and tap Find another driver.',
        });
        unseen.forEach((id) => seen?.add(id));
        await secureStorage.setItem(storageKey, [...seen].join(','));
      } catch (error) {
        console.warn('Could not check for driver cancellations', error);
      } finally {
        checking = false;
      }
    }

    void check();
    const interval = setInterval(check, 10000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      disposed = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [notify, userId]);
}
