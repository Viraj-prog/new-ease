import Icon from '@/components/Icon';
import SegmentedToggle from '@/components/SegmentedToggle';
import { isCurrentLabel } from '@/lib/places';
import { slotItems } from '@/lib/savedSlots';
import type { RecentPlace, SavedPlace } from '@/lib/savedTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import PressButton from '@/components/PressButton';

type Props = {
  // "Plan your ride" for drivers, "Book your ride" for riders.
  title: string;
  // Left out while a trip is posted, so the form cannot be dismissed from under it.
  onBack?: () => void;
  driverMode: boolean;
  switching: boolean;
  onRole: (driver: boolean) => void;
  // null = leave now.
  when: Date | null;
  onPickDate: () => void;
  driverOptions?: { mdd: number; pricePerKm: number | null; onEdit: () => void };
  pickup: string;
  onPickup: (s: string) => void;
  destination: string;
  onDestination: (s: string) => void;
  // Called when either field is tapped, so the sheet can open fully.
  onFocusField: () => void;
  onClear: () => void;
  submitLabel: string;
  onSubmit: () => void;
  loading: boolean;
  recent: RecentPlace[];
  saved: SavedPlace[];
  // A saved place with no address yet was tapped (its name is passed in).
  onUnsetSaved: (label: string) => void;
};

function formatWhen(d: Date) {
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

// The sheet's "plan your ride" / "book your ride" content.
export default function PlanForm(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [destFocused, setDestFocused] = useState(false);
  const [pickupFocused, setPickupFocused] = useState(false);
  // Pressing anywhere on a field's cell should start typing, not just on the text itself.
  const pickupRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const destRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  // The grey "Current location" chip only shows while the start is untouched.
  const showChip = !pickupFocused && !p.pickup;

  // A tapped recent or saved place goes into the cell being typed in (Start or End). With no cell
  // selected it goes into End. The keyboard closes; the route is only drawn by "Preview route".
  // Swap the Start and End cells. A blank Start is "Current location".
  //  - both filled: they trade places
  //  - Start filled, End empty: the Start moves to the End, and the Start goes back to Current location
  //  - Start blank, End filled: the End moves to the Start, and the End empties
  //  - both empty: nothing happens
  function swapCells() {
    const start = isCurrentLabel(p.pickup) ? '' : p.pickup.trim();
    const end = p.destination.trim();
    if (!start && !end) return;
    if (!end) {
      p.onPickup('');
      p.onDestination(start);
    } else if (!start) {
      p.onPickup(end);
      p.onDestination('');
    } else {
      p.onPickup(isCurrentLabel(end) ? '' : end);
      p.onDestination(start);
    }
    Keyboard.dismiss();
  }

  function fillCell(place: string) {
    if (pickupFocused) p.onPickup(place);
    else p.onDestination(place);
    Keyboard.dismiss();
  }

  return (
    <View>
      <View style={styles.header}>
        {p.onBack && (
          <Pressable onPress={p.onBack} hitSlop={10}>
            <Icon name='arrow-left' color={colors.text} />
          </Pressable>
        )}
        <Text style={styles.title}>{p.title}</Text>
        <SegmentedToggle
          compact
          // Same size as the theme toggle, so it is easy to tap.
          segment={40}
          options={[
            { key: 'driver', icon: 'steering-wheel' },
            { key: 'rider', icon: 'rider' },
          ]}
          value={p.driverMode ? 'driver' : 'rider'}
          onChange={(k) => p.onRole(k === 'driver')}
          disabled={p.switching}
        />
      </View>

      <View style={styles.pillRow}>
        <PressButton ghost style={styles.pill} onPress={p.onPickDate}>
          <Icon name='calendar' size={20} color={colors.text} />
          <Text style={styles.pillText}>{formatWhen(p.when ?? new Date())}</Text>
        </PressButton>
        {p.driverOptions && (
          <PressButton ghost style={styles.pill} onPress={p.driverOptions.onEdit}>
            <Text style={styles.pillText}>
              {p.driverOptions.mdd} km divergence · {
                p.driverOptions.pricePerKm === null
                  ? 'Set price per km'
                  : `${p.driverOptions.pricePerKm.toFixed(2)} per km`
              }
            </Text>
          </PressButton>
        )}
      </View>

      <View style={styles.fields}>
        <View style={styles.connector}>
          <View style={[styles.dot, { backgroundColor: colors.brand }]} />
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.miniDot, { backgroundColor: colors.brand }]} />
            ))}
          </View>
          <Icon name='map-pin' size={24} color={colors.brand} />
        </View>
        <View style={styles.inputs}>
          <Pressable
            style={[styles.field, pickupFocused && { borderColor: colors.brand }]}
            onPress={() => pickupRef.current?.focus()}
          >
            {/* Untouched, the start is a grey chip. Tapping it or typing drops the chip and
                outlines the field in blue, like the destination. */}
            <View style={showChip ? styles.chip : styles.chipBare}>
              <BottomSheetTextInput
                ref={pickupRef}
                style={showChip ? [styles.chipInput, styles.chipInputEmpty] : styles.input}
                // The untouched grey chip says what a blank Start means; once you tap the cell, the
                // empty field asks for a starting location.
                placeholder={showChip ? 'Current location' : 'Starting location'}
                placeholderTextColor={showChip ? colors.text : colors.placeholder}
                selectionColor={colors.brand}
                value={p.pickup}
                onChangeText={p.onPickup}
                onFocus={() => {
                  setPickupFocused(true);
                  p.onFocusField();
                }}
                onBlur={() => setPickupFocused(false)}
              />
            </View>
          </Pressable>
          <Pressable
            style={[styles.field, destFocused && { borderColor: colors.brand }]}
            onPress={() => destRef.current?.focus()}
          >
            <BottomSheetTextInput
              ref={destRef}
              style={styles.input}
              placeholder='Where to?'
              placeholderTextColor={colors.placeholder}
              selectionColor={colors.brand}
              value={p.destination}
              onChangeText={p.onDestination}
              onFocus={() => {
                setDestFocused(true);
                p.onFocusField();
              }}
              onBlur={() => setDestFocused(false)}
            />
          </Pressable>
        </View>
        <View style={styles.swapCol}>
          <PressButton ghost style={styles.swap} onPress={swapCells} hitSlop={8}>
            <Icon name='swap' size={22} color={colors.brand} />
          </PressButton>
        </View>
      </View>

      <Pressable onPress={p.onClear} hitSlop={8}>
        <Text style={styles.clear}>Clear</Text>
      </Pressable>

      <View style={styles.chips}>
        {slotItems(p.saved).map((s) => (
          <PressButton ghost
            key={s.key}
            style={styles.savedChip}
            onPress={() => (s.place ? fillCell(s.place.address) : p.onUnsetSaved(s.label))}
          >
            <Icon name={s.icon} size={20} color={colors.onTint} />
            <Text style={styles.savedChipText}>{s.label}</Text>
          </PressButton>
        ))}
      </View>

      <Text style={styles.heading}>Recent trips</Text>
      {p.recent.map((r) => (
        <PressButton ghost pressScale={0.98} key={r.address} style={styles.recentRow} onPress={() => fillCell(r.address)}>
          <View style={styles.recentCircle}>
            <Icon name='clock' size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.recentText}>
            <Text style={styles.recentPlace}>{r.address}</Text>
            {!!r.detail && <Text style={styles.recentWhen}>{r.detail}</Text>}
          </View>
        </PressButton>
      ))}

      {/* The main button sits below the recent trips. */}
      <PressButton style={styles.submit} onPress={p.onSubmit} disabled={p.loading}>
        <Text style={styles.submitText}>{p.submitLabel}</Text>
      </PressButton>
    </View>
  );
}

const FIELD_HEIGHT = 68;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, marginBottom: 22 },
    title: { flex: 1, fontFamily: fonts.titleSemibold, fontSize: 23, color: c.text },
    // Starts where the Start / End cells start: the dots column (24) plus the gap (12).
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginLeft: 36 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      minHeight: 40,
      maxWidth: '100%',
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.borderStrong,
    },
    pillText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 15, color: c.text },
    fields: { flexDirection: 'row', gap: 12, marginTop: 12 },
    connector: { width: 24, alignItems: 'center', paddingTop: 25, paddingBottom: 22 },
    dot: { width: 18, height: 18, borderRadius: 9 },
    dots: { flex: 1, justifyContent: 'center', gap: 14 },
    miniDot: { width: 4, height: 4, borderRadius: 2 },
    inputs: { flex: 1, gap: 10 },
    // Swap button, centred between the two cells.
    swapCol: { width: 40, justifyContent: 'center', alignItems: 'center' },
    swap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    field: {
      height: FIELD_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    input: {
      fontFamily: fonts.medium,
      fontSize: 18,
      color: c.text,
      paddingVertical: 0,
      paddingHorizontal: 8,
    },
    chip: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      borderRadius: 14,
      backgroundColor: c.borderStrong,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    // Same spot as the chip's text, but with no grey background.
    chipBare: { alignSelf: 'stretch' },
    chipInput: { fontFamily: fonts.semibold, fontSize: 19, color: c.text, paddingVertical: 0 },
    chipInputEmpty: { minWidth: 150 },
    clear: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      color: c.brand,
      marginTop: 14,
      marginLeft: 52,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
    savedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.selected,
    },
    savedChipText: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
    heading: { fontFamily: fonts.semibold, fontSize: 17, color: c.text, marginTop: 28, marginBottom: 6 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
    recentCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentText: { flex: 1 },
    recentPlace: { fontFamily: fonts.medium, fontSize: 16, color: c.text },
    recentWhen: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    submit: {
      height: 54,
      borderRadius: 27,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    submitText: { fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF' },
  });
