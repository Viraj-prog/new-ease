import Icon from '@/components/Icon';
import PopupShell from '@/components/PopupShell';
import PressButton from '@/components/PressButton';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  // Called each time the popup opens, to start from the saved value.
  onShow: () => void;
  onClose: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  children: ReactNode;
};

// The frame shared by the popups that change one trip setting: a title, the setting, then
// Cancel and Save.
export default function SettingPopup(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <PopupShell visible={p.visible} onClose={p.onClose} onShow={p.onShow} inset={20} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{p.title}</Text>
        <Pressable onPress={p.onClose} hitSlop={10} accessibilityRole='button' accessibilityLabel='Close'>
          <Icon name='close' size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {p.children}

      <View style={styles.buttons}>
        <PressButton ghost style={[styles.button, styles.cancel]} onPress={p.onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </PressButton>
        <PressButton style={styles.button} disabled={p.saveDisabled} onPress={p.onSave}>
          <Text style={styles.saveText}>Save</Text>
        </PressButton>
      </View>
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { borderRadius: 28, padding: 22, gap: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontFamily: fonts.titleSemibold, fontSize: 22, color: c.text },
    buttons: { flexDirection: 'row', gap: 12, marginTop: 20 },
    button: {
      flex: 1,
      height: 52,
      borderRadius: 18,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancel: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.handle },
    cancelText: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    saveText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onBrand },
  });
