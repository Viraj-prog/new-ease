import { loadReopenedPassengerRequests } from '@/lib/rides';
import { secureStorage } from '@/lib/secureStorage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export type ReopenedSearch = { id: string; requestId: string; showNotice: boolean };
type RecoveryStatus = 'dismissed' | 'handled';

export function useReopenedPassengerSearch(
  userId: string | undefined,
  enabled: boolean,
  onOpen: (search: ReopenedSearch) => void,
) {
  const onOpenRef = useRef(onOpen);
  const presented = useRef(new Set<string>());
  const dispositions = useRef(new Map<string, string | null>());
  const relatedOffers = useRef(new Map<string, string[]>());

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  const storageKey = useCallback((id: string) => `reopenedSearch.${userId}.${id}`, [userId]);

  const remember = useCallback((id: string, status: RecoveryStatus) => {
    const key = storageKey(id);
    const keys = status === 'handled' ? relatedOffers.current.get(key) ?? [key] : [key];
    for (const key of keys) {
      dispositions.current.set(key, status);
      void secureStorage.setItem(key, status);
    }
  }, [storageKey]);

  useFocusEffect(useCallback(() => {
    if (!userId || !enabled) return;
    const passengerId = userId;
    let stopped = false;
    let checking = false;

    async function check() {
      if (stopped || checking || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      checking = true;
      try {
        const rows = await loadReopenedPassengerRequests(passengerId);
        for (const { id, requestId } of rows) {
          if (stopped) return;
          const key = storageKey(id);
          if (presented.current.has(key)) continue;
          if (!dispositions.current.has(key)) {
            const saved = await secureStorage.getItem(key);
            if (stopped) return;
            if (!dispositions.current.has(key)) dispositions.current.set(key, saved);
          }
          const status = dispositions.current.get(key);
          if (status === 'handled') continue;
          const keys = rows.filter((row) => row.requestId === requestId).map((row) => storageKey(row.id));
          relatedOffers.current.set(key, keys);
          keys.forEach((relatedKey) => presented.current.add(relatedKey));
          onOpenRef.current({ id, requestId, showNotice: status !== 'dismissed' });
          return;
        }
      } catch (error) {
        console.warn('Could not check for a reopened ride request', error);
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
      stopped = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, storageKey, userId]));

  return remember;
}
