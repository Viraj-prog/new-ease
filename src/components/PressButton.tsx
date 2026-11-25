import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  // Set on outlined or pale buttons, where a white ripple would not show.
  ghost?: boolean;
  // How far it shrinks while pressed (1 = not at all). Wide rows use a gentler value.
  pressScale?: number;
  // false = press in only, with no ripple.
  ripple?: boolean;
};

// A button that feels real: it shrinks slightly while pressed, springs back when let go, and
// shows a ripple on Android. Used for the filled (blue, green, red) and outlined action buttons.
export default function PressButton({
  style,
  ghost = false,
  pressScale = 0.96,
  ripple = true,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      android_ripple={ripple ? {
        color: ghost ? 'rgba(128,128,128,0.28)' : 'rgba(255,255,255,0.35)',
        foreground: true,
      } : undefined}
      onPressIn={(e) => {
        scale.set(withTiming(pressScale, { duration: 90 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: 160 }));
        onPressOut?.(e);
      }}
      // overflow hidden keeps the ripple inside the button's rounded corners.
      style={[style, { overflow: 'hidden' }, pressStyle]}
    />
  );
}
