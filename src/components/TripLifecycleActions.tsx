import ConfirmDialog from '@/components/ConfirmDialog';
import PressButton from '@/components/PressButton';
import { useAuth } from '@/lib/auth';
import { buildGoogleMapsLegs } from '@/lib/googleMapsRoute';
import { useNotify } from '@/lib/notify';
import { errText } from '@/lib/places';
import { finishTrip, loadDriverTrip, startTrip, type RideStatus } from '@/lib/rides';
import { bookedStops, loadStopProgress } from '@/lib/stopProgress';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  rideId: string;
  status: RideStatus;
  disabled?: boolean;
  // When the ride leaves. Start trip stays off until then. The check is in the app only: the
  // database does not refuse an early start.
  departAt?: Date | string | null;
  // Taller buttons, to match the ones beside them in the Home trip sheet.
  large?: boolean;
  onChanged: (status: 'in_progress' | 'completed') => void;
};

// Directions through the stops still to do. Google Maps takes a few stops at a time, so this is
// the next stretch; marking stops done moves it along.
async function loadDirections(rideId: string, driverId: string, resuming: boolean) {
  const trip = await loadDriverTrip(rideId, driverId);
  if (trip?.status !== 'in_progress') throw new Error('This trip is no longer in progress.');
  const remaining = bookedStops(trip.plan?.stops ?? [], await loadStopProgress(rideId))
    .filter((s) => !s.done)
    .map((s) => s.stop);
  return buildGoogleMapsLegs(trip.start, trip.destination, remaining, resuming)[0];
}

export default function TripLifecycleActions({ rideId, status, disabled, departAt, large, onChanged }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { colors } = useTheme();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  // Asking to finish: how many booked passengers are not marked as dropped off.
  const [unmarked, setUnmarked] = useState<number | null>(null);
  // The clock, so Start trip unlocks by itself when the time comes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'scheduled') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);
  const startsAt = departAt ? new Date(departAt) : null;
  // To the minute: a 3:00 ride can be started from 3:00 on.
  const early = !!startsAt && now < Math.floor(startsAt.getTime() / 60000) * 60000;

  async function openDirections(action: 'start' | 'resume') {
    if (!userId || busy || disabled) return;
    setBusy(true);
    let started = status === 'in_progress';
    try {
      if (action === 'start') {
        await startTrip(userId, rideId);
        started = true;
        onChanged('in_progress');
      }
      await Linking.openURL(await loadDirections(rideId, userId, action === 'resume'));
    } catch (error) {
      notify({
        kind: 'alert',
        title: started ? 'Could not open Google Maps' : 'Could not start trip',
        subtitle: started ? `${errText(error)} Tap Resume to try again.` : errText(error),
      });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!userId || status !== 'in_progress' || busy || disabled) return;
    setBusy(true);
    try {
      await finishTrip(rideId);
      onChanged('completed');
      notify({ kind: 'success', title: 'Trip finished' });
    } catch (error) {
      notify({ kind: 'alert', title: 'Could not finish trip', subtitle: errText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function confirmFinish() {
    // If the marks cannot be read, ask without the count.
    const progress = await loadStopProgress(rideId).catch(() => []);
    setUnmarked(progress.filter((p) => !p.droppedOffAt).length);
  }

  const unavailable = busy || disabled || !userId;
  const button = [styles.button, large && styles.largeButton];
  if (status === 'scheduled') {
    return (
      <View style={styles.actions}>
        <PressButton
          disabled={unavailable || early}
          style={[button, { backgroundColor: early ? colors.pill : colors.success }]}
          onPress={() => void openDirections('start')}
        >
          <Text style={[styles.label, { color: early ? colors.textSecondary : colors.onSuccess }]}>
            {busy ? 'Starting…' : 'Start trip'}
          </Text>
        </PressButton>
        {early && startsAt && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Available {startsAt.toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    );
  }
  if (status !== 'in_progress') return null;

  return (
    <View style={styles.actions}>
      <View style={styles.row}>
        <PressButton
          disabled={unavailable}
          style={[button, { backgroundColor: colors.brand }]}
          onPress={() => void openDirections('resume')}
        >
          <Text style={[styles.label, { color: colors.onBrand }]}>Resume</Text>
        </PressButton>
        <PressButton
          disabled={unavailable}
          style={[button, { backgroundColor: colors.success }]}
          onPress={() => void confirmFinish()}
        >
          <Text style={[styles.label, { color: colors.onSuccess }]}>Finish trip</Text>
        </PressButton>
      </View>
      <ConfirmDialog
        visible={unmarked !== null}
        title='Finish this trip?'
        message={unmarked
          ? `${unmarked === 1 ? '1 passenger is' : `${unmarked} passengers are`} not marked as dropped off. Finishing counts them as completed.`
          : 'The ride will move to History.'}
        onYes={() => {
          setUnmarked(null);
          void finish();
        }}
        onNo={() => setUnmarked(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexGrow: 1, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  button: { flexGrow: 1, borderRadius: 22, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  largeButton: { minHeight: 54, borderRadius: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
  hint: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
});
