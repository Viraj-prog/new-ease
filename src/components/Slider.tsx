import { useTheme } from '@/lib/theme';
import { type Colors } from '@/styles/theme';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

type Props = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
};

const THUMB = 32;
const TRACK = 6;

// Horizontal slider: drag or tap anywhere on it. Values snap to `step`.
// (Built on gesture-handler, so it needs no extra native package.)
export default function Slider({ value, min, max, step, onChange }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [width, setWidth] = useState(0);

  const span = Math.max(1, width - THUMB);
  const ratio = (value - min) / (max - min);
  const left = ratio * span;

  function setFromX(x: number) {
    const r = Math.min(1, Math.max(0, (x - THUMB / 2) / span));
    const snapped = Math.round((min + r * (max - min)) / step) * step;
    onChange(Math.min(max, Math.max(min, +snapped.toFixed(2))));
  }

  // Runs on the JS thread so it can call React state setters directly.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => setFromX(e.x))
    .onUpdate((e) => setFromX(e.x));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.hit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.track} />
        <View style={[styles.fill, { width: left + THUMB / 2 }]} />
        <View style={[styles.thumb, { left }]} />
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
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: c.ring,
      borderWidth: 3,
      borderColor: c.brand,
    },
  });
