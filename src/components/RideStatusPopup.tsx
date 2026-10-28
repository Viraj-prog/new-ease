import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
  // An answer takes over from the spinner.
  const showNotice = !!notice;
  const visible = showNotice || confirming;

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      // Android back button: closes a result, but cannot dismiss the spinner.
      onRequestClose={showNotice ? onClose : undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {showNotice ? (
            <>
              <Ionicons
                name={notice === 'accepted' ? 'checkmark-circle' : 'close-circle'}
                size={84}
                color={notice === 'accepted' ? colors.success : '#dc2626'}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 240,
  },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center' },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 40,
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancel: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
});
