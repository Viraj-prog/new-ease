import Icon from '@/components/Icon';
import { slotItems } from '@/lib/savedSlots';
import { RECENT_TRIPS_SHOWN, type RecentPlace, type SavedPlace } from '@/lib/savedTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';
import PressButton from '@/components/PressButton';

type Props = {
  recent: RecentPlace[];
  saved: SavedPlace[];
  // A recent trip was tapped: its place becomes the destination.
  onPickRecent: (place: string) => void;
  // A saved place with an address was tapped: it becomes the destination.
  onPickSaved: (address: string) => void;
  // A saved place with no address yet was tapped (its name is passed in).
  onUnsetSaved: (label: string) => void;
};

// What the sheet shows when nothing is being planned: recent and saved trips.
// (The search pill floats over the top edge of the sheet, so it is not part of this.)
export default function HomeSheetContent({ recent, saved, onPickRecent, onPickSaved, onUnsetSaved }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View>
      <Text style={styles.heading}>Recent trips</Text>
      {recent.length === 0 && <Text style={styles.empty}>Trips you book or post will show up here.</Text>}
      {recent.slice(0, RECENT_TRIPS_SHOWN).map((r) => (
        <PressButton ghost pressScale={0.98} key={r.address} style={styles.recentRow} onPress={() => onPickRecent(r.address)}>
          <View style={styles.recentCircle}>
            <Icon name='clock' size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.recentText}>
            <Text style={styles.recentPlace}>{r.address}</Text>
            {!!r.detail && <Text style={styles.recentWhen}>{r.detail}</Text>}
          </View>
        </PressButton>
      ))}

      <Text style={[styles.heading, styles.headingGap]}>Saved trips</Text>
      <View style={styles.savedRow}>
        {slotItems(saved).map((s) => (
            <PressButton ghost
              key={s.key}
              style={styles.savedItem}
              onPress={() => (s.place ? onPickSaved(s.place.address) : onUnsetSaved(s.label))}
            >
              <View style={styles.savedCircle}>
                <Icon name={s.icon} size={22} color={colors.onTint} />
              </View>
              <Text style={styles.savedLabel}>{s.label}</Text>
            </PressButton>
          ))}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    heading: { fontFamily: fonts.semibold, fontSize: 16, color: c.text, marginBottom: 2 },
    headingGap: { marginTop: 13, marginBottom: 10 },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, paddingVertical: 10 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
    recentCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.recentCircle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentText: { flex: 1 },
    recentPlace: { fontFamily: fonts.medium, fontSize: 16, color: c.text },
    recentWhen: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    savedRow: { flexDirection: 'row' },
    savedItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 6, borderRadius: 16 },
    savedCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    savedLabel: { fontFamily: fonts.medium, fontSize: 13, color: c.text },
  });
