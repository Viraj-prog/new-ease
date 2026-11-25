import PopupShell from '@/components/PopupShell';
import PressButton from '@/components/PressButton';
import { stopTitle } from '@/components/TripStops';
import type { Pt } from '@/lib/geo';
import { useNotify } from '@/lib/notify';
import { errText } from '@/lib/places';
import { haversineKm } from '@/lib/previousTrips';
import { finishTrip, loadActiveTrip } from '@/lib/rides';
import { bookedStops, loadPassengerName, loadStopProgress, markStop, type StopMark } from '@/lib/stopProgress';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

// How close to a stop counts as being there.
const ARRIVE_KM = 0.2;
// A position this recent will do; after navigation there normally is one.
const FRESH_MS = 2 * 60 * 1000;

// This must never ask for permission: Android shows that request by pushing the app to the back,
// which would look like the driver returning to it.
async function whereAmI(): Promise<Pt | null> {
  if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
  const position = await Location.getLastKnownPositionAsync({ maxAge: FRESH_MS })
    ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

type Arrival =
  | { rideId: string; kind: 'pickup' | 'dropoff'; requestId: string; name: string }
  | { rideId: string; kind: 'finish' };

// Where the driver is now, if the trip under way has something to do here.
async function findArrival(driverId: string): Promise<Arrival | null> {
  const trip = await loadActiveTrip(driverId);
  if (trip?.status !== 'in_progress') return null;
  const here = await whereAmI();
  if (!here) return null;

  const stops = bookedStops(trip.plan?.stops ?? [], await loadStopProgress(trip.rideId));
  // Only the next stop in the plan: a later one at the same place has its turn after it, so a
  // passenger is not picked up out of order.
  const next = stops.find((s) => !s.done);
  if (next && haversineKm(here, next.stop) <= ARRIVE_KM) {
    const name = await loadPassengerName(next.stop.requestId);
    return { rideId: trip.rideId, kind: next.stop.type, requestId: next.stop.requestId, name };
  }
  return stops.every((s) => s.done) && haversineKm(here, trip.destination) <= ARRIVE_KM
    ? { rideId: trip.rideId, kind: 'finish' }
    : null;
}

// The app is not told when navigation ends, so when a driver comes back to it near a stop, it
// asks whether that stop is done. Location is only read while the app is open.
export default function ArrivalPrompt({ userId }: { userId: string | undefined }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const notify = useNotify();
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [busy, setBusy] = useState(false);
  // Bumped to look again, after a stop is marked.
  const [round, setRound] = useState(0);

  // On opening the app, and each time it comes back to the front.
  useEffect(() => {
    if (!userId) return;
    const driverId = userId;
    let stopped = false;
    let checking = false;
    let away = false;

    async function check() {
      if (checking) return;
      checking = true;
      try {
        const found = await findArrival(driverId);
        if (stopped) return;
        setConfirmNoShow(false);
        setArrival(found);
      } catch (e) {
        console.warn('Could not check for an arrival', e);
      } finally {
        checking = false;
      }
    }

    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') away = true;
      if (state === 'active' && away) {
        away = false;
        void check();
      }
    });
    return () => {
      stopped = true;
      subscription.remove();
    };
  }, [userId, round]);

  async function run(work: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await work();
      setArrival(null);
      // Another stop may be at the same place.
      setRound((n) => n + 1);
    } catch (e) {
      console.error(e);
      setArrival(null);
      notify({ kind: 'alert', title: failure, subtitle: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!arrival) return null;

  function mark(requestId: string, stopMark: StopMark) {
    if (!arrival) return;
    const { rideId } = arrival;
    void run(() => markStop(rideId, requestId, stopMark), 'Could not save the stop');
  }

  function finish(rideId: string) {
    void run(async () => {
      await finishTrip(rideId);
      notify({ kind: 'success', title: 'Trip finished' });
    }, 'Could not finish trip');
  }

  const close = busy ? undefined : () => setArrival(null);
  const button = (label: string, onPress: () => void, colour: string, ink: string) => (
    <PressButton style={[styles.button, { backgroundColor: colour }]} onPress={onPress} disabled={busy}>
      {busy
        ? <ActivityIndicator color={ink} />
        : <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>}
    </PressButton>
  );

  let title: string;
  let message: string;
  if (arrival.kind === 'finish') {
    title = 'Arrived?';
    message = 'You are near your destination. Finish the trip?';
  } else if (confirmNoShow) {
    title = 'No show?';
    message = `${arrival.name}’s booking will be cancelled. This cannot be undone.`;
  } else {
    title = stopTitle(arrival.kind, arrival.name);
    message = arrival.kind === 'pickup'
      ? 'You are near this pickup. Is your passenger in the car?'
      : 'You are near this drop-off. Has your passenger left the car?';
  }

  return (
    <PopupShell visible onClose={close} tapOutside={false} style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {arrival.kind === 'finish' && button('Finish trip', () => finish(arrival.rideId), colors.success, colors.onSuccess)}
        {arrival.kind === 'dropoff' && button('Dropped off', () => mark(arrival.requestId, 'dropped_off'), colors.brand, colors.onBrand)}
        {arrival.kind === 'pickup' && (confirmNoShow
          ? button('Cancel booking', () => mark(arrival.requestId, 'no_show'), colors.alert, colors.onAlert)
          : button('Picked up', () => mark(arrival.requestId, 'picked_up'), colors.brand, colors.onBrand))}
        {arrival.kind === 'pickup' && !confirmNoShow && (
          <PressButton ghost style={[styles.button, styles.quiet]} onPress={() => setConfirmNoShow(true)} disabled={busy}>
            <Text style={[styles.buttonText, { color: colors.text }]}>No show</Text>
          </PressButton>
        )}
      </View>
      <PressButton
        ghost
        style={styles.later}
        onPress={confirmNoShow ? () => setConfirmNoShow(false) : close}
        disabled={busy}
      >
        <Text style={styles.laterText}>{confirmNoShow ? 'Back' : 'Not yet'}</Text>
      </PressButton>
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { borderRadius: 28, padding: 22, gap: 10 },
    title: { fontFamily: fonts.titleSemibold, fontSize: 24, color: c.text, textAlign: 'center' },
    message: {
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 23,
      color: c.textSecondary,
      textAlign: 'center',
    },
    actions: { marginTop: 6, gap: 10 },
    button: { minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontFamily: fonts.semibold, fontSize: 17 },
    quiet: { borderWidth: 1, borderColor: c.handle },
    later: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 14 },
    laterText: { fontFamily: fonts.semibold, fontSize: 15, color: c.textSecondary },
  });
