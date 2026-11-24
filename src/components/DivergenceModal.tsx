import Icon from '@/components/Icon';
import PopupShell from '@/components/PopupShell';
import Slider from '@/components/Slider';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PressButton from '@/components/PressButton';

type Props = {
  visible: boolean;
  value: number;
  pricePerKm: number | null;
  onSave: (km: number, pricePerKm: number | null) => void;
  onClose: () => void;
};

const MIN_KM = 0.5;
const MAX_KM = 5;

// Driver: how far off their route they will go to pick up or drop off a rider.
export default function DivergenceModal({ visible, value, pricePerKm, onSave, onClose }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  // What the slider shows while dragging; only saved when Save is pressed.
  const [draft, setDraft] = useState(value);
  const [price, setPrice] = useState('');
  const enteredPrice = price.trim().replace(',', '.');
  const validPrice = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(enteredPrice)
    && Number.isFinite(Number(enteredPrice));

  return (
    <PopupShell
      visible={visible}
      onClose={onClose}
      onShow={() => {
        setDraft(value);
        setPrice(pricePerKm?.toString() ?? '');
      }}
      inset={20}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Max divergence</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Icon name='close' size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Text style={styles.body}>
        How far you are willing to detour to pick up and drop off a rider. Riders outside this
        distance will not be matched with your trip.
      </Text>

      <Text style={styles.value}>{draft} km</Text>
      <Text style={styles.caption}>from your route</Text>

      {/* Gestures inside a Modal need their own root view. */}
      <GestureHandlerRootView style={styles.slider}>
        <Slider value={draft} min={MIN_KM} max={MAX_KM} step={0.5} onChange={setDraft} />
      </GestureHandlerRootView>
      <View style={styles.range}>
        <Text style={styles.rangeText}>{MIN_KM} km</Text>
        <Text style={styles.rangeText}>{MAX_KM} km</Text>
      </View>

      <Text style={styles.priceLabel}>Price per km</Text>
      <TextInput
        accessibilityLabel='Price per km'
        inputMode='decimal'
        placeholder='0.00'
        placeholderTextColor={colors.textSecondary}
        style={styles.priceInput}
        value={price}
        onChangeText={setPrice}
      />
      {!!enteredPrice && !validPrice && (
        <Text style={styles.rangeText}>Enter a nonnegative price with up to two decimal places.</Text>
      )}

      <View style={styles.buttons}>
        <PressButton ghost style={[styles.button, styles.cancel]} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </PressButton>
        <PressButton
          style={styles.button}
          disabled={!!enteredPrice && !validPrice}
          onPress={() => onSave(draft, enteredPrice ? Number(enteredPrice) : null)}
        >
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
    body: {
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 22,
      color: c.textSecondary,
      marginTop: 14,
    },
    value: {
      fontFamily: fonts.titleSemibold,
      fontSize: 52,
      color: c.text,
      textAlign: 'center',
      marginTop: 18,
    },
    caption: {
      fontFamily: fonts.regular,
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: 6,
    },
    slider: { alignSelf: 'stretch' },
    range: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    rangeText: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    priceLabel: { fontFamily: fonts.semibold, fontSize: 15, color: c.text, marginTop: 16 },
    priceInput: {
      fontFamily: fonts.regular,
      fontSize: 17,
      color: c.text,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 12,
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
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
