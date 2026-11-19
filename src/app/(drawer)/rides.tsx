import MenuButton from '@/components/MenuButton';
import PersonPopup, { type Person } from '@/components/PersonPopup';
import RideBox from '@/components/RideBox';
import { useMyRides } from '@/hooks/useMyRides';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useState } from 'react';
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

      <MenuButton onPress={() => navigation.openDrawer()} />

      <PersonPopup person={person} onClose={() => setPerson(null)} />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    list: { gap: 14 },
    error: { color: c.alertText, marginTop: 10 },
    loading: { marginTop: 40 },
    title: { fontFamily: fonts.titleSemibold, fontSize: 32, color: c.text },
    section: { fontFamily: fonts.semibold, fontSize: 18, color: c.text, marginTop: 24, marginBottom: 10 },
    empty: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
  });
