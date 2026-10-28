import type { Req, Trip } from '@/lib/rides';
import { colors } from '@/styles/global';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  req: Req | null;
  trip: Trip | null;
  onRespond: (req: Req, accept: boolean) => void;
  onClose: () => void;
};

// Pops up over the map when a passenger asks for this driver's trip.
export default function RequestPopup({ req, trip, onRespond, onClose }: Props) {
  const waiting = req?.status === 'pending';
  const when = req?.departAt
    ? new Date(req.departAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Modal visible={!!req && !!trip} transparent animationType='fade' onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner pressable stops taps on the card from closing the popup. */}
        <Pressable style={styles.card} onPress={() => {}}>
          {req && trip && (
            <>
              <Text style={styles.heading}>
                {waiting ? 'New ride request' : 'Passenger near your route'}
              </Text>
              <Text style={styles.name}>{req.passengerName ?? 'A passenger'}</Text>

              <View style={styles.details}>
                <Text style={styles.line}>
                  Pickup is {req.pickupKm.toFixed(1)} km from your route.
                </Text>
                <Text style={styles.line}>
                  Drop-off is {req.dropoffKm.toFixed(1)} km from your route.
                </Text>
                {when && <Text style={styles.line}>Leaving: {when}</Text>}
                {req.zone === 'needs_approval' && (
                  <Text style={styles.warn}>
                    That is about {(Math.max(req.pickupKm, req.dropoffKm) - trip.mdd).toFixed(1)} km
                    beyond your usual pickup range. Are you willing to drive the extra distance?
                  </Text>
                )}
              </View>

              {waiting ? (
                <View style={styles.row}>
                  <Pressable style={[styles.button, styles.flex]} onPress={() => onRespond(req, true)}>
                    <Text style={styles.buttonText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.decline, styles.flex]}
                    onPress={() => onRespond(req, false)}
                  >
                    <Text style={styles.buttonText}>Decline</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.line}>
                  This passenger has not chosen a driver yet. You can answer once they pick you.
                </Text>
              )}

              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.link}>{waiting ? 'Not now' : 'Close'}</Text>
              </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 10 },
  heading: { fontSize: 13, fontWeight: '600', color: colors.brand, textTransform: 'uppercase' },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  details: { gap: 4, marginVertical: 4 },
  line: { fontSize: 14, color: '#333' },
  warn: { fontSize: 14, color: '#c2410c', marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  flex: { flex: 1 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  decline: { backgroundColor: '#71717a' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link: { color: '#2563eb', fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
