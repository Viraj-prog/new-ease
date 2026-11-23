import { errText, cityAndRegion } from '@/lib/places';
import {
  deleteSavedPlace,
  loadRecentPlaces,
  loadSavedPlaces,
  saveSavedPlace,
  type RecentPlace,
  type SavedKind,
  type SavedPlace,
} from '@/lib/savedTrips';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// A user's saved places and recent trips. Reloads whenever the screen comes into view.
export function useSavedTrips(userId: string | undefined) {
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [recent, setRecent] = useState<RecentPlace[]>([]);
  // Why loading failed, such as the tables not being created yet. Empty when all is well.
  const [error, setError] = useState('');

  // Look up each recent place's city and province one after another, and show them as they arrive.
  async function fillAddresses(list: RecentPlace[]) {
    for (const place of list) {
      if (!place.point || place.detail) continue;
      const detail = await cityAndRegion(place.point);
      if (!detail) continue;
      setRecent((now) => now.map((x) => (x.address === place.address ? { ...x, detail } : x)));
    }
  }

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [s, r] = await Promise.all([loadSavedPlaces(userId), loadRecentPlaces(userId)]);
      setSaved(s);
      setRecent(r);
      setError('');
      fillAddresses(r);
    } catch (e) {
      console.warn('Saved trips could not load:', e);
      setError(errText(e));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Both return an error message to show, or null on success.
  async function save(label: string, kind: SavedKind, address: string): Promise<string | null> {
    if (!userId) return 'Not logged in.';
    try {
      await saveSavedPlace({ userId, label, kind, address });
      await refresh();
      return null;
    } catch (e) {
      return errText(e);
    }
  }

  async function remove(id: string): Promise<string | null> {
    try {
      await deleteSavedPlace(id);
      await refresh();
      return null;
    } catch (e) {
      return errText(e);
    }
  }

  return { saved, recent, error, refresh, save, remove };
}
