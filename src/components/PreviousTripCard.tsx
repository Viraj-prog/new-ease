import PressButton from '@/components/PressButton';
import StopsList from '@/components/StopsList';
import type { PreviousTrip } from '@/lib/previousTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

function whenText(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

// One finished ride: when, the price, start and end, and who was on the other side of it.
export default function PreviousTripCard({
  trip,
  avatarIndex,
  onRedo,
  onFindAnother,
}: {
  trip: PreviousTrip;
  avatarIndex: number;
  // Opens the route preview for the same start and end.
  onRedo: () => void;
  onFindAnother?: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const avatar = colors.avatars[avatarIndex % colors.avatars.length];
  // The user drove: the other person was the rider, and the other way round.
  const otherRole = trip.role === 'driver' ? 'Rider' : 'Driver';
  // Only a finished ride moved money: green if you earned it, red if you paid it.
  const finished = !trip.statusLabel || trip.statusLabel === 'Completed';
  const money = !finished || trip.price == null ? null : trip.role === 'driver' ? 'earned' : 'paid';

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View>
          <Text style={styles.when}>{whenText(trip.departAt)}</Text>
          {trip.statusLabel && <Text style={styles.status}>{trip.statusLabel}</Text>}
        </View>
        <View style={[styles.pricePill, money === 'earned' && styles.earned, money === 'paid' && styles.paid]}>
          <Text
            style={[
              styles.price,
              money === 'earned' && { color: colors.onSuccessTint },
              money === 'paid' && { color: colors.alertText },
            ]}
          >
            {trip.price == null ? '—' : `${trip.estimated ? '~' : ''}$${trip.price.toFixed(2)}`}
          </Text>
        </View>
      </View>

      <View style={styles.stops}>
        <StopsList start={trip.start} end={trip.end} />
      </View>

      <View style={styles.person}>
        <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
          <Text style={[styles.avatarText, { color: avatar.fg }]}>{initialsOf(trip.otherName ?? '')}</Text>
        </View>
        <View style={styles.personText}>
          <Text style={styles.personRole}>{otherRole}</Text>
          <Text style={styles.personName} numberOfLines={1}>
            {trip.otherName ?? 'No passenger'}
          </Text>
        </View>
        <PressButton style={styles.redo} onPress={onRedo}>
          <Text style={styles.redoText}>Redo</Text>
        </PressButton>
      </View>
      {onFindAnother && (
        <PressButton style={styles.redo} onPress={onFindAnother}>
          <Text style={styles.redoText}>Find another driver</Text>
        </PressButton>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 12,
    },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    when: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
    status: { fontFamily: fonts.semibold, fontSize: 12, color: c.textSecondary, marginTop: 4 },
    pricePill: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
    earned: { backgroundColor: c.successTint },
    paid: { backgroundColor: 'rgba(255,107,107,0.18)' },
    price: { fontFamily: fonts.titleSemibold, fontSize: 22, color: c.text },
    // Start and end in a light grey cell, like the route preview.
    stops: {
      backgroundColor: c.statBg,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.titleSemibold, fontSize: 16 },
    personText: { flex: 1 },
    redo: {
      height: 36,
      paddingHorizontal: 20,
      borderRadius: 18,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    redoText: { fontFamily: fonts.semibold, fontSize: 15, color: c.onBrand },
    personRole: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    personName: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
  });
