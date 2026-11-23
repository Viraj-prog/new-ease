import PopupShell from '@/components/PopupShell';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import PressButton from '@/components/PressButton';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  // Shows a spinner on the Yes button and ignores taps while the action runs.
  busy?: boolean;
  onYes: () => void;
  onNo: () => void;
};

// "Are you sure?" popup with a quiet No and a red Yes.
export default function ConfirmDialog({ visible, title, message, busy, onYes, onNo }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <PopupShell visible={visible} onClose={busy ? undefined : onNo} style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.row}>
        <PressButton ghost style={[styles.button, styles.no]} onPress={onNo} disabled={busy}>
          <Text style={styles.noText}>No</Text>
        </PressButton>
        <PressButton style={styles.button} onPress={onYes} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onAlert} /> : <Text style={styles.yesText}>Yes</Text>}
        </PressButton>
      </View>
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { borderRadius: 28, padding: 22, gap: 10, alignItems: 'center' },
    title: { fontFamily: fonts.titleSemibold, fontSize: 24, color: c.text, textAlign: 'center' },
    message: {
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 23,
      color: c.textSecondary,
      textAlign: 'center',
    },
    row: { flexDirection: 'row', gap: 12, marginTop: 12, alignSelf: 'stretch' },
    button: {
      flex: 1,
      height: 52,
      borderRadius: 18,
      backgroundColor: c.alert,
      alignItems: 'center',
      justifyContent: 'center',
    },
    no: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.handle },
    noText: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    yesText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onAlert },
  });
