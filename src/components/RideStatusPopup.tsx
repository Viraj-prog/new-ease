import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import LoadingPopup from './LoadingPopup';
import PopupShell from './PopupShell';
import PressButton from '@/components/PressButton';

type Props = {
  // Spinner while the driver has not answered yet.
  confirming: boolean;
  // Shown once, after the driver answers.
  notice: 'accepted' | 'declined' | null;
  // Who the request went to, for the spinner's subtitle.
  driverName?: string;
  onCancel: () => void;
  onClose: () => void;
};

// Passenger popup: "Confirming Ride" with a spinner, then Ride Declined (an acceptance is a banner on Home).
export default function RideStatusPopup({ confirming, notice, driverName, onCancel, onClose }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  // An acceptance shows as a banner on Home instead, so only a decline is a popup here.
  if (notice !== 'declined') {
    return (
      <LoadingPopup
        visible={confirming}
        title='Confirming ride'
        subtitle={driverName ? `Sending your request to ${driverName}` : 'Sending your request'}
        onCancel={onCancel}
      />
    );
  }

  return (
    <PopupShell visible onClose={onClose} tapOutside={false} inset={40} style={styles.card}>
      <Ionicons name='close-circle' size={84} color={colors.alert} />
      <Text style={styles.title}>Ride Declined</Text>
      <PressButton style={styles.button} onPress={onClose}>
        <Text style={styles.buttonText}>OK</Text>
      </PressButton>
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
