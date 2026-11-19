import Icon from '@/components/Icon';
import { SAMPLE_RECENT, SAVED } from '@/lib/sampleTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  // A recent trip was tapped: its place becomes the destination.
  onPickRecent: (place: string) => void;
  // A saved-trip button was tapped.
  onSaved: () => void;
};

// What the sheet shows when nothing is being planned: recent and saved trips.
// (The search pill floats over the top edge of the sheet, so it is not part of this.)
export default function HomeSheetContent({ onPickRecent, onSaved }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View>
      <Text style={styles.heading}>Recent trips</Text>
      {SAMPLE_RECENT.map((r) => (
        <Pressable key={r.place} style={styles.recentRow} onPress={() => onPickRecent(r.place)}>
          <View style={styles.recentCircle}>
            <Icon name='clock' size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.recentText}>
            <Text style={styles.recentPlace}>{r.place}</Text>
            <Text style={styles.recentWhen}>{r.when}</Text>
          </View>
        </Pressable>
      ))}

      <Text style={[styles.heading, styles.headingGap]}>Saved trips</Text>
      <View style={styles.savedRow}>
        {SAVED.map((s) => (
          <Pressable key={s.label} style={styles.savedItem} onPress={onSaved}>
            <View style={styles.savedCircle}>
              <Icon name={s.icon} size={22} color={colors.onTint} />
            </View>
            <Text style={styles.savedLabel}>{s.label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.savedItem} onPress={onSaved}>
          <View style={[styles.savedCircle, styles.addCircle]}>
            <Icon name='plus' size={22} color={colors.onBrand} />
          </View>
          <Text style={styles.savedLabel}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    heading: { fontFamily: fonts.semibold, fontSize: 16, color: c.text, marginBottom: 2 },
    headingGap: { marginTop: 13, marginBottom: 10 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
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
    savedItem: { flex: 1, alignItems: 'center', gap: 5 },
    savedCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addCircle: { backgroundColor: c.brand },
    savedLabel: { fontFamily: fonts.medium, fontSize: 13, color: c.text },
  });
