import PressButton from '@/components/PressButton';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The rounded panel along the bottom of the cart and drop-off pages, holding the main button.
export default function BottomBar({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 16 }]}>
      <PressButton style={[styles.button, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
        <Text style={styles.text}>{label}</Text>
      </PressButton>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 22,
      boxShadow: `0px -6px 18px ${c.shadow}`,
    },
    button: {
      height: 54,
      borderRadius: 18,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: { opacity: 0.45 },
    text: { fontFamily: fonts.semibold, fontSize: 17, color: c.onBrand },
  });
