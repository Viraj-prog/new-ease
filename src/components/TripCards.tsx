import type { Result } from '@/lib/rides';
import { colors } from '@/styles/global';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

// Passenger: one matching driver.
export function DriverCard({
  item,
  selected,
  extra,
  sent,
  accepted = false,
  onSelect,
  onRequest,
}: {
  item: Result;
  selected: boolean;
  extra: { km: number; min: number } | null;
  sent: boolean;
  accepted?: boolean;
  onSelect: () => void;
  onRequest: () => void;
}) {
  return (
    <Pressable style={[styles.card, selected && styles.cardSelected]} onPress={onSelect}>
      <Text style={styles.title}>
        {item.driverName}
        {item.rating ? `  ·  rating ${item.rating}` : ''}
      </Text>
      <Text style={styles.line}>
        Your pickup is {item.pickupKm.toFixed(1)} km from their route
        {item.zone === 'needs_approval' ? ' (driver will be asked to approve)' : ''}
      </Text>
      <Text style={styles.line}>
        Trip: {item.tripKm.toFixed(1)} km, about {Math.round(item.tripMin)} min
      </Text>

      {selected && (
        <View style={styles.more}>
          {extra ? (
            <Text style={styles.line}>
              With you the trip is +{Math.max(0, extra.km).toFixed(1)} km and +
              {Math.max(0, Math.round(extra.min))} min for the driver.
            </Text>
          ) : (
            <ActivityIndicator color={colors.brand} />
          )}
          {accepted ? (
            <Text style={styles.accepted}>Accepted! Your driver will pick you up.</Text>
          ) : sent ? (
            <Text style={styles.link}>Request sent. Waiting for the driver.</Text>
          ) : (
            <Pressable style={styles.button} onPress={onRequest}>
              <Text style={styles.buttonText}>Request this driver</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 20,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: { backgroundColor: '#eff6ff' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  line: { fontSize: 13, color: '#333' },
  more: { gap: 8, marginTop: 6 },
  button: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  link: { color: '#2563eb', fontWeight: '600', marginTop: 4 },
  accepted: { color: '#16a34a', fontWeight: '700', marginTop: 4 },
});
