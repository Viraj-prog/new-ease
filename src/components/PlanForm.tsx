import Icon from '@/components/Icon';
import InlineNotice from '@/components/InlineNotice';
import PressButton from '@/components/PressButton';
import SegmentedToggle from '@/components/SegmentedToggle';
import { isCurrentLabel } from '@/lib/places';
import { slotItems } from '@/lib/savedSlots';
import { RECENT_TRIPS_SHOWN, type RecentPlace, type SavedPlace } from '@/lib/savedTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  // Left out while a trip is posted, so the form cannot be dismissed from under it.
  onBack?: () => void;
  driverMode: boolean;
  switching: boolean;
  onRole: (driver: boolean) => void;
  // null = leave now.
  when: Date | null;
  onPickDate: () => void;
  driverOptions?: {
    mdd: number;
    pricePerKm: number | null;
    onEditMdd: () => void;
    onEditPrice: () => void;
  };
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
  // A problem with the last attempt, shown under the main button.
  message?: string;
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

// One trip detail that can be changed: its name, what it is set to, and an arrow to show it opens.
function Detail(p: {
  label: string;
  value: string;
  // Not filled in yet, so the value is drawn as the thing to do.
  unset?: boolean;
  // Shares its row equally with a neighbour.
  half?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <PressButton ghost pressScale={0.98} style={[styles.detail, p.half && styles.half]} onPress={p.onPress}>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{p.label}</Text>
        <Text style={[styles.detailValue, p.unset && styles.detailValueUnset]} numberOfLines={1}>
          {p.value}
        </Text>
      </View>
      <Icon name='chevron-right' size={16} color={colors.textSecondary} />
    </PressButton>
  );
}

// The sheet's "plan your ride" / "book your ride" content, top to bottom: who you are, where you
// are going, the trip's details, the main button, then recent trips.
export default function PlanForm(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [destFocused, setDestFocused] = useState(false);
  const [pickupFocused, setPickupFocused] = useState(false);
  // Pressing anywhere on a field's row should start typing, not just on the text itself.
  const pickupRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const destRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  // The main button stays grey until there is a destination to preview.
  const ready = !!p.destination.trim();
  // An untouched start reads as "Current location", which is what a blank start means.
  const usesCurrent = !pickupFocused && !p.pickup;
  const canClear = !!p.pickup || !!p.destination;
  const price = p.driverOptions?.pricePerKm ?? null;

  // A field that is not being typed in shows the beginning of a long address, not its end.
  useEffect(() => {
    if (!pickupFocused) pickupRef.current?.setSelection(0, 0);
  }, [p.pickup, pickupFocused]);
  useEffect(() => {
    if (!destFocused) destRef.current?.setSelection(0, 0);
  }, [p.destination, destFocused]);

  // Swap Start and End. A blank Start is "Current location".
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

  // A tapped recent or saved place goes into the field being typed in (Start or End). With neither
  // selected it goes into End. The keyboard closes; the route is only drawn by the main button.
  function fillCell(place: string) {
    if (pickupFocused) p.onPickup(place);
    else p.onDestination(place);
    Keyboard.dismiss();
  }

  return (
    <View>
      <View style={styles.header}>
        {p.onBack && (
          <Pressable
            style={styles.back}
            accessibilityRole='button'
            accessibilityLabel='Back'
            onPress={p.onBack}
            hitSlop={12}
          >
            <Icon name='arrow-left' color={colors.text} />
          </Pressable>
        )}
        <SegmentedToggle
          style={styles.roleToggle}
          options={[
            { key: 'driver', icon: 'steering-wheel', label: 'Driving' },
            { key: 'rider', icon: 'rider', label: 'Riding' },
          ]}
          value={p.driverMode ? 'driver' : 'rider'}
          onChange={(k) => p.onRole(k === 'driver')}
          disabled={p.switching}
        />
        <Pressable
          style={styles.clear}
          accessibilityRole='button'
          accessibilityLabel='Clear start and end'
          accessibilityState={{ disabled: !canClear }}
          disabled={!canClear}
          onPress={p.onClear}
          hitSlop={14}
        >
          <Text style={[styles.clearText, !canClear && styles.clearTextOff]}>Clear</Text>
        </Pressable>
      </View>

      {/* Start and end, as one card. */}
      <View style={[styles.card, styles.route]}>
        <View style={styles.markers}>
          <View style={styles.startDot} />
          <View style={styles.line} />
          <View style={styles.endPin}>
            <Icon name='map-pin' size={20} color={colors.alert} />
          </View>
        </View>
        <View style={styles.inputs}>
          <Pressable
            style={[styles.field, pickupFocused && styles.fieldFocused]}
            onPress={() => pickupRef.current?.focus()}
          >
            <BottomSheetTextInput
              ref={pickupRef}
              style={styles.input}
              accessibilityLabel='Start'
              placeholder={usesCurrent ? 'Current location' : 'Starting location'}
              placeholderTextColor={usesCurrent ? colors.onTint : colors.placeholder}
              selectionColor={colors.brand}
              value={p.pickup}
              onChangeText={p.onPickup}
              onFocus={() => {
                setPickupFocused(true);
                p.onFocusField();
              }}
              onBlur={() => setPickupFocused(false)}
            />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={[styles.field, destFocused && styles.fieldFocused]}
            onPress={() => destRef.current?.focus()}
          >
            <BottomSheetTextInput
              ref={destRef}
              style={styles.input}
              accessibilityLabel='End'
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
          <PressButton ghost style={styles.swap} onPress={swapCells} hitSlop={8} accessibilityLabel='Swap start and end'>
            <Icon name='swap' size={20} color={colors.brand} />
          </PressButton>
        </View>
      </View>

      {/* Saved places sit right under the fields they fill. */}
      <View style={styles.places}>
        {slotItems(p.saved).map((s) => (
          <PressButton ghost
            key={s.key}
            style={[styles.place, !s.place && styles.placeUnset]}
            onPress={() => (s.place ? fillCell(s.place.address) : p.onUnsetSaved(s.label))}
            accessibilityLabel={s.place ? s.label : `${s.label}, no address saved`}
          >
            <Icon name={s.icon} size={18} color={s.place ? colors.onTint : colors.textSecondary} />
            <Text style={[styles.placeText, !s.place && styles.placeTextUnset]} numberOfLines={1}>
              {s.label}
            </Text>
          </PressButton>
        ))}
      </View>

      {/* When the trip leaves and, for a driver, the two trip settings. */}
      <View style={[styles.card, styles.details]}>
        <Detail label='When' value={formatWhen(p.when ?? new Date())} onPress={p.onPickDate} />
        {p.driverOptions && (
          <>
            <View style={styles.detailDivider} />
            <View style={styles.options}>
              <Detail half label='Max divergence' value={`${p.driverOptions.mdd} km`} onPress={p.driverOptions.onEditMdd} />
              <View style={styles.optionDivider} />
              <Detail
                half
                label='Price per km'
                value={price === null ? 'Set price' : `$${price.toFixed(2)}`}
                unset={price === null}
                onPress={p.driverOptions.onEditPrice}
              />
            </View>
          </>
        )}
      </View>

      <PressButton
        style={[styles.submit, !ready && styles.submitOff]}
        onPress={p.onSubmit}
        disabled={!ready || p.loading}
        accessibilityRole='button'
        accessibilityState={{ disabled: !ready || p.loading }}
      >
        <Text style={[styles.submitText, !ready && styles.submitTextOff]}>{p.submitLabel}</Text>
        <View style={styles.arrow}>
          <Icon name='arrow-left' size={18} color={ready ? colors.onPreview : colors.textSecondary} />
        </View>
      </PressButton>

      {!!p.message && <InlineNotice message={p.message} style={styles.message} />}

      <Text style={styles.heading}>Recent trips</Text>
      {p.recent.length === 0 && <Text style={styles.empty}>Trips you book or post will show up here.</Text>}
      {p.recent.slice(0, RECENT_TRIPS_SHOWN).map((r) => (
        <PressButton ghost pressScale={0.98} key={r.address} style={styles.recentRow} onPress={() => fillCell(r.address)}>
          <View style={styles.recentCircle}>
            <Icon name='clock' size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.recentText}>
            <Text style={styles.recentPlace} numberOfLines={2}>{r.address}</Text>
            {!!r.detail && <Text style={styles.recentWhen}>{r.detail}</Text>}
          </View>
        </PressButton>
      ))}
    </View>
  );
}

// One row of the start / end card, and the corner radius of the cards.
const ROW = 56;
const RADIUS = 18;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    // A minimum, not a fixed height, so the toggle can grow with larger system text.
    header: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 16 },
    // Back and Clear sit outside the row, so the toggle stays centred on the sheet.
    back: { position: 'absolute', left: 0 },
    clear: { position: 'absolute', right: 0 },
    clearText: { fontFamily: fonts.semibold, fontSize: 14, color: c.onTint },
    clearTextOff: { color: c.textSecondary, opacity: 0.5 },
    roleToggle: { width: 224 },

    card: {
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      overflow: 'hidden',
    },
    route: { flexDirection: 'row' },
    // The start dot, joining line and end pin, level with the middle of each row.
    markers: { width: 44, height: ROW * 2 + 1 },
    startDot: {
      position: 'absolute',
      top: ROW / 2 - 6,
      left: 16,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.brand,
    },
    line: { position: 'absolute', top: ROW / 2 + 12, left: 21, width: 2, height: ROW - 28, backgroundColor: c.handle },
    endPin: { position: 'absolute', top: ROW * 1.5 + 1 - 10, left: 12 },
    inputs: { flex: 1 },
    field: { height: ROW - 8, marginVertical: 4, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 12 },
    fieldFocused: { backgroundColor: c.selected },
    input: { fontFamily: fonts.medium, fontSize: 16, color: c.text, padding: 0 },
    divider: { height: 1, backgroundColor: c.border, marginHorizontal: 8 },
    swapCol: { width: 56, alignItems: 'center', justifyContent: 'center' },
    swap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },

    places: { flexDirection: 'row', gap: 8, marginTop: 12 },
    place: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 8,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.selected,
      backgroundColor: c.selected,
    },
    // No address saved yet: outlined instead of filled.
    placeUnset: { borderColor: c.border, backgroundColor: 'transparent' },
    placeText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.text },
    placeTextUnset: { fontFamily: fonts.medium, color: c.textSecondary },

    details: { marginTop: 24 },
    detail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 60,
      paddingLeft: 16,
      paddingRight: 12,
      paddingVertical: 8,
    },
    half: { flex: 1 },
    detailText: { flex: 1 },
    detailLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.textSecondary },
    detailValue: { fontFamily: fonts.semibold, fontSize: 16, color: c.text },
    detailValueUnset: { color: c.onTint },
    detailDivider: { height: 1, backgroundColor: c.border },
    options: { flexDirection: 'row' },
    optionDivider: { width: 1, backgroundColor: c.border },

    submit: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 54,
      borderRadius: 27,
      backgroundColor: c.brand,
      marginTop: 12,
    },
    submitOff: { backgroundColor: c.pill },
    submitText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onPreview },
    submitTextOff: { color: c.textSecondary },
    // The back arrow, turned to point forward.
    arrow: { transform: [{ rotate: '180deg' }] },
    message: { marginTop: 12 },

    heading: { fontFamily: fonts.semibold, fontSize: 17, color: c.text, marginTop: 32, marginBottom: 4 },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, marginTop: 4 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderRadius: 12 },
    recentCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.recentCircle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentText: { flex: 1 },
    recentPlace: { fontFamily: fonts.medium, fontSize: 15, color: c.text },
    recentWhen: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
  });
