import { useTheme } from '@/lib/theme';
import { type Colors } from '@/styles/theme';
import { Modal, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  visible: boolean;
  // Closes the popup from the Android back button and from a tap outside the card.
  // Leave it out for a popup that cannot be dismissed.
  onClose?: () => void;
  // Set to false to ignore taps outside the card (the back button still uses onClose).
  tapOutside?: boolean;
  onShow?: () => void;
  // Colour of the dimmed screen behind the card. Defaults to the theme's scrim.
  backdrop?: string;
  // Space kept free on the left and right of the card.
  inset?: number;
  // Merged over the default card.
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Card centred over a dimmed screen. Every popup in the app is built on this.
export default function PopupShell({
  visible,
  onClose,
  tapOutside = true,
  onShow,
  backdrop,
  inset = 32,
  style,
  children,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose} onShow={onShow}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: backdrop ?? colors.scrim, paddingHorizontal: inset }]}
        onPress={tapOutside ? onClose : undefined}
      >
        {/* Inner pressable stops taps on the card from closing the popup. */}
        <Pressable style={[styles.card, style]} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'center' },
    card: {
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 20,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
