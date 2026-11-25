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
  // Gives the track a recessed look and the thumb a raised, glowing one (used on the Profile page).
  depth?: boolean;
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
  depth,
  style,
}: Props<T>) {
  const { colors, mode } = useTheme();
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
      style={[
        styles.track,
        compact ? styles.trackCompact : styles.trackWide,
        depth && {
          backgroundColor: mode === 'dark' ? colors.input : colors.surface,
          boxShadow:
            mode === 'dark'
              ? 'inset 0px 3px 6px rgba(0,0,0,0.6), 0px 1px 0px rgba(255,255,255,0.04)'
              : '0px 4px 10px rgba(16,23,27,0.14), inset 0px 1px 2px rgba(16,23,27,0.06)',
        },
        style,
      ]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          styles.thumb,
          { width: thumbWidth },
          depth && {
            boxShadow: `0px 4px 10px rgba(30,144,255,${mode === 'dark' ? 0.11 : 0.08}), inset 0px 1px 1px rgba(255,255,255,0.45)`,
          },
          thumbStyle,
        ]}
      />
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
