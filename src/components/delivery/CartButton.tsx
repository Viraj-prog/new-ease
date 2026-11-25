import PressButton from '@/components/PressButton';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Round cart button at the top-right, with how many different items are in the cart.
export default function CartButton({ count, onPress }: { count: number; onPress: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  return (
    // The badge hangs over the button's edge, so it sits outside the clipped button.
    <View style={[styles.wrap, { top: insets.top + 8 }]}>
      <PressButton ghost style={styles.button} onPress={onPress} hitSlop={8} accessibilityLabel='Cart'>
        <Ionicons name='cart-outline' size={24} color={colors.text} />
      </PressButton>
      {count > 0 && (
        <View pointerEvents='none' style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', right: 20 },
    button: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontFamily: fonts.semibold, fontSize: 12, color: c.onBrand },
  });
