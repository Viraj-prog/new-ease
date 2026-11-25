import PressButton from '@/components/PressButton';
import { useAuth } from '@/lib/auth';
import { buildGoogleMapsLegs } from '@/lib/googleMapsRoute';
import { useNotify } from '@/lib/notify';
import { errText } from '@/lib/places';
import { finishTrip, loadDriverTrip, startTrip, type RideStatus } from '@/lib/rides';
import { secureStorage } from '@/lib/secureStorage';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

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

async function loadDirections(rideId: string, driverId: string, storageKey: string) {
  const trip = await loadDriverTrip(rideId, driverId);
  if (trip?.status !== 'in_progress') throw new Error('This trip is no longer in progress.');
  const legs = buildGoogleMapsLegs(trip.start, trip.destination, trip.plan?.stops ?? []);
  const savedIndex = Number(await secureStorage.getItem(storageKey));
  const index = Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < legs.length ? savedIndex : 0;
  return { legs, index };
}

export default function TripLifecycleActions({ rideId, status, disabled, departAt, large, onChanged }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { colors } = useTheme();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ index: number; count: number } | null>(null);
  const storageKey = `tripNavigation.${userId}.${rideId}`;
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

  useFocusEffect(useCallback(() => {
    if (!userId || status !== 'in_progress') return;
    let active = true;
    loadDirections(rideId, userId, storageKey).then(({ index, legs }) => {
      if (active) setProgress({ index, count: legs.length });
    }).catch(() => {
      // Resume can retry and surface the error when the driver asks for directions.
    });
    return () => { active = false; };
  }, [rideId, status, storageKey, userId]));

  async function openDirections(action: 'start' | 'resume' | 'next') {
    if (!userId || busy || disabled) return;
    setBusy(true);
    let started = status === 'in_progress';
    try {
      if (action === 'start') {
        await startTrip(userId, rideId);
        started = true;
        onChanged('in_progress');
      }
      const { legs, index: saved } = await loadDirections(rideId, userId, storageKey);
      const index = action === 'next' ? Math.min(saved + 1, legs.length - 1) : saved;
      // Save before handing off to Maps, which can immediately background this app.
      await secureStorage.setItem(storageKey, String(index));
      setProgress({ index, count: legs.length });
      await Linking.openURL(legs[index]);
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
      await secureStorage.removeItem(storageKey).catch(() => {});
      notify({ kind: 'success', title: 'Trip finished' });
    } catch (error) {
      notify({ kind: 'alert', title: 'Could not finish trip', subtitle: errText(error) });
    } finally {
      setBusy(false);
    }
  }

  function confirmFinish() {
    Alert.alert('Finish this trip?', 'The ride will move to Previous Trips and History.', [
      { text: 'Keep driving', style: 'cancel' },
      { text: 'Finish trip', onPress: () => void finish() },
    ]);
  }

  function confirmNextLeg() {
    Alert.alert('Open the next leg?', 'Continue after you reach the end of the current leg.', [
      { text: 'Keep current leg', style: 'cancel' },
      { text: 'Next leg', onPress: () => void openDirections('next') },
    ]);
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
      {progress && progress.count > 1 && (
        <Text style={[styles.progress, { color: colors.textSecondary }]}>
          Leg {progress.index + 1} of {progress.count}
        </Text>
      )}
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
          onPress={confirmFinish}
        >
          <Text style={[styles.label, { color: colors.onSuccess }]}>Finish trip</Text>
        </PressButton>
      </View>
      {progress && progress.index + 1 < progress.count && (
        <PressButton ghost disabled={unavailable} style={button} onPress={confirmNextLeg}>
          <Text style={[styles.label, { color: colors.brand }]}>Next leg</Text>
        </PressButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexGrow: 1, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  button: { flexGrow: 1, borderRadius: 14, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  largeButton: { minHeight: 54, borderRadius: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
  progress: { fontFamily: fonts.medium, fontSize: 13 },
  hint: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
});
