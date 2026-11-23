import PopupShell from '@/components/PopupShell';
import Spinner from '@/components/Spinner';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  // Optional line under the title.
  subtitle?: string;
  // Optional "Cancel" link under the text.
  onCancel?: () => void;
};

// Spinner card used for "Finding drivers" and "Confirming ride". It cannot be tapped away.
export default function LoadingPopup({ visible, title, subtitle, onCancel }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <PopupShell visible={visible} tapOutside={false} inset={52} style={styles.card}>
      <Spinner />
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {onCancel && (
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      )}
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      borderRadius: 28,
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: 'center',
      gap: 12,
    },
    title: { fontFamily: fonts.titleMedium, fontSize: 22, color: c.text, marginTop: 8, textAlign: 'center' },
    subtitle: { fontFamily: fonts.regular, fontSize: 16, color: c.textSecondary, textAlign: 'center' },
    cancel: { fontFamily: fonts.semibold, fontSize: 15, color: c.brand, marginTop: 4 },
  });
