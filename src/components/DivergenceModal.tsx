import SettingPopup from '@/components/SettingPopup';
import Slider from '@/components/Slider';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type Props = {
  visible: boolean;
  value: number;
  onSave: (km: number) => void;
  onClose: () => void;
};

const MIN_KM = 0.5;
const MAX_KM = 5;

// Driver: how far off their route they will go to pick up or drop off a rider.
export default function DivergenceModal({ visible, value, onSave, onClose }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  // What the slider shows while dragging; only saved when Save is pressed.
  const [draft, setDraft] = useState(value);

  return (
    <SettingPopup
      visible={visible}
      title='Max divergence'
      onShow={() => setDraft(value)}
      onClose={onClose}
      onSave={() => onSave(draft)}
    >
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
    </SettingPopup>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
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
  });
