import { colors } from '@/styles/global';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  loggingOut: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

// Asks the user to confirm logging out, then shows a spinner while signing out.
export default function LogoutPopup({ visible, loggingOut, onConfirm, onClose }: Props) {
  // Taps outside the card and the Android back button do nothing once logging out has started.
  const dismiss = loggingOut ? undefined : onClose;

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        {/* Inner pressable stops taps on the card from closing the popup. */}
        <Pressable style={styles.card} onPress={() => {}}>
          {loggingOut ? (
            <View style={styles.loading}>
              <ActivityIndicator size='large' color={colors.brand} style={styles.spinner} />
              <Text style={styles.loadingText}>Logging out</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Are you sure you want to log out?</Text>
              <View style={styles.row}>
                <Pressable style={[styles.button, styles.no]} onPress={onClose}>
                  <Text style={styles.noText}>No</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={onConfirm}>
                  <Text style={styles.yesText}>Yes</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(40,40,40,0.85)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    backgroundColor: colors.alert,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  yesText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  no: { backgroundColor: '#e5e5e5' },
  noText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  loading: { alignItems: 'center', paddingVertical: 24 },
  spinner: { transform: [{ scale: 2 }], marginVertical: 20 },
  loadingText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: colors.text },
});
