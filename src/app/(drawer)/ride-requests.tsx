import BackButton from '@/components/BackButton';
import InlineNotice from '@/components/InlineNotice';
import PressButton from '@/components/PressButton';
import InteractiveMap from '@/components/map';
import { PlannedRouteSummary } from '@/components/RoutePreview';
import { useAuth } from '@/lib/auth';
import { useDriverRequestEstimates } from '@/hooks/useDriverRequestEstimates';
import { formatDriverFare, formatExtraDistance } from '@/lib/driverExtras';
import { useNotify } from '@/lib/notify';
import { errText } from '@/lib/places';
import { acceptPlannedRequest, declineRequest, loadDriverRideState, loadDriverTrip, type DriverRideState, type Req } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useDrawerStatus } from 'expo-router/drawer';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RideRequestsScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const drawerStatus = useDrawerStatus();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const [rideState, setRideState] = useState<DriverRideState | null>(null);
  const [decisionError, setDecisionError] = useState<{ message: string; retry?: Req } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const focused = useIsFocused();
  const current = rideState?.trip.rideId === rideId ? rideState : null;
  const estimates = useDriverRequestEstimates(current, focused && !busy);
  const plan = current?.trip.plan;
  const requests = current?.requests ?? [];
  const loadRevision = useRef(0);

  const backToRides = useCallback(() => router.navigate('/rides'), []);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerStatus === 'open') return false;
      backToRides();
      return true;
    });
    return () => subscription.remove();
  }, [backToRides, drawerStatus]));

  const reload = useCallback(async () => {
    const revision = ++loadRevision.current;
    try {
      const trip = rideId && userId ? await loadDriverTrip(rideId, userId) : null;
      if (!trip || !userId) throw new Error('This scheduled ride is no longer available.');
      const next = await loadDriverRideState(trip, userId);
      if (revision !== loadRevision.current) return;
      setRideState(next);
      setError('');
    } catch (e) {
      if (revision !== loadRevision.current) return;
      setError(errText(e));
    } finally {
      if (revision === loadRevision.current) setLoading(false);
    }
  }, [rideId, userId]);

  useFocusEffect(useCallback(() => {
    void reload();
    const timer = setInterval(reload, 10000);
    return () => {
      clearInterval(timer);
      loadRevision.current += 1;
    };
  }, [reload]));

  const respond = useCallback(async (request: Req, accept: boolean) => {
    if (!rideId || !userId || busy) return;
    setBusy(true);
    setDecisionError(null);
    try {
      if (accept) {
        const result = await acceptPlannedRequest(userId, rideId, request.id);
        if (result.kind !== 'accepted') {
          setDecisionError({ message: result.message, retry: result.kind === 'retry' ? request : undefined });
          return;
        }
        setRideState((state) => state?.trip.rideId === result.trip.rideId
          ? { ...state, trip: result.trip } : state);
      } else {
        await declineRequest(rideId, request.id);
      }
      notify({ kind: 'success', title: accept ? 'Passenger accepted' : 'Request declined' });
    } catch (e) {
      setDecisionError({ message: errText(e) });
    } finally {
      await reload();
      setBusy(false);
    }
  }, [busy, notify, reload, rideId, userId]);

  async function refresh() {
    setRefreshing(true);
    estimates.retryChecks();
    await reload();
    setRefreshing(false);
  }

  const groups = [
    { label: 'Requests for this ride', status: 'pending', empty: 'No pending requests.' },
    { label: 'Nearby riders', status: 'open', empty: 'No nearby riders are searching.' },
    { label: 'Accepted passengers', status: 'accepted', empty: 'No passengers accepted yet.' },
  ];
  const retryPassenger = decisionError?.retry;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={styles.title}>Ride requests</Text>
        {loading && <ActivityIndicator color={colors.brand} />}
        {!!error && <InlineNotice message={error} />}
        {current?.planError && <InlineNotice message={current.planError} onRetry={() => void reload()} />}
        {decisionError && (
          <InlineNotice
            message={decisionError.message}
            onRetry={retryPassenger && !busy ? () => void respond(retryPassenger, true) : undefined}
          />
        )}
        {plan && (
          <View>
            <View style={styles.map}>
              <InteractiveMap
                route={plan.points}
                plannedStops={plan.stops}
                padding={{ top: 28, right: 28, bottom: 28, left: 28 }}
              />
            </View>
            <PlannedRouteSummary plan={plan} />
          </View>
        )}
        {!loading && !error && groups.filter((group) =>
          current?.trip.status === 'scheduled' || group.status === 'accepted',
        ).map((group) => {
          const all = requests.filter((request) => request.status === group.status);
          const rows = group.status === 'accepted' ? all : all.filter((request) => estimates.visibleIds.has(request.id));
          return (
            <View style={styles.group} key={group.status}>
              <Text style={styles.heading}>{group.label}</Text>
              {!rows.length && <Text style={styles.detail}>{all.length ? 'More requests can be checked below.' : group.empty}</Text>}
              {rows.map((request) => {
                const pickup = plan?.stops.findIndex((stop) => stop.requestId === request.id && stop.type === 'pickup') ?? -1;
                const dropoff = plan?.stops.findIndex((stop) => stop.requestId === request.id && stop.type === 'dropoff') ?? -1;
                const estimate = request.status === 'accepted' ? undefined : estimates.getEstimate(request);
                return (
                  <View style={styles.card} key={request.id}>
                    <View style={styles.row}>
                      <Text style={styles.name}>{request.passengerName ?? 'A passenger'}</Text>
                      <Text style={styles.detail}>{formatDriverFare(request.fare)}</Text>
                    </View>
                    <Text style={styles.detail}>
                      {request.status === 'accepted' && pickup >= 0 && dropoff >= 0
                        ? `Pickup ${pickup + 1} · Drop-off ${dropoff + 1}`
                        : `Pickup ${request.pickupKm.toFixed(1)} km away · Drop-off ${request.dropoffKm.toFixed(1)} km away`}
                    </Text>
                    {request.status !== 'accepted' && (
                      estimate?.kind === 'available'
                        ? <Text style={styles.detail}>{formatExtraDistance(estimate.extraKm)}</Text>
                        : estimate
                          ? <InlineNotice
                              message={estimate.message}
                              onRetry={estimate.kind === 'retry' ? estimates.retryChecks : undefined}
                            />
                          : <Text style={styles.detail}>
                              {current?.planError ? 'Waiting for an updated pickup plan.' : 'Checking route…'}
                            </Text>
                    )}
                    {request.status !== 'accepted' && (
                      <View style={styles.row}>
                        {request.status === 'pending' && (
                          <PressButton ghost disabled={busy} style={styles.button} onPress={() => respond(request, false)}>
                            <Text style={styles.decline}>Decline</Text>
                          </PressButton>
                        )}
                        <PressButton
                          disabled={busy || estimate?.kind === 'blocked' || current?.trip.status !== 'scheduled'}
                          style={[styles.button, styles.accept]}
                          onPress={() => respond(request, true)}
                        >
                          <Text style={styles.acceptText}>{busy ? 'Working…' : 'Accept'}</Text>
                        </PressButton>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
        {!error && estimates.hasMore && (
          <PressButton ghost style={styles.more} disabled={estimates.checking || !!current?.planError} onPress={estimates.checkMore}>
            <Text style={styles.moreText}>{estimates.checking ? 'Checking requests…' : 'Check more requests'}</Text>
          </PressButton>
        )}
      </ScrollView>
      <BackButton onPress={backToRides} />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 20, gap: 18 },
  title: { fontFamily: fonts.titleSemibold, fontSize: 30, color: c.text },
  map: { height: 240, borderRadius: 18, overflow: 'hidden' },
  group: { gap: 10 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: c.text },
  card: { gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: c.text },
  detail: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
  button: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  decline: { fontFamily: fonts.semibold, color: c.alertText },
  accept: { backgroundColor: c.brand },
  acceptText: { fontFamily: fonts.semibold, color: c.onBrand },
  more: { alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  moreText: { fontFamily: fonts.semibold, color: c.brand },
});
