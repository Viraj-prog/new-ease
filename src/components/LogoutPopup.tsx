import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import PopupShell from './PopupShell';
import PressButton from '@/components/PressButton';

type Props = {
  visible: boolean;
  loggingOut: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

// Asks the user to confirm logging out, then shows a spinner while signing out.
export default function LogoutPopup({ visible, loggingOut, onConfirm, onClose }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <PopupShell
      visible={visible}
      // Taps outside the card and the Android back button do nothing once logging out has started.
      onClose={loggingOut ? undefined : onClose}
      style={styles.card}
    >
      {loggingOut ? (
        <View style={styles.loading}>
          <ActivityIndicator size='large' color={colors.brand} style={styles.spinner} />
          <Text style={styles.loadingText}>Logging out</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Are you sure you want to log out?</Text>
          <View style={styles.row}>
            <PressButton ghost style={[styles.button, styles.no]} onPress={onClose}>
              <Text style={styles.noText}>No</Text>
            </PressButton>
            <PressButton style={styles.button} onPress={onConfirm}>
              <Text style={styles.yesText}>Yes</Text>
            </PressButton>
          </View>
        </>
      )}
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { gap: 16 },
    title: { fontFamily: fonts.titleMedium, fontSize: 18, color: c.text, textAlign: 'center' },
    row: { flexDirection: 'row', gap: 10 },
    button: {
      flex: 1,
      backgroundColor: c.alert,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    yesText: { fontFamily: fonts.semibold, color: c.onAlert, fontSize: 15 },
    no: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.handle },
    noText: { fontFamily: fonts.semibold, color: c.text, fontSize: 15 },
    loading: { alignItems: 'center', paddingVertical: 24 },
    spinner: { transform: [{ scale: 2 }], marginVertical: 20 },
    loadingText: { fontFamily: fonts.semibold, marginTop: 16, fontSize: 18, color: c.text },
  });
