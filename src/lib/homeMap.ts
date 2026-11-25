import type { MapMarker } from '@/components/map';
import type { Preview } from '@/hooks/useRoutePreview';
import type { Pt } from '@/lib/geo';
import type { Trip } from '@/lib/rides';
import type { Colors } from '@/styles/theme';

type Input = {
  // The driver's trip, when it is what the sheet is showing.
  shownTrip: Trip | null;
  // The driver's trip even when the sheet shows something else.
  trip: Trip | null;
  preview: Preview | null;
  requestMarkers: MapMarker[];
  pickup: Pt | null;
  dropoff: Pt | null;
  colors: Colors;
};

// What the Home map draws: the posted trip, the route being previewed, or the rider's two ends.
export function homeMapContent(input: Input) {
  const { shownTrip, preview, colors } = input;
  const plan = shownTrip?.plan ?? null;
  const route = preview?.route ?? plan?.points ?? input.trip?.route ?? [];

  let markers: MapMarker[];
  if (shownTrip) {
    // A posted trip shows its own start and end like the preview does, then the purple dots.
    const ends: MapMarker[] = route.length > 1
      ? [
          { id: 'trip-start', point: route[0], color: colors.brand },
          { id: 'trip-end', point: route[route.length - 1], color: colors.alert },
        ]
      : [];
    markers = [...ends, ...input.requestMarkers.map((m) => ({ ...m, color: colors.pickup }))];
  } else if (preview) {
    markers = [
      { id: 'start', point: preview.start, color: colors.brand },
      { id: 'end', point: preview.end, color: colors.alert },
    ];
  } else {
    markers = [
      ...(input.pickup ? [{ id: 'pickup', point: input.pickup, color: colors.brand }] : []),
      ...(input.dropoff ? [{ id: 'dropoff', point: input.dropoff, color: colors.alert }] : []),
    ];
  }

  return { route, markers, plannedStops: plan?.stops };
}
