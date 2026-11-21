import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';

// Start and end of a trip, joined by a line (blue for the start, red for the end, like the map dots).
export default function StopsList({ start, end }: { start: string; end: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.stops}>
      <View style={styles.row}>
        <View style={styles.marker}>
          <View style={[styles.ring, { backgroundColor: colors.brand }]}>
            <View style={styles.ringCenter} />
          </View>
          <View style={styles.line} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.label}>Start</Text>
          <Text style={styles.text}>{start || 'Current location'}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.marker}>
          <View style={[styles.ring, { backgroundColor: colors.alert }]}>
            <View style={styles.ringCenter} />
          </View>
        </View>
        <View style={styles.textCol}>
          <Text style={styles.label}>End</Text>
          <Text style={styles.text}>{end}</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    stops: { marginTop: 4 },
    row: { flexDirection: 'row', gap: 14, minHeight: 52 },
    marker: { width: 24, alignItems: 'center' },
    ring: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    ringCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.surface },
    line: { flex: 1, width: 2, backgroundColor: c.borderStrong, marginVertical: 2 },
    textCol: { flex: 1 },
    label: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    text: { fontFamily: fonts.medium, fontSize: 18, color: c.text },
  });
