import BottomBar from '@/components/delivery/BottomBar';
import Icon from '@/components/Icon';
import PressButton from '@/components/PressButton';
import { CURRENT_LABEL } from '@/lib/places';
import { slotItems } from '@/lib/savedSlots';
import type { RecentPlace, SavedPlace } from '@/lib/savedTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The order the delivery design shows the saved places in.
const ORDER = ['home', 'school', 'work'];

type Props = {
  address: string;
  onAddress: (text: string) => void;
  saved: SavedPlace[];
  recent: RecentPlace[];
  // A saved place with no address yet was tapped (its name is passed in).
  onUnsetSaved: (label: string) => void;
  onNext: () => void;
};

// "Drop off location": type an address, or pick the current, a saved or a recent place.
export default function DropoffView({ address, onAddress, saved, recent, onUnsetSaved, onNext }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);
  const slots = slotItems(saved).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

  function pick(text: string) {
    Keyboard.dismiss();
    onAddress(text);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 24, paddingHorizontal: 20 }}
      >
        <Text style={styles.title}>Drop off location</Text>

        <View style={styles.field}>
          <Icon name='map-pin' size={22} color={colors.brand} />
          <TextInput
            style={styles.input}
            placeholder='Enter an address'
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.brand}
            value={address}
            onChangeText={onAddress}
            returnKeyType='done'
          />
        </View>

        <PressButton ghost style={styles.current} onPress={() => pick(CURRENT_LABEL)}>
          <Text style={styles.currentText}>Use current location</Text>
        </PressButton>

        <Text style={styles.heading}>Saved places</Text>
        <View style={styles.slots}>
          {slots.map((s) => (
            <PressButton
              ghost
              key={s.key}
              style={styles.slot}
              onPress={() => (s.place ? pick(s.place.address) : onUnsetSaved(s.label))}
            >
              <View style={styles.circle}>
                <Icon name={s.icon} size={22} color={colors.onTint} />
              </View>
              <Text style={styles.slotText}>{s.label}</Text>
            </PressButton>
          ))}
        </View>

        <Text style={styles.heading}>Recent places</Text>
        {recent.length === 0 && <Text style={styles.empty}>No recent places yet.</Text>}
        <View style={styles.recent}>
          {recent.map((r) => (
            <PressButton ghost pressScale={0.98} key={r.address} style={styles.recentRow} onPress={() => pick(r.address)}>
              <View style={styles.smallCircle}>
                <Icon name='clock' size={18} color={colors.onTint} />
              </View>
              <View style={styles.recentText}>
                <Text style={styles.recentName} numberOfLines={1}>
                  {r.address}
                </Text>
                {!!r.detail && <Text style={styles.recentDetail}>{r.detail}</Text>}
              </View>
            </PressButton>
          ))}
        </View>
      </ScrollView>

      <BottomBar label='Find Driver and pay' disabled={!address.trim()} onPress={onNext} />
    </View>
  );
}

const makeStyles = (c: Colors) => {
  // The raised white boxes used for the field, the saved places and the recent places.
  const box = {
    backgroundColor: c.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    boxShadow: `0px 4px 12px ${c.shadow}`,
  };
  return StyleSheet.create({
    screen: { flex: 1 },
    title: { fontFamily: fonts.titleSemibold, fontSize: 21, color: c.text, textAlign: 'center', marginBottom: 20 },
    field: { ...box, flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, paddingHorizontal: 18 },
    input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.text, paddingVertical: 0 },
    current: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginTop: 10 },
    currentText: { fontFamily: fonts.semibold, fontSize: 15, color: c.onTint },
    heading: { fontFamily: fonts.semibold, fontSize: 13, color: c.textSecondary, marginTop: 20, marginBottom: 10 },
    slots: { flexDirection: 'row', gap: 12 },
    slot: { ...box, flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12 },
    circle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotText: { fontFamily: fonts.semibold, fontSize: 14, color: c.text },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
    recent: { gap: 12 },
    recentRow: { ...box, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    smallCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentText: { flex: 1 },
    recentName: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
    recentDetail: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
  });
};
