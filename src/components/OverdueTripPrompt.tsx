import PopupShell from '@/components/PopupShell';
import PressButton from '@/components/PressButton';
import TripLifecycleActions from '@/components/TripLifecycleActions';
import { useNotify } from '@/lib/notify';
import { errText } from '@/lib/places';
import { cancelPostedRide, loadOverdueRide, type OverdueRide } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

const CHECK_MS = 60000;

// Asks a driver about a ride that is well past its time: one never started (start or cancel it),
// or one still marked as under way (finish it). Without this such a ride stays open for good.
export default function OverdueTripPrompt({ userId }: { userId: string | undefined }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const notify = useNotify();
  const [ride, setRide] = useState<OverdueRide | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Rides answered with "Later": not asked about again until the app is reopened.
  const skipped = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    const driverId = userId;
    let stopped = false;

    async function check() {
      if (AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      try {
        const found = await loadOverdueRide(driverId, skipped.current);
        if (!stopped) setRide(found);
      } catch (e) {
        console.warn('Could not check for overdue rides', e);
      }
    }

    void check();
    const timer = setInterval(check, CHECK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [userId]);

  function later() {
    if (ride) skipped.current.add(ride.rideId);
    setRide(null);
  }

  async function cancel() {
    if (!ride) return;
    setCancelling(true);
    try {
      await cancelPostedRide(ride.rideId);
      later();
      notify({ kind: 'success', title: 'Ride cancelled' });
    } catch (e) {
      console.error(e);
      later();
      notify({ kind: 'alert', title: 'Could not cancel', subtitle: errText(e) });
    } finally {
      setCancelling(false);
    }
  }

  if (!ride) return null;
  const started = ride.status === 'in_progress';
  const when = new Date(ride.departAt).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <PopupShell visible onClose={cancelling ? undefined : later} tapOutside={false} style={styles.card}>
      <Text style={styles.title}>{started ? 'Still driving?' : 'Ride not started'}</Text>
      <Text style={styles.message}>
        {started
          ? `Your ride to ${ride.destination} from ${when} is still under way. Finish it if you have arrived.`
          : `Your ride to ${ride.destination} was set for ${when}. Start it, or cancel it so riders can find another driver.`}
      </Text>
      <View style={styles.actions}>
        <TripLifecycleActions
          key={ride.rideId}
          large
          rideId={ride.rideId}
          status={ride.status}
          departAt={ride.departAt}
          disabled={cancelling}
          onChanged={later}
        />
      </View>
      {!started && (
        <PressButton style={styles.cancel} onPress={cancel} disabled={cancelling}>
          {cancelling
            ? <ActivityIndicator color={colors.onAlert} />
            : <Text style={styles.cancelText}>Cancel ride</Text>}
        </PressButton>
      )}
      <PressButton ghost style={styles.later} onPress={later} disabled={cancelling}>
        <Text style={styles.laterText}>Later</Text>
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
    actions: { marginTop: 6 },
    cancel: { height: 54, borderRadius: 18, backgroundColor: c.alert, alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onAlert },
    later: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 14 },
    laterText: { fontFamily: fonts.semibold, fontSize: 15, color: c.textSecondary },
  });
