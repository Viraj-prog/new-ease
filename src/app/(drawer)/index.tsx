import InteractiveMap, { type MapMarker } from '@/components/map';
import NumberPopup from '@/components/NumberPopup';
import OptionsMenu, { type Anchor, type MenuItem } from '@/components/OptionsMenu';
import RequestPopup from '@/components/RequestPopup';
import RideStatusPopup from '@/components/RideStatusPopup';
import { DriverCard } from '@/components/TripCards';
import { useDriverFlow } from '@/hooks/useDriverFlow';
import { usePassengerFlow } from '@/hooks/usePassengerFlow';
import { useAuth } from '@/lib/auth';
import { pickDateTime } from '@/lib/pickDateTime';
import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
  useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import { Image, type ImageSource } from 'expo-image';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Collapsed (pill only), medium (route view), full (typing / driver list).
const MID_FRACTION = 0.5;
const SNAP_POINTS = ['23%', `${MID_FRACTION * 100}%`, '85%'];

function ActionButton({
  icon,
  label,
  onPress,
  loading,
}: {
  icon?: ImageSource;
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator size='small' color={colors.brand} />
      ) : (
        icon && <Image source={icon} style={styles.actionIcon} contentFit='contain' />
      )}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const sheetRef = useRef<BottomSheet>(null);
  const { session, driverMode } = useAuth();
  const userId = session?.user.id;

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [when, setWhen] = useState<Date | null>(null); // null = leave now
  const [mdd, setMdd] = useState(2);
  const [extra, setExtra] = useState(2);
  const [popup, setPopup] = useState<'mdd' | 'extra' | null>(null);

  // The three-dots button opens a menu of Schedule / Pick up Range / Extra Drive.
  const dotsRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  function openMenu() {
    dotsRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setMenuOpen(true);
    });
  }

  const menuItems: MenuItem[] = [
    {
      key: 'schedule',
      label: 'Schedule',
      detail: when
        ? when.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : undefined,
      icon: 'calendar-outline',
      onPress: () => pickDateTime(when ?? new Date(), setWhen),
    },
    // Driver-only options are hidden from passengers.
    ...(driverMode
      ? ([
          { key: 'mdd', label: 'Pick up Range', detail: `${mdd} km`, icon: 'locate-outline', onPress: () => setPopup('mdd') },
          { key: 'extra', label: 'Extra Drive', detail: `${extra} km`, icon: 'car-outline', onPress: () => setPopup('extra') },
        ] satisfies MenuItem[])
      : []),
  ];

  const passenger = usePassengerFlow(userId);
  const driver = useDriverFlow(userId, driverMode);

  // Passenger view drops any trip being shown. (Driver view re-checks it when Home opens.)
  useEffect(() => {
    if (!driverMode) driver.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverMode]);

  // Critically damped so releasing the sheet settles without bouncing.
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 80,
    stiffness: 500,
    mass: 1,
    overshootClamping: true,
  });

  useEffect(() => {
    // iOS handles this via Info.plist; Android needs an explicit request.
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location Permission',
      message: 'This app needs access to your location to center the map.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'OK',
    }).catch((err) => console.warn(err));
  }, []);

  async function onFind() {
    Keyboard.dismiss();
    driver.clear();
    const found = await passenger.search(pickup, destination, when ?? new Date());
    if (found) sheetRef.current?.snapToIndex(2);
  }

  async function onPost() {
    Keyboard.dismiss();
    passenger.clear();
    const ok = await driver.post(pickup, destination, when ?? new Date(), mdd, extra);
    if (ok) sheetRef.current?.snapToIndex(1);
  }

  const active = !!driver.trip || passenger.results.length > 0 || !!passenger.msg || !!driver.msg;
  function clearAll() {
    passenger.clear();
    driver.clear();
  }

  // What the map draws: the posted trip, or the driver being looked at.
  const route = driver.trip?.route ?? passenger.selected?.route ?? [];
  const markers: MapMarker[] = driver.trip
    ? driver.markers
    : [
        ...(passenger.pickup ? [{ id: 'pickup', point: passenger.pickup, color: colors.brand }] : []),
        ...(passenger.dropoff ? [{ id: 'dropoff', point: passenger.dropoff, color: '#dc2626' }] : []),
      ];

  const message = driver.msg || passenger.msg;

  return (
    <GestureHandlerRootView style={styles.container}>
      <InteractiveMap
        route={route}
        altRoute={passenger.alt}
        markers={markers}
        // Fit the route into the map area left visible above the sheet at the middle snap point.
        padding={{
          top: insets.top + 90,
          right: 40,
          bottom: windowHeight * MID_FRACTION + 20,
          left: 40,
        }}
      />

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

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        enableOverDrag={false}
        keyboardBehavior='extend'
        animationConfigs={animationConfigs}
        backgroundStyle={{ borderRadius: 40, opacity: 0.95 }}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps='handled'
        >
          <View style={styles.locationCard}>
            <View style={styles.inputRow}>
              <Ionicons name='location-sharp' size={20} color={colors.brand} />
              <BottomSheetTextInput
                style={styles.locationInput}
                placeholder='Current Location'
                placeholderTextColor={colors.primary}
                value={pickup}
                onChangeText={setPickup}
                onFocus={() => sheetRef.current?.snapToIndex(2)}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Ionicons name='flag' size={20} color='#dc2626' />
              <BottomSheetTextInput
                style={styles.locationInput}
                placeholder='Where are you going?'
                placeholderTextColor={colors.textSecondary}
                value={destination}
                onChangeText={setDestination}
                onFocus={() => sheetRef.current?.snapToIndex(2)}
              />
            </View>
          </View>

          {/* Main action in the middle: Find for passengers, Post for drivers. */}
          <View style={styles.actionRow}>
            <View style={styles.actionSide} />
            {driverMode ? (
              <ActionButton
                icon={require('../../../assets/images/PlusIconBlack.png')}
                label='Post'
                onPress={onPost}
                loading={driver.loading}
              />
            ) : (
              <ActionButton
                icon={require('../../../assets/images/SearchIconBlack.png')}
                label='Find'
                onPress={onFind}
                loading={passenger.loading}
              />
            )}
            <View style={[styles.actionSide, styles.actionSideRight]}>
              {driverMode ? (
                // Drivers: three dots open Schedule / Pick up Range / Extra Drive.
                <View ref={dotsRef} collapsable={false}>
                  <Pressable style={styles.roundButton} onPress={openMenu} hitSlop={6}>
                    <Ionicons name='ellipsis-horizontal' size={22} color='#000' />
                  </Pressable>
                </View>
              ) : (
                // Passengers: just the schedule button (filled once a time is chosen).
                <Pressable
                  style={styles.roundButton}
                  onPress={() => pickDateTime(when ?? new Date(), setWhen)}
                  hitSlop={6}
                >
                  <Image
                    source={
                      when
                        ? require('../../../assets/images/CalendarIconSelected.png')
                        : require('../../../assets/images/CalendarIcon.png')
                    }
                    style={when ? styles.calendarSelected : styles.calendarIcon}
                    contentFit='contain'
                  />
                </Pressable>
              )}
            </View>
          </View>

          {!!message && <Text style={styles.message}>{message}</Text>}

          {/* Passenger: matching drivers, or just the one being looked at. */}
          {passenger.selected ? (
            <View style={styles.list}>
              <DriverCard
                item={passenger.selected}
                selected
                extra={passenger.extra}
                sent={passenger.sentTo === passenger.selected.rideId}
                accepted={passenger.accepted && passenger.sentTo === passenger.selected.rideId}
                onSelect={() => {}}
                onRequest={() => passenger.request(passenger.selected!)}
              />
              <Pressable onPress={passenger.back}>
                <Text style={styles.link}>Back to all drivers</Text>
              </Pressable>
            </View>
          ) : (
            passenger.results.length > 0 && (
              <View style={styles.list}>
                {passenger.results.map((r) => (
                  <DriverCard
                    key={r.rideId}
                    item={r}
                    selected={false}
                    extra={null}
                    sent={false}
                    onSelect={() => {
                      passenger.select(r);
                      sheetRef.current?.snapToIndex(1);
                    }}
                    onRequest={() => {}}
                  />
                ))}
              </View>
            )
          )}

          {/* Driver: passengers near the posted route; tap a dot on the map to answer. */}
          {driver.trip && (
            <View style={styles.list}>
              <Text style={styles.message}>
                {driver.requests.length === 0
                  ? 'No passengers near your route yet. This refreshes every 10 seconds.'
                  : `${driver.requests.length} passenger${driver.requests.length === 1 ? '' : 's'} near your route.`}
              </Text>
            </View>
          )}

          {driver.trip ? (
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Finish this trip?',
                  'Any passenger still waiting on it will be declined, and you can post a new trip.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Finish trip', onPress: driver.finish },
                  ],
                )
              }
            >
              <Text style={styles.link}>Finish trip</Text>
            </Pressable>
          ) : (
            active && (
              <Pressable onPress={clearAll}>
                <Text style={styles.link}>Clear</Text>
              </Pressable>
            )
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Passenger: spinner while waiting for the driver, then accepted or declined. */}
      <RideStatusPopup
        confirming={passenger.confirming}
        notice={passenger.notice}
        onCancel={passenger.cancel}
        onClose={passenger.closeNotice}
      />

      {/* Pops up by itself when a passenger asks for this driver's trip. */}
      <RequestPopup
        req={driver.popup}
        trip={driver.trip}
        onRespond={driver.respond}
        onClose={driver.closePopup}
      />

      <OptionsMenu
        visible={menuOpen}
        anchor={anchor}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />

      <NumberPopup
        visible={popup === 'mdd'}
        title='Pickup range'
        hint='How far from your route you will pick up or drop off a passenger without asking.'
        value={mdd}
        unit='km'
        onSave={(n) => {
          setMdd(n);
          setPopup(null);
        }}
        onClose={() => setPopup(null)}
      />
      <NumberPopup
        visible={popup === 'extra'}
        title='Extra drive'
        hint='How much farther than your pickup range you are willing to drive if you approve it.'
        value={extra}
        unit='km'
        onSave={(n) => {
          setExtra(n);
          setPopup(null);
        }}
        onClose={() => setPopup(null)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  handle: {
    width: 60,
    height: 2.5,
    backgroundColor: 'rgba(60, 60, 67, 0.3)',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  locationCard: {
    backgroundColor: '#fafafa',
    marginTop: 8,
    marginBottom: 5,
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#bdbdbd' },
  // Vertical padding leaves room for the buttons' shadows.
  // Equal-width sides keep the main button exactly in the middle.
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  actionSide: { flex: 1 },
  actionSideRight: { alignItems: 'flex-end' },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 1.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fafafa',
    borderRadius: 40,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 1.5,
  },
  actionIcon: { width: 20, height: 20 },
  actionText: { fontSize: 12, fontWeight: '500', color: colors.text },
  calendarIcon: { width: 20, height: 20 },
  // The selected image is already a filled circle, so it fills the whole button.
  calendarSelected: { width: 40, height: 40 },
  message: { fontSize: 13, color: '#3f3f46', marginTop: 8 },
  list: { gap: 10, marginTop: 10 },
  link: { color: '#2563eb', fontWeight: '600', marginTop: 12 },
  menu: { position: 'absolute', left: 12 },
  menuIcon: { width: 70, height: 70 },
});
