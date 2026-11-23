import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import PressButton from '@/components/PressButton';

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);

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
        <Ionicons name='flag' size={18} color={colors.alert} />
        <Text style={styles.placeText} numberOfLines={2}>
          {end}
        </Text>
      </View>

      <View style={styles.buttons}>
        <PressButton
          style={[styles.button, styles.flex, viewDisabled && styles.disabled]}
          onPress={onView}
          disabled={viewDisabled}
        >
          <Text style={[styles.buttonText, viewDisabled && styles.disabledText]}>{viewLabel}</Text>
        </PressButton>
        <PressButton ghost style={[styles.button, styles.cancel, styles.flex]} onPress={onCancel}>
          <Text style={[styles.buttonText, styles.cancelText]}>Cancel ride</Text>
        </PressButton>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    box: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 6,
      elevation: 3,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    when: { fontFamily: fonts.regular, fontSize: 12, color: c.textSecondary },
    badge: { backgroundColor: c.pill, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: c.textSecondary },
    badgeGreen: { backgroundColor: c.successTint },
    badgeTextGreen: { color: c.onSuccessTint },
    place: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    placeText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: c.text },
    buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
    flex: { flex: 1 },
    button: {
      backgroundColor: c.brand,
      borderRadius: 14,
      paddingVertical: 11,
      alignItems: 'center',
    },
    cancel: { backgroundColor: c.alert },
    disabled: { backgroundColor: c.pill },
    buttonText: { fontFamily: fonts.semibold, color: c.onBrand, fontSize: 14 },
    cancelText: { color: c.onAlert },
    disabledText: { color: c.textSecondary },
  });
