import MenuButton from '@/components/MenuButton';
import PreviousTripCard from '@/components/PreviousTripCard';
import { useAuth } from '@/lib/auth';
import { errText } from '@/lib/places';
import { loadPreviousTrips, type PreviousTrip } from '@/lib/previousTrips';
import { useTheme } from '@/lib/theme';
import { avatarSlot } from '@/lib/driverExtras';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InlineNotice from '@/components/InlineNotice';

// Finished rides. A ride moves here from the Trips tab once the driver ends it.
export default function PreviousTripsScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [trips, setTrips] = useState<PreviousTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setTrips(await loadPreviousTrips(userId));
      setError('');
    } catch (e) {
      console.warn('Previous trips could not load:', e);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Reload every time the tab is opened.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Gives each Redo its own value so Home notices a repeat of the same trip.
  const redoCount = useRef(0);

  // Open Home on the route preview for this trip's start and end.
  function redo(t: PreviousTrip) {
    // A driver's "Current location" start is a label, not an address to look up.
    const start = /^current location$/i.test(t.start.trim()) ? '' : t.start;
    router.navigate({
      pathname: '/',
      params: { redo: String(++redoCount.current), from: start, to: t.end, role: t.role },
    });
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8 + 46 + 18,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Previous trips</Text>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <>
            {!!error && <InlineNotice message={error} style={styles.error} />}
            {!error && trips.length === 0 && (
              <Text style={styles.empty}>Rides you have finished will show up here.</Text>
            )}
            <View style={styles.list}>
              {trips.map((t, i) => (
                <PreviousTripCard
                  key={t.key}
                  trip={t}
                  avatarIndex={avatarSlot(i)}
                  onRedo={() => redo(t)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <MenuButton onPress={() => navigation.openDrawer()} />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    title: { fontFamily: fonts.titleSemibold, fontSize: 28, color: c.text, marginBottom: 14 },
    list: { gap: 14 },
    loading: { marginTop: 40 },
    error: { marginBottom: 12 },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
  });
