import Icon from '@/components/Icon';
import StopsList from '@/components/StopsList';
import type { Req } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PressButton from '@/components/PressButton';

type Props = {
  startText: string;
  endText: string;
  mddKm: number;
  // A passenger asking for this trip, if one is waiting for an answer.
  request: Req | null;
  // The passenger who has been accepted, if any.
  booked: { name: string | null } | null;
  // Notices such as "Trip posted: 6.2 km" or an error from answering a request.
  message: string;
  onAccept: () => void;
  onDecline: () => void;
  onNotNow: () => void;
  onStart: () => void;
  onCancel: () => void;
};

// Which title the map chip above the sheet should show for the current state.
export function tripTitle(request: Req | null, booked: { name: string | null } | null) {
  if (request) return 'Ride request';
  if (booked) return 'Passenger booked';
  return 'Trip posted';
}

const initialsOf = (name: string | null) =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

// The sheet a driver sees once a trip is posted: waiting, a request to answer, or a booked passenger.
export default function TripSheet(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const name = p.request?.passengerName ?? p.booked?.name ?? null;
  const avatar = colors.avatars[0];

  const stops = <StopsList start={p.startText} end={p.endText} />;

  const startCancel = (
    <View style={styles.row}>
      <PressButton style={[styles.button, { backgroundColor: colors.success }]} onPress={p.onStart}>
        <Text style={[styles.buttonText, { color: colors.onSuccess }]}>Start trip</Text>
      </PressButton>
      <PressButton style={[styles.button, { backgroundColor: colors.alert }]} onPress={p.onCancel}>
        <Text style={[styles.buttonText, { color: colors.onAlert }]}>Cancel trip</Text>
      </PressButton>
    </View>
  );

  // A passenger is asking for this trip.
  if (p.request) {
    const r = p.request;
    const inRange = r.zone === 'in_range';
    const worst = Math.max(r.pickupKm, r.dropoffKm);
    return (
      <View>
        <View style={styles.personCard}>
          <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
            <Text style={[styles.avatarText, { color: avatar.fg }]}>{initialsOf(name)}</Text>
          </View>
          <View style={styles.personText}>
            <Text style={styles.personName}>{name ?? 'A passenger'}</Text>
            <Text style={styles.personSub}>wants to join your trip</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <View style={[styles.dot, { backgroundColor: colors.pickup }]} />
            <Text style={styles.detailLabel}>Pickup</Text>
            <Text style={styles.detailText}>{r.pickupKm.toFixed(1)} km from your route</Text>
          </View>
          <View style={styles.detailRow}>
            <View style={[styles.dot, { backgroundColor: colors.text }]} />
            <Text style={styles.detailLabel}>Drop-off</Text>
            <Text style={styles.detailText}>{r.dropoffKm.toFixed(1)} km from your route</Text>
          </View>
        </View>

        <View style={[styles.note, !inRange && styles.noteWarn]}>
          <Icon name='check-circle' size={22} color={inRange ? colors.onTint : colors.alertText} />
          <Text style={styles.noteText}>
            {inRange
              ? `Detour ${worst.toFixed(1)} km · within your ${p.mddKm} km limit`
              : `${(worst - p.mddKm).toFixed(1)} km beyond your ${p.mddKm} km limit. Drive the extra distance?`}
          </Text>
        </View>

        <View style={styles.row}>
          <PressButton style={[styles.button, { backgroundColor: colors.alert }]} onPress={p.onDecline}>
            <Text style={[styles.buttonText, { color: colors.onAlert }]}>Decline</Text>
          </PressButton>
          <PressButton style={[styles.button, { backgroundColor: colors.brand }]} onPress={p.onAccept}>
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>Accept</Text>
          </PressButton>
        </View>
        <Pressable onPress={p.onNotNow} hitSlop={8}>
          <Text style={styles.link}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  // A passenger is booked on this trip.
  if (p.booked) {
    return (
      <View>
        <View style={styles.personCard}>
          <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
            <Text style={[styles.avatarText, { color: avatar.fg }]}>{initialsOf(name)}</Text>
          </View>
          <View style={styles.personText}>
            <Text style={styles.personName}>{name ?? 'Your passenger'}</Text>
            <Text style={styles.personSub}>booked on your trip</Text>
          </View>
        </View>
        {stops}
        <View style={styles.note}>
          <Icon name='check-circle' size={22} color={colors.onTint} />
          <Text style={styles.noteText}>Within your {p.mddKm} km limit</Text>
        </View>
        {startCancel}
      </View>
    );
  }

  // Nobody has asked yet.
  return (
    <View>
      {stops}
      <View style={styles.empty}>
        <Icon name='users' size={34} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>No passengers yet</Text>
        <Text style={styles.emptyText}>
          Riders within your {p.mddKm} km divergence can request this trip.
        </Text>
        {!!p.message && <Text style={styles.message}>{p.message}</Text>}
      </View>
      <View style={styles.divider} />
      {startCancel}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    empty: { alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 16 },
    emptyTitle: { fontFamily: fonts.titleSemibold, fontSize: 22, color: c.text, marginTop: 4 },
    emptyText: {
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
      textAlign: 'center',
    },
    message: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary, marginTop: 6 },
    divider: { height: 1, backgroundColor: c.border, marginBottom: 16 },
    row: { flexDirection: 'row', gap: 12, marginTop: 8 },
    button: { flex: 1, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontFamily: fonts.semibold, fontSize: 17 },
    link: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.brand,
      textAlign: 'center',
      marginTop: 14,
    },
    personCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.pill,
      borderRadius: 28,
      padding: 10,
      marginBottom: 14,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.titleSemibold, fontSize: 18 },
    personText: { flex: 1 },
    personName: { fontFamily: fonts.semibold, fontSize: 18, color: c.text },
    personSub: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
    details: { gap: 10, marginBottom: 14 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dot: { width: 14, height: 14, borderRadius: 7 },
    detailLabel: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, width: 62 },
    detailText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: c.text },
    note: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.selected,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginTop: 6,
      marginBottom: 6,
    },
    noteWarn: { backgroundColor: c.card },
    noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: c.text },
  });
