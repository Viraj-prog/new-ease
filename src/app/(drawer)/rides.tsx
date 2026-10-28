import PersonPopup, { type Person } from '@/components/PersonPopup';
import RideBox from '@/components/RideBox';
import { useMyRides } from '@/hooks/useMyRides';
import { useAuth } from '@/lib/auth';
import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const insets = useSafeAreaInsets();
  const { session, isDriver } = useAuth();
  const { posted, booked, loading, error, reload, cancelPosted, cancelBooked } = useMyRides(
    session?.user.id,
    isDriver,
  );
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
          if (problem) Alert.alert('Could not cancel', problem);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 40, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Rides</Text>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <>
            {!!error && <Text style={styles.error}>{error}</Text>}

            {isDriver && (
              <>
                <Text style={styles.section}>Posted rides</Text>
                {posted.length === 0 ? (
                  <Text style={styles.empty}>You have no posted rides.</Text>
                ) : (
                  <View style={styles.list}>
                    {posted.map((r) => (
                      <RideBox
                        key={r.rideId}
                        start={r.start}
                        end={r.end}
                        when={whenText(r.departAt)}
                        badge={r.passenger ? 'Passenger booked' : 'No passenger yet'}
                        badgeGreen={!!r.passenger}
                        viewLabel={r.passenger ? 'View passenger' : 'No passenger yet'}
                        viewDisabled={!r.passenger}
                        onView={() =>
                          r.passenger && setPerson({ role: 'Passenger', name: r.passenger.name })
                        }
                        onCancel={() =>
                          confirmCancel(
                            'Cancel this ride?',
                            r.passenger
                              ? 'The booked passenger will lose this ride.'
                              : 'This trip will be removed.',
                            () => cancelPosted(r.rideId),
                          )
                        }
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={styles.section}>Booked rides</Text>
            {booked.length === 0 ? (
              <Text style={styles.empty}>You have no booked rides.</Text>
            ) : (
              <View style={styles.list}>
                {booked.map((r) => (
                  <RideBox
                    key={r.requestId}
                    start={r.start}
                    end={r.end}
                    when={whenText(r.departAt)}
                    badge={r.status === 'accepted' ? 'Accepted' : 'Waiting for driver'}
                    badgeGreen={r.status === 'accepted'}
                    viewLabel='View driver'
                    onView={() =>
                      setPerson({
                        role: 'Driver',
                        name: r.driver.name,
                        lines: [
                          r.driver.rating ? `Rating: ${r.driver.rating} / 5` : 'No rating yet',
                        ],
                      })
                    }
                    onCancel={() =>
                      confirmCancel(
                        'Cancel this ride?',
                        r.status === 'accepted'
                          ? 'Your driver will no longer have you booked.'
                          : 'Your request will be withdrawn.',
                        () => cancelBooked(r.requestId),
                      )
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Pressable
        onPress={() => navigation.openDrawer()}
        style={[styles.menu, { top: insets.top + 8 }]}
        hitSlop={8}
      >
        <Image
          source={require('../../../assets/images/menuButton.png')}
          style={styles.menuIcon}
          contentFit='contain'
        />
      </Pressable>

      <PersonPopup person={person} onClose={() => setPerson(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  menu: { position: 'absolute', left: 12 },
  menuIcon: { width: 70, height: 70 },
  title: { fontSize: 32, fontWeight: '700', color: colors.text },
  section: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 24, marginBottom: 10 },
  list: { gap: 14 },
  empty: { fontSize: 14, color: '#777' },
  error: { color: colors.alert, marginTop: 10 },
  loading: { marginTop: 40 },
});
