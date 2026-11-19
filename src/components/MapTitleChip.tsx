import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Title pill at the top centre of the map ("Trip posted", "Ride request", ...).
export default function MapTitleChip({ title }: { title: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  return (
    <View pointerEvents='none' style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={styles.chip}>
        <Text style={styles.text}>{title}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    chip: {
      height: 46,
      paddingHorizontal: 22,
      borderRadius: 23,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { fontFamily: fonts.titleMedium, fontSize: 18, color: c.text },
  });
