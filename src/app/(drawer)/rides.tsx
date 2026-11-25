import ConfirmDialog from '@/components/ConfirmDialog';
import InlineNotice from '@/components/InlineNotice';
import MenuButton from '@/components/MenuButton';
import PendingCard from '@/components/PendingCard';
import PersonPopup, { type Person } from '@/components/PersonPopup';
import SegmentedToggle, { type ToggleOption } from '@/components/SegmentedToggle';
import TripHistory from '@/components/TripHistory';
import TripLifecycleActions from '@/components/TripLifecycleActions';
import { useMyRides } from '@/hooks/useMyRides';
import { useAuth } from '@/lib/auth';
import { isExpired } from '@/lib/expiry';
import { useNotify } from '@/lib/notify';
import type { PreviousTrip } from '@/lib/previousTrips';
import { isActiveRide, type BookedRide, type OpenSearch, type PostedRide } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { router, useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RideTab = 'pending' | 'history';
type Confirm = { title: string; message: string; run: () => Promise<string | null> };
const tabs: ToggleOption<RideTab>[] = [
  { key: 'pending', label: 'Pending', icon: 'calendar' },
  { key: 'history', label: 'History', icon: 'clock' },
];
function isCurrentBooking(ride: BookedRide) {
  return ride.status === 'accepted' && isActiveRide(ride.rideStatus)
    || ride.status === 'pending' && ride.rideStatus === 'scheduled' && !isExpired(ride.departAt);
}

function whenText(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RidesScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const { session } = useAuth();
  const [tab, setTab] = useState<RideTab>('pending');
  const { posted, booked, searches, history, loading, error, reload, cancelPosted, cancelBooked } =
    useMyRides(session?.user.id, tab === 'pending');
  const redoCount = useRef(0);
  const [person, setPerson] = useState<Person | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The cancellation waiting for a Yes, if any.
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  // Cancel what was confirmed; show the reason if the database refuses.
  async function runConfirmed() {
    if (!confirm) return;
    setCancelling(true);
    const problem = await confirm.run();
    setCancelling(false);
    setConfirm(null);
    if (problem) notify({ kind: 'alert', title: 'Could not cancel', subtitle: problem });
  }

  // A ride may have ended since the screen loaded, so History is read again when it is opened.
  function openTab(next: RideTab) {
    setTab(next);
    if (next === 'history') void reload();
  }

  function redo(trip: PreviousTrip) {
    router.navigate({
      pathname: '/',
      params: {
        redo: `scheduled-${++redoCount.current}`,
        from: /^current location$/i.test(trip.start.trim()) ? '' : trip.start,
        to: trip.end,
        role: trip.role,
      },
    });
  }

  // The driver cancelled: go Home and carry on with the same search.
  function findAnother(trip: PreviousTrip) {
    router.navigate({
      pathname: '/',
      params: { resumeRequest: trip.reopenedRequestId, resumeOffer: trip.reopenedOfferId },
    });
  }

  // A ride the user is driving.
  function drivingCard(r: PostedRide) {
    const names = r.passengers.map((p) => p.name).join(', ');
    return (
      <PendingCard
        key={r.rideId}
        role='driver'
        status={r.status === 'in_progress' ? 'in_progress' : r.passengers.length ? 'booked' : 'scheduled'}
        title={r.end}
        from={r.start}
        note={names ? `With ${names}` : null}
        when={whenText(r.departAt)}
        actions={[
          {
            label: 'View requests',
            kind: 'main',
            onPress: () => router.push({ pathname: '/ride-requests', params: { rideId: r.rideId } }),
          },
          ...(r.status === 'scheduled' ? [{
            label: 'Cancel ride',
            kind: 'danger' as const,
            onPress: () => setConfirm({
              title: 'Cancel this ride?',
              message: r.passengers.length
                ? 'Accepted passengers will return to searching. This ride will move to History.'
                : 'This ride will move to History and any pending offers will close.',
              run: () => cancelPosted(r.rideId),
            }),
          }] : []),
        ]}
      >
        <TripLifecycleActions
          rideId={r.rideId}
          status={r.status}
          departAt={r.departAt}
          onChanged={(status) => {
            if (status === 'completed') setTab('history');
            void reload();
          }}
        />
      </PendingCard>
    );
  }

  // A ride the user has booked, or asked for.
  function ridingCard(ride: BookedRide) {
    const accepted = ride.status === 'accepted';
    return (
      <PendingCard
        key={`${ride.requestId}-${ride.rideId}`}
        role='rider'
        status={!accepted ? 'waiting' : ride.rideStatus === 'in_progress' ? 'in_progress' : 'booked'}
        title={ride.end}
        from={ride.start}
        note={`Driver: ${ride.driver.name}`}
        when={whenText(ride.departAt)}
        actions={[
          {
            label: 'View driver',
            kind: 'quiet',
            onPress: () => setPerson({
              role: 'Driver',
              name: ride.driver.name,
              lines: [ride.driver.rating ? `Rating: ${ride.driver.rating} / 5` : 'No rating yet'],
            }),
          },
          ...(ride.rideStatus === 'scheduled' ? [{
            label: 'Cancel ride',
            kind: 'danger' as const,
            onPress: () => setConfirm({
              title: 'Cancel this ride?',
              message: accepted
                ? 'Your driver will no longer have you booked.'
                : 'This withdraws your request from every driver you sent it to.',
              run: () => cancelBooked(ride.requestId),
            }),
          }] : []),
        ]}
      />
    );
  }

  // A search that no driver has been asked to take.
  function searchCard(search: OpenSearch) {
    return (
      <PendingCard
        key={search.requestId}
        role='rider'
        status='searching'
        title={search.destination ?? 'Your search'}
        when={whenText(search.departAt)}
        actions={[
          {
            label: 'Find drivers',
            kind: 'main',
            onPress: () => router.navigate({ pathname: '/', params: { resumeRequest: search.requestId } }),
          },
          {
            label: 'Cancel search',
            kind: 'danger',
            onPress: () => setConfirm({
              title: 'Cancel this search?',
              message: 'Drivers will no longer see you or be able to book you.',
              run: () => cancelBooked(search.requestId),
            }),
          },
        ]}
      />
    );
  }

  const currentBookings = booked.filter(isCurrentBooking);
  // Everything coming up, driving and riding together: trips under way first, then by time.
  const pending: { live: boolean; at: string; card: ReactElement }[] = [
    ...posted.map((r) => ({ live: r.status === 'in_progress', at: r.departAt ?? '', card: drivingCard(r) })),
    ...currentBookings.map((r) => ({
      live: r.status === 'accepted' && r.rideStatus === 'in_progress',
      at: r.departAt ?? '',
      card: ridingCard(r),
    })),
    ...searches.map((s) => ({ live: false, at: s.departAt ?? '', card: searchCard(s) })),
  ].sort((a, b) => Number(b.live) - Number(a.live) || a.at.localeCompare(b.at));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 40, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Scheduled Trips</Text>
        <SegmentedToggle textOnly style={styles.tabs} options={tabs} value={tab} onChange={openTab} />

        {loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <>
            {!!error && <InlineNotice message={error} style={styles.error} />}

            {tab === 'history' ? (
              history.length > 0 ? (
                <TripHistory trips={history} onRedo={redo} onFindAnother={findAnother} />
              ) : !error && (
                <Text style={styles.empty}>Finished and cancelled rides will show up here.</Text>
              )
            ) : pending.length > 0 ? (
              <View style={styles.list}>{pending.map((item) => item.card)}</View>
            ) : !error && (
              <Text style={styles.empty}>You have no upcoming trips.</Text>
            )}
          </>
        )}
      </ScrollView>

      <MenuButton onPress={() => navigation.openDrawer()} />

      <PersonPopup person={person} onClose={() => setPerson(null)} />
      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        busy={cancelling}
        onYes={runConfirmed}
        onNo={() => setConfirm(null)}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    list: { gap: 14 },
    error: { marginTop: 10 },
    loading: { marginTop: 40 },
    title: { fontFamily: fonts.titleSemibold, fontSize: 32, color: c.text },
    tabs: { marginVertical: 16 },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
  });
