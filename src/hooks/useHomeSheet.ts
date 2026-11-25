import { useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { useMemo, useState } from 'react';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

// Sheet heights: collapsed, home / route view, a driver's posted trip, and full (planning,
// typing, driver list).
export const MID_FRACTION = 0.38;
const TRIP_FRACTION = 0.46;
export const SNAP = { MID: 1, TRIP: 2, FULL: 3 };
// Height of the sheet's drag handle, above its content.
const HANDLE_HEIGHT = 24;

// How tall the Home sheet can be and how the things floating on its edge follow it.
export function useHomeSheet(windowHeight: number, bottomInset: number, showPreview: boolean) {
  // How tall the preview's contents are, measured once they are on screen.
  const [previewHeight, setPreviewHeight] = useState(0);

  // Critically damped so releasing the sheet settles without bouncing.
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 80,
    stiffness: 500,
    mass: 1,
    overshootClamping: true,
  });

  // The search pill straddles the sheet's top edge; it follows the sheet as it moves.
  const sheetPosition = useSharedValue(windowHeight * (1 - MID_FRACTION));
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetPosition.get() - 25 }],
  }));
  // A message from posting a trip or finding a driver floats just above the sheet's top edge.
  const noticeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetPosition.get() }],
  }));

  // A driver's route preview has an extra row, so on some phones it needs more than the usual trip
  // height to keep its main button on screen.
  const tripHeight = windowHeight * TRIP_FRACTION;
  const previewNeeds = showPreview
    ? Math.min(previewHeight + HANDLE_HEIGHT + bottomInset + 12, windowHeight * 0.9)
    : 0;
  const tallPreview = previewNeeds > tripHeight ? Math.ceil(previewNeeds) : null;
  const snapPoints = useMemo(
    () => ['23%', `${MID_FRACTION * 100}%`, tallPreview ?? `${TRIP_FRACTION * 100}%`, '94%'],
    [tallPreview],
  );

  return {
    animationConfigs, sheetPosition, pillStyle, noticeStyle, snapPoints,
    // The height of the sheet when it shows a trip or a route.
    raisedHeight: tallPreview ?? tripHeight,
    setPreviewHeight,
  };
}
