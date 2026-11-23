import Icon from '@/components/Icon';
import StopsList from '@/components/StopsList';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';
import PressButton from '@/components/PressButton';
import InlineNotice from '@/components/InlineNotice';

type Props = {
  startText: string;
  endText: string;
  // null = leave now.
  when: Date | null;
  onPickDate: () => void;
  onPickTime: () => void;
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

const formatDay = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// "Your route" sheet: the trip's stops, when it leaves, distance and time, then the main button.
export default function RoutePreview(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const when = p.when ?? new Date();

  return (
    <View>
      <View style={styles.top}>
        <View style={styles.stopsCol}>
          <StopsList start={p.startText} end={p.endText} />
        </View>
        {/* Small black tag in the sheet's top-right corner. */}
        <View style={styles.tag}>
          <View style={styles.tagItem}>
            <Text style={styles.tagValue}>{p.distanceKm.toFixed(1)} km</Text>
            <Text style={styles.tagLabel}>Distance</Text>
          </View>
          <View style={styles.tagSep} />
          <View style={styles.tagItem}>
            <Text style={styles.tagValue}>{Math.round(p.durationMin)} min</Text>
            <Text style={styles.tagLabel}>Est. time</Text>
          </View>
        </View>
      </View>

      {/* Date on one side, time on the other; tap either to change it. */}
      <View style={styles.stats}>
        <PressButton ghost style={styles.stat} onPress={p.onPickDate}>
          <Text style={styles.value}>{formatDay(when)}</Text>
          <View style={styles.labelRow}>
            <Icon name='calendar' size={13} color={colors.text} />
            <Text style={styles.labelEdit}>Date</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.edit}>Edit</Text>
          </View>
        </PressButton>
        <View style={styles.sep} />
        <PressButton ghost style={styles.stat} onPress={p.onPickTime}>
          <Text style={styles.value}>{formatTime(when)}</Text>
          <View style={styles.labelRow}>
            <Icon name='clock' size={13} color={colors.text} />
            <Text style={styles.labelEdit}>Time</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.edit}>Edit</Text>
          </View>
        </PressButton>
        {p.onMaxDivergence && (
          <>
            <View style={styles.sep} />
            <PressButton ghost style={styles.stat} onPress={p.onMaxDivergence}>
              <Text style={styles.value}>{p.maxDivergenceKm} km</Text>
              <View style={styles.labelRow}>
                <Text style={styles.labelEdit} numberOfLines={1}>
                  Max divergence
                </Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.edit}>Edit</Text>
              </View>
            </PressButton>
          </>
        )}
      </View>

      {!!p.message && <InlineNotice message={p.message} style={styles.message} />}

      <PressButton style={styles.submit} onPress={p.onSubmit} disabled={p.loading}>
        <Text style={styles.submitText}>{p.submitLabel}</Text>
      </PressButton>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 6 },
    // Start and end sit in their own light grey cell, like the distance / time tag.
    stopsCol: {
      flex: 1,
      backgroundColor: c.statBg,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    tag: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.statBg,
      borderRadius: 18,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    tagItem: { alignItems: 'center', paddingVertical: 4, gap: 1 },
    tagValue: { fontFamily: fonts.titleSemibold, fontSize: 14, color: c.onStat },
    tagLabel: { fontFamily: fonts.regular, fontSize: 10, color: c.statLabel },
    tagSep: { alignSelf: 'stretch', height: 1, backgroundColor: c.statLabel, opacity: 0.4 },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      paddingVertical: 10,
      marginTop: 12,
      // Only as wide as its contents, centred.
      alignSelf: 'center',
      maxWidth: '100%',
    },
    stat: { alignItems: 'center', gap: 2, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 14 },
    sep: { width: 1, height: 28, backgroundColor: c.border },
    value: { fontFamily: fonts.titleSemibold, fontSize: 17, color: c.text },
    label: { fontFamily: fonts.regular, fontSize: 12, color: c.textSecondary },
    labelEdit: { fontFamily: fonts.regular, fontSize: 12, color: c.text },
    // The Date / Time / Max divergence labels are black; "Edit" is blue.
    dot: { fontFamily: fonts.regular, fontSize: 12, color: c.text },
    edit: { fontFamily: fonts.semibold, fontSize: 12, color: c.brand },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    message: { marginTop: 10 },
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
