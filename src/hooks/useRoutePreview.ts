import type { Pt } from '@/lib/geo';
import { useNotify } from '@/lib/notify';
import { CURRENT_LABEL, errText, isCurrentLabel, resolveDestination, resolveStart } from '@/lib/places';
import { haversineKm } from '@/lib/previousTrips';
import { getRoute } from '@/lib/routing';
import { useState } from 'react';
import { Keyboard } from 'react-native';

// The route shown for a look ("Your route") before a driver posts, or a rider searches.
export type Preview = {
  // Which role it was made for, so a role switch does not leave a stale preview behind.
  driver: boolean;
  route: Pt[];
  start: Pt;
  end: Pt;
  distanceKm: number;
  durationMin: number;
};

const SAME_PLACE = { title: 'Start and end are the same', subtitle: 'Choose a different start or end.' };

type Options = {
  driverMode: boolean;
  // Drop anything left from an earlier search before the places are looked up.
  beforeLookup: () => void;
  // The route has been found and is about to show.
  onShown: () => void;
};

export function useRoutePreview({ driverMode, beforeLookup, onShown }: Options) {
  const notify = useNotify();
  const [preview, setPreview] = useState<Preview | null>(null);
  // The "Getting Trip Ready" popup shown while places are turned into a route.
  const [loading, setLoading] = useState(false);

  // Returns null once the route is showing, or the notification to show if it could not be drawn.
  async function lookUp(
    fromText: string,
    toText: string,
    // Which role the preview is for; defaults to the one currently selected.
    asDriver?: boolean,
  ): Promise<{ title: string; subtitle?: string } | null> {
    Keyboard.dismiss();
    beforeLookup();
    // A blank start means "where I am now".
    const usesCurrent = !fromText.trim() || isCurrentLabel(fromText);
    const noCurrent = {
      title: 'Current Location could not be found',
      subtitle: 'Make sure location is turned on.',
    };
    try {
      const start = await resolveStart(fromText);
      const end = await resolveDestination(toText);
      if (!end) {
        return isCurrentLabel(toText) ? noCurrent : { title: 'Enter a destination', subtitle: 'Type where you are going.' };
      }
      if (!start) {
        return usesCurrent ? noCurrent : { title: 'Starting point not found', subtitle: 'Try adding the city.' };
      }
      // Two different names for the same spot count as the same place too.
      if (haversineKm(start, end) < 0.05) return SAME_PLACE;
      const r = await getRoute([start, end]);
      if (!r) return { title: 'No road route found', subtitle: 'Try different places.' };
      setPreview({
        driver: asDriver ?? driverMode,
        route: r.points,
        start,
        end,
        distanceKm: r.distanceKm,
        durationMin: r.durationMin,
      });
      onShown();
      return null;
    } catch (e) {
      console.warn(e);
      const message = errText(e);
      if (usesCurrent && /location/i.test(message)) return noCurrent;
      return { title: 'Could not open the route', subtitle: message };
    }
  }

  // Check the places first (an empty destination is refused at once, with no spinner), then show
  // the loading popup while the route is looked up. Problems come back as a notification.
  // Returns true once the route preview is showing.
  async function start(fromText: string, toText: string, asDriver?: boolean): Promise<boolean> {
    if (!toText.trim()) {
      Keyboard.dismiss();
      notify({ kind: 'alert', title: 'Enter a destination', subtitle: 'Type where you are going.' });
      return false;
    }
    // A blank Start is "Current location". The same name in both cells is refused at once.
    if ((fromText.trim() || CURRENT_LABEL).toLowerCase() === toText.trim().toLowerCase()) {
      Keyboard.dismiss();
      notify({ kind: 'alert', ...SAME_PLACE });
      return false;
    }
    setLoading(true);
    const problem = await lookUp(fromText, toText, asDriver);
    setLoading(false);
    if (problem) {
      notify({ kind: 'alert', ...problem });
      return false;
    }
    return true;
  }

  return { preview, setPreview, loading, start };
}
