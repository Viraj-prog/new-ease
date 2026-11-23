import Icon from '@/components/Icon';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressButton from '@/components/PressButton';

type Props = {
  destination: string;
  distanceKm: number;
  durationMin: number;
  onEnd: () => void;
};

// PLACEHOLDER for turn-by-turn navigation: the layout from the design with fixed sample
// directions. The route on the map is the real one; real instructions, voice and the live
// position are still to be built.
export default function TripNavigation({ destination, distanceKm, durationMin, onEnd }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  // The moment navigation started, fixed once, so the arrival time does not drift on re-render.
  const [startedAt] = useState(() => Date.now());
  const arrive = new Date(startedAt + durationMin * 60000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View pointerEvents='box-none' style={StyleSheet.absoluteFill}>
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <View style={styles.turnRow}>
          <View style={styles.turnIcon}>
            <Icon name='turn-right' size={32} color={colors.onBrand} />
          </View>
          <View style={styles.turnText}>
            <Text style={styles.distance}>100 m</Text>
            <Text style={styles.street}>Turn right onto 87 Ave</Text>
          </View>
          <View style={styles.mute}>
            <Icon name='volume' size={22} color={colors.text} />
          </View>
        </View>
        <View style={styles.divider} />
        <Text style={styles.then}>
          Then <Text style={styles.thenPlace}>{destination || 'your destination'}</Text>
        </Text>
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.minutes}>{Math.round(durationMin)} min</Text>
          <Text style={styles.sub}>
            {distanceKm.toFixed(1)} km · Arrive {arrive}
          </Text>
        </View>
        <PressButton style={styles.end} onPress={onEnd}>
          <Text style={styles.endText}>End</Text>
        </PressButton>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    top: {
      position: 'absolute',
      left: 16,
      right: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    turnRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    turnIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    turnText: { flex: 1 },
    distance: { fontFamily: fonts.titleSemibold, fontSize: 30, color: c.text },
    street: { fontFamily: fonts.medium, fontSize: 17, color: c.text },
    mute: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
    then: { fontFamily: fonts.regular, fontSize: 15, color: c.textSecondary },
    thenPlace: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    bottom: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    minutes: { fontFamily: fonts.titleSemibold, fontSize: 28, color: c.text },
    sub: { fontFamily: fonts.regular, fontSize: 15, color: c.textSecondary },
    end: {
      height: 52,
      paddingHorizontal: 28,
      borderRadius: 16,
      backgroundColor: c.alert,
      alignItems: 'center',
      justifyContent: 'center',
    },
    endText: { fontFamily: fonts.semibold, fontSize: 18, color: c.onAlert },
  });
