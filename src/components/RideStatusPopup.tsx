import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import PopupShell from './PopupShell';

type Props = {
  // Spinner while the driver has not answered yet.
  confirming: boolean;
  // Shown once, after the driver answers.
  notice: 'accepted' | 'declined' | null;
  onCancel: () => void;
  onClose: () => void;
};

// Passenger popup: "Confirming Ride" with a spinner, then Ride Accepted / Ride Declined.
export default function RideStatusPopup({ confirming, notice, onCancel, onClose }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  // An answer takes over from the spinner.
  const showNotice = !!notice;
  const visible = showNotice || confirming;

  return (
    // Android back button closes a result, but cannot dismiss the spinner. Taps outside do nothing.
    <PopupShell
      visible={visible}
      onClose={showNotice ? onClose : undefined}
      tapOutside={false}
      inset={40}
      style={styles.card}
    >
      {showNotice ? (
        <>
          <Ionicons
            name={notice === 'accepted' ? 'checkmark-circle' : 'close-circle'}
            size={84}
            color={notice === 'accepted' ? colors.success : colors.alert}
          />
          <Text style={styles.title}>
            {notice === 'accepted' ? 'Ride Accepted!' : 'Ride Declined'}
          </Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size='large' color={colors.brand} />
          <Text style={styles.title}>Confirming Ride</Text>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </>
      )}
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      paddingVertical: 28,
      paddingHorizontal: 32,
      alignSelf: 'center',
      alignItems: 'center',
      gap: 16,
      minWidth: 240,
    },
    title: { fontFamily: fonts.titleMedium, fontSize: 20, color: c.text, textAlign: 'center' },
    button: {
      backgroundColor: c.brand,
      borderRadius: 20,
      paddingVertical: 10,
      paddingHorizontal: 40,
      marginTop: 4,
    },
    buttonText: { fontFamily: fonts.semibold, color: c.onBrand, fontSize: 15 },
    cancel: { fontFamily: fonts.semibold, color: c.brand, fontSize: 15 },
  });
