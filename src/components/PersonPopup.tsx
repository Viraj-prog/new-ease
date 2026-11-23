import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';
import PopupShell from './PopupShell';
import PressButton from '@/components/PressButton';

export type Person = {
  // "Driver" or "Passenger"
  role: string;
  name: string;
  // Extra lines under the name, e.g. a rating.
  lines?: string[];
};

// Small popup with who someone is.
export default function PersonPopup({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

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
          <PressButton style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </PressButton>
        </>
      )}
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { padding: 22, gap: 8, alignItems: 'center' },
    role: { fontFamily: fonts.semibold, fontSize: 12, color: c.brand, textTransform: 'uppercase' },
    name: { fontFamily: fonts.titleSemibold, fontSize: 24, color: c.text, textAlign: 'center' },
    lines: { gap: 2, marginBottom: 6 },
    line: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
    button: {
      backgroundColor: c.brand,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 36,
      marginTop: 6,
    },
    buttonText: { fontFamily: fonts.semibold, color: c.onBrand, fontSize: 15 },
  });
