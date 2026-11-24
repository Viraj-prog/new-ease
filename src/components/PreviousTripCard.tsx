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
}: {
  trip: PreviousTrip;
  avatarIndex: number;
  // Opens the route preview for the same start and end.
  onRedo: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const avatar = colors.avatars[avatarIndex % colors.avatars.length];
  // The user drove: the other person was the rider, and the other way round.
  const otherRole = trip.role === 'driver' ? 'Rider' : 'Driver';

  // Money coming to the user: earned by driving, or paid back after the driver cancelled.
  const gained = trip.role === 'driver' || trip.refunded;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.when}>{whenText(trip.departAt)}</Text>
        {/* Green when the money came to the user, red when they paid it. */}
        <View style={[styles.pricePill, gained ? styles.earned : styles.paid]}>
          <Text style={[styles.price, { color: gained ? colors.onSuccessTint : colors.alertText }]}>
            {trip.price == null ? '—' : `${trip.estimated ? '~' : ''}$${trip.price.toFixed(2)}`}
          </Text>
        </View>
      </View>

      <View style={styles.stops}>
        <StopsList start={trip.start} end={trip.end} />
      </View>

      {trip.refunded && (
        <Text style={styles.note}>The driver cancelled this trip. You were refunded in full.</Text>
      )}
      {!trip.refunded && trip.cancelledAfterStart && (
        <Text style={styles.note}>
          {trip.role === 'driver'
            ? 'The passenger cancelled after the trip started. You were still paid.'
            : 'You cancelled after the trip started. The fare was still charged.'}
        </Text>
      )}

      <View style={styles.person}>
        <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
          <Text style={[styles.avatarText, { color: avatar.fg }]}>{initialsOf(trip.otherName)}</Text>
        </View>
        <View style={styles.personText}>
          <Text style={styles.personRole}>{otherRole}</Text>
          <Text style={styles.personName} numberOfLines={1}>
            {trip.otherName}
          </Text>
        </View>
        <PressButton style={styles.redo} onPress={onRedo}>
          <Text style={styles.redoText}>Redo</Text>
        </PressButton>
      </View>
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
    note: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    pricePill: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
    earned: { backgroundColor: c.successTint },
    paid: { backgroundColor: 'rgba(255,107,107,0.18)' },
    price: { fontFamily: fonts.titleSemibold, fontSize: 22 },
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
