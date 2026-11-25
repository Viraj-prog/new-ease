import ConfirmDialog from '@/components/ConfirmDialog';
import Icon from '@/components/Icon';
import PressButton from '@/components/PressButton';
import type { PickupStop } from '@/lib/pickupPlanner';
import type { BookedStop, StopMark } from '@/lib/stopProgress';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export type NamedStop = BookedStop & { name: string };

export const stopTitle = (type: PickupStop['type'], name: string) =>
  `${type === 'pickup' ? 'Pick up' : 'Drop off'} ${name}`;

type NextProps = {
  stops: NamedStop[];
  // The mark being saved, if any.
  busy: StopMark | null;
  onMark: (requestId: string, mark: StopMark) => void;
};

// The first stop still to do on a trip under way, with the buttons that record what happened.
export function NextStop({ stops, busy, onMark }: NextProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  // The passenger being confirmed as a no show.
  const [noShow, setNoShow] = useState<NamedStop | null>(null);

  if (stops.length === 0) return null;
  const next = stops.find((s) => !s.done);
  if (!next) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>All stops done</Text>
        <Text style={styles.title}>Finish the trip when you arrive.</Text>
      </View>
    );
  }
  const pickup = next.stop.type === 'pickup';

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Next stop</Text>
      <Text style={styles.title}>{stopTitle(next.stop.type, next.name)}</Text>
      <View style={styles.row}>
        {pickup && (
          <PressButton
            ghost
            style={[styles.button, styles.quiet]}
            disabled={!!busy}
            onPress={() => setNoShow(next)}
          >
            {busy === 'no_show'
              ? <ActivityIndicator color={colors.text} />
              : <Text style={styles.quietText}>No show</Text>}
          </PressButton>
        )}
        <PressButton
          style={[styles.button, styles.main]}
          disabled={!!busy}
          onPress={() => onMark(next.stop.requestId, pickup ? 'picked_up' : 'dropped_off')}
        >
          {busy && busy !== 'no_show'
            ? <ActivityIndicator color={colors.onBrand} />
            : <Text style={styles.mainText}>{pickup ? 'Picked up' : 'Dropped off'}</Text>}
        </PressButton>
      </View>

      <ConfirmDialog
        visible={!!noShow}
        title='No show?'
        message={`${noShow?.name ?? 'This passenger'}’s booking will be cancelled. This cannot be undone.`}
        onYes={() => {
          if (noShow) onMark(noShow.stop.requestId, 'no_show');
          setNoShow(null);
        }}
        onNo={() => setNoShow(null)}
      />
    </View>
  );
}

// Every stop on the trip, in order, with the finished ones ticked.
export function StopChecklist({ stops }: { stops: NamedStop[] }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (stops.length === 0) return null;
  return (
    <View style={styles.list}>
      {stops.map((s) => (
        <View
          key={`${s.stop.requestId}-${s.stop.type}`}
          style={styles.item}
          accessible
          accessibilityLabel={`${stopTitle(s.stop.type, s.name)}, ${s.done ? 'done' : 'to do'}`}
        >
          <View style={styles.marker}>
            {s.done
              ? <Icon name='check-circle' size={18} color={colors.textSecondary} />
              : <View style={[styles.dot, { backgroundColor: s.stop.type === 'pickup' ? colors.pickup : colors.text }]} />}
          </View>
          <Text style={[styles.itemText, s.done && styles.done]}>{stopTitle(s.stop.type, s.name)}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      padding: 14,
      marginBottom: 4,
    },
    label: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    title: { fontFamily: fonts.semibold, fontSize: 18, color: c.text, marginTop: 2 },
    row: { flexDirection: 'row', gap: 12, marginTop: 12 },
    button: { flex: 1, minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    main: { backgroundColor: c.brand },
    mainText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onBrand },
    quiet: { borderWidth: 1, borderColor: c.handle },
    quietText: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    list: { gap: 10, marginTop: 16, marginBottom: 14 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    marker: { width: 20, alignItems: 'center' },
    dot: { width: 12, height: 12, borderRadius: 6 },
    itemText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: c.text },
    done: { color: c.textSecondary },
  });
