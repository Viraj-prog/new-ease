import Icon from '@/components/Icon';
import SegmentedToggle from '@/components/SegmentedToggle';
import { SAMPLE_RECENT, SAVED } from '@/lib/sampleTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
  pickup: string;
  onPickup: (s: string) => void;
  destination: string;
  onDestination: (s: string) => void;
  // Called when either field is tapped, so the sheet can open fully.
  onFocusField: () => void;
  showClear: boolean;
  onClear: () => void;
  // Drivers only: how far they will go off their route to pick someone up.
  maxDivergenceKm?: number;
  onMaxDivergence?: () => void;
  submitLabel: string;
  onSubmit: () => void;
  loading: boolean;
  onPickRecent: (place: string) => void;
  onSaved: () => void;
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
        <Pressable style={styles.pill} onPress={p.onPickDate}>
          <Icon name='calendar' size={20} color={colors.text} />
          <Text style={styles.pillText}>{formatWhen(p.when ?? new Date())}</Text>
        </Pressable>
        {p.onMaxDivergence && (
          <Pressable style={styles.pill} onPress={p.onMaxDivergence}>
            <Text style={styles.pillLabel}>Max divergence</Text>
            <Text style={styles.pillValue}>{p.maxDivergenceKm} km</Text>
            <Icon name='chevron-right' size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.fields}>
        <View style={styles.connector}>
          <View style={[styles.dot, { backgroundColor: colors.text }]} />
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.miniDot, { backgroundColor: colors.text }]} />
            ))}
          </View>
          <Icon name='map-pin' size={24} color={colors.text} />
        </View>
        <View style={styles.inputs}>
          <View style={styles.field}>
            <BottomSheetTextInput
              style={styles.input}
              placeholder='Current location'
              placeholderTextColor={colors.text}
              selectionColor={colors.brand}
              value={p.pickup}
              onChangeText={p.onPickup}
              onFocus={p.onFocusField}
            />
          </View>
          <View style={[styles.field, destFocused && { borderColor: colors.brand }]}>
            <BottomSheetTextInput
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
          </View>
        </View>
      </View>

      {p.showClear && (
        <Pressable onPress={p.onClear} hitSlop={8}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      )}

      <Pressable style={styles.submit} onPress={p.onSubmit} disabled={p.loading}>
        {p.loading ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <Text style={styles.submitText}>{p.submitLabel}</Text>
        )}
      </Pressable>

      <View style={styles.chips}>
        {SAVED.map((s) => (
          <Pressable key={s.label} style={styles.chip} onPress={p.onSaved}>
            <Icon name={s.icon} size={18} color={colors.onTint} />
            <Text style={styles.chipText}>{s.label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.addChip} onPress={p.onSaved}>
          <Icon name='plus' size={22} color={colors.onBrand} />
        </Pressable>
      </View>

      <Text style={styles.heading}>Recent trips</Text>
      {SAMPLE_RECENT.map((r) => (
        <Pressable key={r.place} style={styles.recentRow} onPress={() => p.onPickRecent(r.place)}>
          <View style={styles.recentCircle}>
            <Icon name='clock' size={22} color={colors.textSecondary} />
          </View>
          <View style={styles.recentText}>
            <Text style={styles.recentPlace}>{r.place}</Text>
            <Text style={styles.recentWhen}>{r.when}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const FIELD_HEIGHT = 64;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4, marginBottom: 16 },
    title: { flex: 1, fontFamily: fonts.titleSemibold, fontSize: 26, color: c.text },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.borderStrong,
    },
    pillText: { fontFamily: fonts.medium, fontSize: 15, color: c.text },
    pillLabel: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
    pillValue: { fontFamily: fonts.semibold, fontSize: 15, color: c.brand },
    fields: { flexDirection: 'row', gap: 12, marginTop: 16 },
    connector: { width: 28, alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
    dot: { width: 18, height: 18, borderRadius: 9 },
    dots: { flex: 1, justifyContent: 'center', gap: 6 },
    miniDot: { width: 4, height: 4, borderRadius: 2 },
    inputs: { flex: 1, gap: 12 },
    field: {
      height: FIELD_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    input: { fontFamily: fonts.medium, fontSize: 17, color: c.text, paddingVertical: 0 },
    clear: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      color: c.brand,
      marginTop: 12,
      marginLeft: 40,
    },
    submit: {
      height: 52,
      borderRadius: 26,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },
    submitText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onBrand },
    chips: { flexDirection: 'row', gap: 8, marginTop: 20 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.selected,
    },
    chipText: { fontFamily: fonts.semibold, fontSize: 14, color: c.text },
    addChip: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heading: { fontFamily: fonts.semibold, fontSize: 20, color: c.text, marginTop: 24, marginBottom: 8 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
    recentCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentText: { flex: 1 },
    recentPlace: { fontFamily: fonts.medium, fontSize: 17, color: c.text },
    recentWhen: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
  });
