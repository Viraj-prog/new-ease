import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = { model: string; detail: string; plate: string };

// The darker strip with the car and its licence plate.
export default function VehicleBox({ model, detail, plate }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.box}>
      <Ionicons name='car-sport-outline' size={26} color={colors.textSecondary} />
      <View style={styles.text}>
        <Text style={styles.model}>{model}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <View style={styles.plate}>
        <Text style={styles.plateText}>{plate}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.background,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    text: { flex: 1 },
    model: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    detail: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
    plate: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    plateText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 1.5, color: c.text },
  });
