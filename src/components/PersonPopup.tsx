import { colors } from '@/styles/global';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PopupShell from './PopupShell';

export type Person = {
  // "Driver" or "Passenger"
  role: string;
  name: string;
  // Extra lines under the name, e.g. a rating.
  lines?: string[];
};

// Small popup with who someone is.
export default function PersonPopup({ person, onClose }: { person: Person | null; onClose: () => void }) {
  return (
    <PopupShell visible={!!person} onClose={onClose} inset={40} style={styles.card}>
      {person && (
        <>
          <Text style={styles.role}>{person.role}</Text>
          <Text style={styles.name}>{person.name}</Text>
          {person.lines && (
            <View style={styles.lines}>
              {person.lines.map((l) => (
                <Text key={l} style={styles.line}>
                  {l}
                </Text>
              ))}
            </View>
          )}
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </>
      )}
    </PopupShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: 22, gap: 8, alignItems: 'center' },
  role: { fontSize: 12, fontWeight: '600', color: colors.brand, textTransform: 'uppercase' },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  lines: { gap: 2, marginBottom: 6 },
  line: { fontSize: 14, color: '#333', textAlign: 'center' },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 36,
    marginTop: 6,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
