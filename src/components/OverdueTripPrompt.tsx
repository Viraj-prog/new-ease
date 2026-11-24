import PopupShell from '@/components/PopupShell';
import PressButton from '@/components/PressButton';
import { useNotify } from '@/lib/notify';
import { errText } from '@/lib/places';
import { cancelPostedRide, loadOverdueTrip, startTrip } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { emitTripsChanged } from '@/lib/tripEvents';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

// How long after its time an unstarted trip is asked about.
const OVERDUE_HOURS = 3;

type Overdue = { rideId: string; destination: string; departAt: string };

// Asks a driver to start or cancel a trip that is well past its time and was never started.
export default function OverdueTripPrompt({ userId }: { userId: string | undefined }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const notify = useNotify();
  const [trip, setTrip] = useState<Overdue | null>(null);
  const [busy, setBusy] = useState(false);
  // Trips answered with "Later": not asked about again until the app is reopened.
  const skipped = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    let stopped = false;

    async function check() {
      if (!userId || AppState.currentState !== 'active') return;
      try {
        const before = new Date(Date.now() - OVERDUE_HOURS * 3600 * 1000);
        const found = await loadOverdueTrip(userId, before, skipped.current);
        if (!stopped) setTrip(found);
      } catch (e) {
        console.error(e);
      }
    }

    check();
    const timer = setInterval(check, 60000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId]);

  function later() {
    if (trip) skipped.current.add(trip.rideId);
    setTrip(null);
  }

  async function run(action: 'start' | 'cancel') {
    if (!trip) return;
    const { rideId } = trip;
    setBusy(true);
    try {
      if (action === 'start') {
        await startTrip(rideId);
        router.navigate({ pathname: '/', params: { open: rideId, nav: '1' } });
      } else {
        await cancelPostedRide(rideId);
        emitTripsChanged();
        notify({ kind: 'success', title: 'Trip cancelled', subtitle: 'Booked riders are refunded in full.' });
      }
      skipped.current.add(rideId);
      setTrip(null);
    } catch (e) {
      console.error(e);
      later();
      notify({ kind: 'alert', title: `Could not ${action} the trip`, subtitle: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  const when = trip
    ? new Date(trip.departAt).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <PopupShell visible={!!trip} onClose={busy ? undefined : later} tapOutside={false} style={styles.card}>
      <Text style={styles.title}>Trip not started</Text>
      <Text style={styles.message}>
        Your trip to {trip?.destination} was set for {when}. Start it now, or cancel it? Cancelling refunds
        any booked rider in full.
      </Text>
      {busy ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : (
        <>
          <View style={styles.row}>
            <PressButton style={[styles.button, { backgroundColor: colors.success }]} onPress={() => run('start')}>
              <Text style={[styles.buttonText, { color: colors.onSuccess }]}>Start trip</Text>
            </PressButton>
            <PressButton style={[styles.button, { backgroundColor: colors.alert }]} onPress={() => run('cancel')}>
              <Text style={[styles.buttonText, { color: colors.onAlert }]}>Cancel trip</Text>
            </PressButton>
          </View>
          <PressButton ghost style={styles.later} onPress={later}>
            <Text style={styles.laterText}>Later</Text>
          </PressButton>
        </>
      )}
    </PopupShell>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { borderRadius: 28, padding: 22, gap: 10, alignItems: 'center' },
    title: { fontFamily: fonts.titleSemibold, fontSize: 24, color: c.text, textAlign: 'center' },
    message: {
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 23,
      color: c.textSecondary,
      textAlign: 'center',
    },
    spinner: { marginTop: 12, height: 52 },
    row: { flexDirection: 'row', gap: 12, marginTop: 12, alignSelf: 'stretch' },
    button: { flex: 1, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontFamily: fonts.semibold, fontSize: 17 },
    later: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 14 },
    laterText: { fontFamily: fonts.semibold, fontSize: 15, color: c.textSecondary },
  });
