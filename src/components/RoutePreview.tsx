import Icon from '@/components/Icon';
import StopsList from '@/components/StopsList';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  startText: string;
  endText: string;
  // null = leave now.
  when: Date | null;
  onPickDate: () => void;
  distanceKm: number;
  durationMin: number;
  // Drivers only: how far they will go off their route. Tapping it opens the slider.
  maxDivergenceKm?: number;
  onMaxDivergence?: () => void;
  submitLabel: string;
  onSubmit: () => void;
  loading: boolean;
  // A problem to show above the button, such as a failed post.
  message?: string;
};

function formatWhen(d: Date) {
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

// "Your route" sheet: the trip's stops, when it leaves, distance and time, then the main button.
export default function RoutePreview(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View>
      <StopsList start={p.startText} end={p.endText} />

      <Pressable style={styles.datePill} onPress={p.onPickDate}>
        <Icon name='calendar' size={20} color={colors.text} />
        <Text style={styles.dateText}>{formatWhen(p.when ?? new Date())}</Text>
      </Pressable>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.value}>{p.distanceKm.toFixed(1)} km</Text>
          <Text style={styles.label}>Distance</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.stat}>
          <Text style={styles.value}>{Math.round(p.durationMin)} min</Text>
          <Text style={styles.label}>Est. time</Text>
        </View>
        {p.onMaxDivergence && (
          <>
            <View style={styles.sep} />
            <Pressable style={styles.stat} onPress={p.onMaxDivergence}>
              <Text style={[styles.value, { color: colors.onTint }]}>{p.maxDivergenceKm} km</Text>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Max divergence</Text>
                <Icon name='chevron-right' size={12} color={colors.textSecondary} />
              </View>
            </Pressable>
          </>
        )}
      </View>

      {!!p.message && <Text style={styles.message}>{p.message}</Text>}

      <Pressable style={styles.submit} onPress={p.onSubmit} disabled={p.loading}>
        {p.loading ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <Text style={styles.submitText}>{p.submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    datePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      height: 48,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: c.borderStrong,
      marginTop: 12,
    },
    dateText: { fontFamily: fonts.medium, fontSize: 16, color: c.text },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingVertical: 14,
      marginTop: 12,
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    sep: { width: 1, height: 34, backgroundColor: c.border },
    value: { fontFamily: fonts.titleSemibold, fontSize: 22, color: c.text },
    label: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    message: { fontFamily: fonts.regular, fontSize: 13, color: c.alertText, marginTop: 10 },
    submit: {
      height: 54,
      borderRadius: 18,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    submitText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onBrand },
  });
