import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  start: string;
  end: string;
  when: string | null;
  // Small status label, e.g. "Waiting for driver".
  badge?: string | null;
  // Green for an accepted or booked ride, dark grey otherwise.
  badgeGreen?: boolean;
  viewLabel: string;
  viewDisabled?: boolean;
  onView: () => void;
  onCancel: () => void;
};

// One ride: where it starts and ends, plus a view button and a cancel button.
export default function RideBox({
  start,
  end,
  when,
  badge,
  badgeGreen = false,
  viewLabel,
  viewDisabled = false,
  onView,
  onCancel,
}: Props) {
  return (
    <View style={styles.box}>
      {(when || badge) && (
        <View style={styles.topRow}>
          {when && <Text style={styles.when}>{when}</Text>}
          {badge && (
            <View style={[styles.badge, badgeGreen && styles.badgeGreen]}>
              <Text style={[styles.badgeText, badgeGreen && styles.badgeTextGreen]}>{badge}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.place}>
        <Ionicons name='location-sharp' size={18} color={colors.brand} />
        <Text style={styles.placeText} numberOfLines={2}>
          {start}
        </Text>
      </View>
      <View style={styles.place}>
        <Ionicons name='flag' size={18} color='#dc2626' />
        <Text style={styles.placeText} numberOfLines={2}>
          {end}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.button, styles.flex, viewDisabled && styles.disabled]}
          onPress={onView}
          disabled={viewDisabled}
        >
          <Text style={styles.buttonText}>{viewLabel}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.cancel, styles.flex]} onPress={onCancel}>
          <Text style={styles.buttonText}>Cancel ride</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  when: { fontSize: 12, color: '#6b6b6b' },
  badge: { backgroundColor: '#d4d4d8', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: '#3f3f46', fontWeight: '600' },
  badgeGreen: { backgroundColor: '#dcf5e3' },
  badgeTextGreen: { color: '#1f9d45' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placeText: { flex: 1, fontSize: 15, color: colors.text },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flex: { flex: 1 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancel: { backgroundColor: colors.alert },
  disabled: { backgroundColor: '#b8b8b8' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
