import SettingPopup from '@/components/SettingPopup';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

type Props = {
  visible: boolean;
  // null = no price set yet.
  value: number | null;
  onSave: (pricePerKm: number | null) => void;
  onClose: () => void;
};

// Driver: what they charge for each kilometre.
export default function PriceModal({ visible, value, onSave, onClose }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  // What has been typed; only saved when Save is pressed.
  const [price, setPrice] = useState('');
  const enteredPrice = price.trim().replace(',', '.');
  const validPrice = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(enteredPrice)
    && Number.isFinite(Number(enteredPrice));
  const invalid = !!enteredPrice && !validPrice;

  return (
    <SettingPopup
      visible={visible}
      title='Price per km'
      onShow={() => setPrice(value?.toString() ?? '')}
      onClose={onClose}
      onSave={() => onSave(enteredPrice ? Number(enteredPrice) : null)}
      saveDisabled={invalid}
    >
      <TextInput
        accessibilityLabel='Price per km'
        inputMode='decimal'
        placeholder='0.00'
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.brand}
        style={styles.input}
        value={price}
        onChangeText={setPrice}
      />
      {invalid && (
        <Text style={styles.error}>Enter a nonnegative price with up to two decimal places.</Text>
      )}
    </SettingPopup>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    input: {
      fontFamily: fonts.regular,
      fontSize: 17,
      color: c.text,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 12,
      marginTop: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    error: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary, marginTop: 6 },
  });
