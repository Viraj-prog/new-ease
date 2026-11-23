import { useTheme } from '@/lib/theme';
import { type Colors } from '@/styles/theme';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Props = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
};

const THUMB = 32;
const TRACK = 6;

// Horizontal slider: drag or tap anywhere on it. The thumb follows the finger continuously on
// the UI thread; the value it reports snaps to `step`, and the thumb settles onto it on release.
// (Built on gesture-handler, so it needs no extra native package.)
export default function Slider({ value, min, max, step, onChange }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [width, setWidth] = useState(0);

  const span = Math.max(1, width - THUMB);
  // Thumb's left edge in px, and the last value reported, both read on the UI thread.
  const pos = useSharedValue(0);
  const dragging = useSharedValue(false);
  const last = useSharedValue(value);
  const spanPx = useSharedValue(span);

  // Follow the value when it changes from outside (opening the modal, first layout).
  useEffect(() => {
    spanPx.set(span);
    last.set(value);
    if (!dragging.get()) pos.set(withTiming(((value - min) / (max - min)) * span, { duration: 120 }));
  }, [value, min, max, span, pos, dragging, last, spanPx]);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      dragging.set(true);
      const r = Math.min(1, Math.max(0, (e.x - THUMB / 2) / spanPx.get()));
      pos.set(withTiming(r * spanPx.get(), { duration: 80 }));
      const v = Math.round((min + r * (max - min)) / step) * step;
      if (v !== last.get()) {
        last.set(v);
        scheduleOnRN(onChange, Math.min(max, Math.max(min, +v.toFixed(2))));
      }
    })
    .onUpdate((e) => {
      const r = Math.min(1, Math.max(0, (e.x - THUMB / 2) / spanPx.get()));
      pos.set(r * spanPx.get());
      const v = Math.round((min + r * (max - min)) / step) * step;
      if (v !== last.get()) {
        last.set(v);
        scheduleOnRN(onChange, Math.min(max, Math.max(min, +v.toFixed(2))));
      }
    })
    .onFinalize(() => {
      dragging.set(false);
      // Settle onto the snapped value.
      const snapped = Math.min(max, Math.max(min, last.get()));
      pos.set(withTiming(((snapped - min) / (max - min)) * spanPx.get(), { duration: 120 }));
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pos.get() }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: pos.get() + THUMB / 2 }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.hit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.track} />
        <Animated.View style={[styles.fill, fillStyle]} />
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    hit: { height: 44, justifyContent: 'center' },
    track: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: TRACK,
      borderRadius: TRACK / 2,
      backgroundColor: c.borderMid,
    },
    fill: {
      position: 'absolute',
      left: 0,
      height: TRACK,
      borderRadius: TRACK / 2,
      backgroundColor: c.brand,
    },
    thumb: {
      position: 'absolute',
      left: 0,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: c.ring,
      borderWidth: 3,
      borderColor: c.brand,
    },
  });
