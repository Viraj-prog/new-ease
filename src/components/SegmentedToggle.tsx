import Icon, { type IconName } from '@/components/Icon';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export type ToggleOption<T extends string> = { key: T; icon: IconName; label?: string };

type Props<T extends string> = {
  options: ToggleOption<T>[];
  value: T;
  onChange: (key: T) => void;
  disabled?: boolean;
  // Icon-only round segments. Otherwise the segments share the width and show their labels.
  compact?: boolean;
  textOnly?: boolean;
  // Compact only: width and height of each round segment (default 32).
  segment?: number;
  style?: StyleProp<ViewStyle>;
};

const PADDING = 4;
const BORDER = 1;

// Segmented switch whose blue thumb slides to the chosen option.
export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  disabled,
  compact,
  textOnly,
  segment = 32,
  style,
}: Props<T>) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  // The track's width includes its 1px border on each side, which the segments do not use. Leaving
  // it out keeps the blue thumb exactly the size of a segment, so each icon sits in its centre.
  const thumbWidth = width > 0 ? (width - BORDER * 2 - PADDING * 2) / options.length : 0;

  const x = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!thumbWidth) return;
    const target = index * thumbWidth;
    if (placed.current) {
      x.set(withTiming(target, { duration: 220 }));
    } else {
      // First measurement: put the thumb in place without animating.
      x.set(target);
      placed.current = true;
    }
  }, [index, thumbWidth, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      style={[styles.track, compact ? styles.trackCompact : styles.trackWide, style]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.thumb, { width: thumbWidth }, thumbStyle]} />
      {options.map((o) => {
        const active = o.key === value;
        const color = active ? colors.toggleActiveText : colors.textSecondary;
        return (
          <Pressable
            key={o.key}
            style={compact
              ? [styles.segmentCompact, { width: segment, height: segment }]
              : [styles.segmentWide, textOnly && styles.segmentTextOnly]}
            onPress={() => onChange(o.key)}
            disabled={disabled}
            hitSlop={compact ? (segment > 32 ? 8 : 4) : undefined}
          >
            {!textOnly && <Icon name={o.icon} size={compact ? Math.round(segment * 0.56) : 20} color={color} />}
            {!!o.label && <Text style={[styles.label, textOnly && styles.centeredLabel, { color }]}>{o.label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: PADDING,
      borderRadius: 24,
      borderWidth: BORDER,
      borderColor: c.border,
    },
    trackCompact: { backgroundColor: c.surface },
    trackWide: { backgroundColor: c.input },
    thumb: {
      position: 'absolute',
      top: PADDING,
      bottom: PADDING,
      left: PADDING,
      borderRadius: 999,
      backgroundColor: c.brand,
    },
    segmentCompact: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentWide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
    },
    label: { fontFamily: fonts.semibold, fontSize: 15 },
    segmentTextOnly: { minWidth: 0, paddingHorizontal: 4 },
    centeredLabel: { flexShrink: 1, fontSize: 14, textAlign: 'center' },
  });
