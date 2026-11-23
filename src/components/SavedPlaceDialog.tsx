import PopupShell from '@/components/PopupShell';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import PressButton from '@/components/PressButton';
import InlineNotice from '@/components/InlineNotice';

type Props = {
  visible: boolean;
  // "Home", "Work" or "School".
  label: string;
  initialAddress: string;
  // Shown only when editing a place that already exists.
  canDelete: boolean;
  // An error from the last save or delete, if any.
  error: string;
  busy: boolean;
  onSave: (address: string) => void;
  onDelete: () => void;
  onClose: () => void;
};

// Popup for setting or changing the address of Home, Work or School. It is mounted fresh each time it opens (see the
// `key` where it is used), so its fields start from the values it is given.
export default function SavedPlaceDialog(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [address, setAddress] = useState(p.initialAddress);

  const ready = address.trim().length > 0 && !p.busy;
  const title = p.canDelete ? `Edit ${p.label}` : `Set ${p.label}`;

  return (
    <PopupShell visible={p.visible} onClose={p.busy ? undefined : p.onClose} inset={24} style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <Text style={styles.fieldLabel}>Address</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder='Street, building or place'
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.brand}
        autoFocus
      />

      {!!p.error && <InlineNotice message={p.error} />}

      <PressButton
        style={[styles.save, !ready && styles.saveOff]}
        disabled={!ready}
        onPress={() => p.onSave(address.trim())}
      >
        {p.busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.saveText}>Save</Text>}
      </PressButton>

      <Pressable onPress={p.onClose} disabled={p.busy} hitSlop={8}>
        <Text style={styles.link}>Cancel</Text>
      </Pressable>
      {p.canDelete && (
        <Pressable onPress={p.onDelete} disabled={p.busy} hitSlop={8}>
          <Text style={[styles.link, { color: colors.alertText }]}>Remove</Text>
        </Pressable>
      )}
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { borderRadius: 28, padding: 22, gap: 8 },
    title: { fontFamily: fonts.titleSemibold, fontSize: 22, color: c.text, marginBottom: 6 },
    fieldLabel: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary, marginTop: 6 },
    input: {
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      paddingHorizontal: 14,
      fontFamily: fonts.medium,
      fontSize: 16,
      color: c.text,
    },
    save: {
      height: 52,
      borderRadius: 18,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    saveOff: { opacity: 0.45 },
    saveText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onBrand },
    link: { fontFamily: fonts.semibold, fontSize: 15, color: c.brand, textAlign: 'center', marginTop: 6 },
  });
