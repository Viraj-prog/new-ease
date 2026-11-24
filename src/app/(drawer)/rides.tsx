import MenuButton from '@/components/MenuButton';
import PersonPopup, { type Person } from '@/components/PersonPopup';
import PreviousTripCard from '@/components/PreviousTripCard';
import RideBox from '@/components/RideBox';
import SegmentedToggle, { type ToggleOption } from '@/components/SegmentedToggle';
import { useMyRides } from '@/hooks/useMyRides';
import { useAuth } from '@/lib/auth';
import { avatarSlot } from '@/lib/driverExtras';
import type { PreviousTrip } from '@/lib/previousTrips';
import { isActiveRide, type BookedRide, type RideStatus } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { router, useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotify } from '@/lib/notify';
import InlineNotice from '@/components/InlineNotice';

type RideTab = 'pending' | 'previous' | 'history';
const tabs: ToggleOption<RideTab>[] = [
  { key: 'pending', label: 'Pending', icon: 'calendar' },
  { key: 'previous', label: 'Previous Trips', icon: 'check-circle' },
  { key: 'history', label: 'History', icon: 'clock' },
];
const statusLabels: Record<RideStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function isCurrentBooking(ride: BookedRide) {
  return isActiveRide(ride.rideStatus) && (ride.status === 'accepted' || ride.status === 'pending');
}

function bookingLabel(ride: BookedRide) {
  if (ride.rideStatus === 'cancelled') return 'Cancelled by driver';
  if (ride.status === 'cancelled') return 'Cancelled';
  if (ride.status === 'declined') return 'Declined';
  if (ride.rideStatus === 'completed') return 'Completed';
  if (ride.rideStatus === 'in_progress' && ride.status === 'accepted') return 'In progress';
  return ride.status === 'accepted' ? 'Accepted' : 'Waiting for driver';
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
  const { session, driverMode } = useAuth();
  const { posted, booked, trips, history, loading, error, reload, cancelPosted, cancelBooked } =
    useMyRides(session?.user.id);
  const [tab, setTab] = useState<RideTab>('pending');
  const redoCount = useRef(0);
  const [person, setPerson] = useState<Person | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  // Ask first, then cancel; show the reason if the database refuses.
  function confirmCancel(title: string, message: string, run: () => Promise<string | null>) {
    Alert.alert(title, message, [
      { text: 'Keep ride', style: 'cancel' },
      {
        text: 'Cancel ride',
        style: 'destructive',
        onPress: async () => {
          const problem = await run();
          if (problem) notify({ kind: 'alert', title: 'Could not cancel', subtitle: problem });
        },
      },
    ]);
  }

  const currentBookings = booked.filter(isCurrentBooking);
  const cards = tab === 'previous' ? trips : history;

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

  function renderBooking(ride: BookedRide) {
    return (
      <RideBox
        key={`${ride.requestId}-${ride.rideId}`}
        start={ride.start}
        end={ride.end}
        when={whenText(ride.departAt)}
        badge={bookingLabel(ride)}
        badgeGreen={ride.status === 'accepted' && ride.rideStatus !== 'cancelled'}
        viewLabel='View driver'
        onView={() => setPerson({
          role: 'Driver',
          name: ride.driver.name,
          lines: [ride.driver.rating ? `Rating: ${ride.driver.rating} / 5` : 'No rating yet'],
        })}
        onCancel={isCurrentBooking(ride) ? () =>
          confirmCancel(
            'Cancel this ride?',
            ride.status === 'accepted'
              ? 'Your driver will no longer have you booked.'
              : 'This withdraws your request from every driver you sent it to.',
            () => cancelBooked(ride.requestId),
          ) : undefined}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 40, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>{driverMode ? 'Scheduled Rides' : 'Trips'}</Text>
        <SegmentedToggle textOnly style={styles.tabs} options={tabs} value={tab} onChange={setTab} />

        {loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <>
            {!!error && <InlineNotice message={error} style={styles.error} />}

            {tab !== 'pending' ? (
              cards.length > 0 ? (
                <View style={styles.list}>
                  {cards.map((trip, index) => (
                    <PreviousTripCard
                      key={trip.key}
                      trip={trip}
                      avatarIndex={avatarSlot(index)}
                      onRedo={() => redo(trip)}
                      onFindAnother={trip.reopenedRequestId ? () => router.navigate({
                        pathname: '/',
                        params: { resumeRequest: trip.reopenedRequestId, resumeOffer: trip.reopenedOfferId },
                      }) : undefined}
                    />
                  ))}
                </View>
              ) : !error && (
                <Text style={styles.empty}>
                  {tab === 'previous' ? 'Rides you have finished will show up here.' : 'You have no ride history.'}
                </Text>
              )
            ) : driverMode ? (
                posted.length === 0 ? (
                  <Text style={styles.empty}>You have no pending rides.</Text>
                ) : (
                  <View style={styles.list}>
                    {posted.map((r) => (
                      <RideBox
                        key={r.rideId}
                        start={r.start}
                        end={r.end}
                        when={whenText(r.departAt)}
                        badge={statusLabels[r.status]}
                        badgeGreen={r.status === 'completed' || r.status === 'in_progress'}
                        viewLabel='View requests'
                        onView={() => router.push({
                          pathname: '/ride-requests',
                          params: { rideId: r.rideId },
                        })}
                        onCancel={isActiveRide(r.status) ? () =>
                          confirmCancel(
                            'Cancel this ride?',
                            r.passenger
                              ? 'Accepted passengers will return to searching. This ride will move to History.'
                              : 'This ride will move to History and any pending offers will close.',
                            () => cancelPosted(r.rideId),
                          )
                        : undefined}
                      />
                    ))}
                  </View>
                )
            ) : (
              <>
                <Text style={styles.section}>Booked rides</Text>
                {currentBookings.length > 0
                  ? <View style={styles.list}>{currentBookings.map(renderBooking)}</View>
                  : <Text style={styles.empty}>You have no booked rides.</Text>}
              </>
            )}
          </>
        )}
      </ScrollView>

      <MenuButton onPress={() => navigation.openDrawer()} />

      <PersonPopup person={person} onClose={() => setPerson(null)} />
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
    section: { fontFamily: fonts.semibold, fontSize: 18, color: c.text, marginTop: 24, marginBottom: 10 },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
  });
