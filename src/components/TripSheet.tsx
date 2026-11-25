import Icon from '@/components/Icon';
import StopsList from '@/components/StopsList';
import type { CandidateEstimate, Req } from '@/lib/rides';
import { formatDriverFare, formatExtraDistance } from '@/lib/driverExtras';
import InlineNotice from '@/components/InlineNotice';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PressButton from '@/components/PressButton';

type Props = {
  startText: string;
  endText: string;
  mddKm: number;
  // A passenger asking for this trip, if one is waiting for an answer.
  request: Req | null;
  // Everyone who has been accepted.
  passengers: { id: string; name: string | null }[];
  // Notices such as "Trip posted: 6.2 km" or an error from answering a request.
  message: string;
  responding?: boolean;
  estimate?: CandidateEstimate;
  canAccept?: boolean;
  onRetryCheck?: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onNotNow: () => void;
  inProgress: boolean;
  lifecycleActions: ReactNode;
  // Trip under way: the stop to do next, and the list of all of them.
  nextStop?: ReactNode;
  stopList?: ReactNode;
  onEndEarly?: () => void;
  onCancel?: () => void;
  onScheduleAnother: () => void;
};

// Which title the map chip above the sheet should show for the current state.
export function tripTitle(request: Req | null, passengerCount: number) {
  if (request) return 'Ride request';
  if (passengerCount > 1) return `${passengerCount} passengers booked`;
  return passengerCount ? 'Passenger booked' : 'Trip posted';
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

  const name = p.request?.passengerName ?? null;
  const avatar = colors.avatars[0];

  const stops = <StopsList start={p.startText} end={p.endText} />;

  if (p.inProgress) {
    return (
      <View>
        {p.nextStop}
        <View style={styles.row}>{p.lifecycleActions}</View>
        {p.stopList ?? null}
        <View style={styles.tripEnds}>{stops}</View>
        {p.onEndEarly && (
          <Pressable onPress={p.onEndEarly} hitSlop={8} accessibilityRole='button'>
            <Text style={[styles.link, { color: colors.alertText }]}>Cancel trip</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const startCancel = (
    <View>
      <View style={styles.row}>
        {/* The same width as Cancel trip, even with a line of text under Start trip. */}
        <View style={styles.half}>{p.lifecycleActions}</View>
        {p.onCancel && (
          <PressButton style={[styles.button, { backgroundColor: colors.alert }]} onPress={p.onCancel}>
            <Text style={[styles.buttonText, { color: colors.onAlert }]}>Cancel trip</Text>
          </PressButton>
        )}
      </View>
      <Pressable onPress={p.onScheduleAnother} hitSlop={8}>
        <Text style={styles.link}>Schedule another ride</Text>
      </Pressable>
    </View>
  );

  // A passenger is asking for this trip.
  if (p.request) {
    const r = p.request;
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

        <View style={styles.note}>
          <Icon name='check-circle' size={22} color={colors.onTint} />
          <Text style={styles.noteText}>
            {`Detour ${worst.toFixed(1)} km · within your ${p.mddKm} km limit`}
          </Text>
        </View>
        <Text style={styles.detailText}>
          {formatDriverFare(r.fare)}
          {p.estimate?.kind === 'available' ? ` · ${formatExtraDistance(p.estimate.extraKm)}` : ''}
        </Text>
        {p.estimate && p.estimate.kind !== 'available' && (
          <InlineNotice message={p.estimate.message} onRetry={p.estimate.kind === 'retry' ? p.onRetryCheck : undefined} />
        )}
        {!p.estimate && <Text style={styles.detailText}>Checking route…</Text>}

        <View style={styles.row}>
          {r.status === 'pending' && (
            <PressButton disabled={p.responding} style={[styles.button, { backgroundColor: colors.alert }]} onPress={p.onDecline}>
              <Text style={[styles.buttonText, { color: colors.onAlert }]}>Decline</Text>
            </PressButton>
          )}
          <PressButton
            disabled={p.responding || p.canAccept === false || p.estimate?.kind === 'blocked'}
            style={[styles.button, { backgroundColor: colors.brand }]}
            onPress={p.onAccept}
          >
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>{p.responding ? 'Working…' : 'Accept'}</Text>
          </PressButton>
        </View>
        <Pressable onPress={p.onNotNow} hitSlop={8}>
          <Text style={styles.link}>Not now</Text>
        </Pressable>
        {startCancel}
      </View>
    );
  }

  // Passengers are booked on this trip.
  if (p.passengers.length) {
    return (
      <View>
        {p.passengers.map((passenger, index) => {
          const colour = colors.avatars[index % colors.avatars.length];
          return (
            <View key={passenger.id} style={styles.personCard}>
              <View style={[styles.avatar, { backgroundColor: colour.bg }]}>
                <Text style={[styles.avatarText, { color: colour.fg }]}>{initialsOf(passenger.name)}</Text>
              </View>
              <View style={styles.personText}>
                <Text style={styles.personName}>{passenger.name ?? 'Your passenger'}</Text>
                <Text style={styles.personSub}>booked on your trip</Text>
              </View>
            </View>
          );
        })}
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
        <Icon name='users' size={24} color={colors.textSecondary} />
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
    empty: { alignItems: 'center', gap: 3, marginTop: 10, marginBottom: 8 },
    emptyTitle: { fontFamily: fonts.titleSemibold, fontSize: 17, color: c.text, marginTop: 2 },
    emptyText: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: c.textSecondary,
      textAlign: 'center',
    },
    message: { fontFamily: fonts.regular, fontSize: 12, color: c.textSecondary, marginTop: 4 },
    divider: { height: 1, backgroundColor: c.border, marginBottom: 10 },
    row: { flexDirection: 'row', gap: 12, marginTop: 8 },
    tripEnds: { marginTop: 12 },
    half: { flex: 1 },
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
    noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: c.text },
  });
