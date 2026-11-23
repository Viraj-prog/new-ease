import { useTheme } from '@/lib/theme';
import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// A ring with one blue arc that spins, as in the "Finding drivers" popup.
export default function Spinner({ size = 50 }: { size?: number }) {
  const { colors } = useTheme();
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.set(withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1));
    return () => cancelAnimation(turn);
  }, [turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: colors.border,
          borderTopColor: colors.brand,
        },
        style,
      ]}
    />
  );
}
