import BackButton from '@/components/BackButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import DivergenceModal from '@/components/DivergenceModal';
import HomeSheetContent from '@/components/HomeSheetContent';
import InteractiveMap, { type MapMarker } from '@/components/map';
import MapTitleChip from '@/components/MapTitleChip';
import MenuButton from '@/components/MenuButton';
import PlanForm from '@/components/PlanForm';
import RideStatusPopup from '@/components/RideStatusPopup';
import RoutePreview from '@/components/RoutePreview';
import SearchPill from '@/components/SearchPill';
import ThemeToggle from '@/components/ThemeToggle';
import { DriverCard } from '@/components/TripCards';
import TripNavigation from '@/components/TripNavigation';
import TripSheet, { tripTitle } from '@/components/TripSheet';
import { useDriverFlow } from '@/hooks/useDriverFlow';
import { usePassengerFlow } from '@/hooks/usePassengerFlow';
import { useRoleSwitch } from '@/hooks/useRoleSwitch';
import { useAuth } from '@/lib/auth';
import type { Pt } from '@/lib/geo';
import { pickDateTime } from '@/lib/pickDateTime';
import { errText, resolveDestination, resolveStart } from '@/lib/places';
import { cancelPostedRide, loadPostedRides } from '@/lib/rides';
import { getRoute } from '@/lib/routing';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import BottomSheet, { BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useEffect, useRef, useState } from 'react';
import {
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
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Sheet heights: collapsed, home / route view, a driver's posted trip, and full (planning,
// typing, driver list).
const MID_FRACTION = 0.38;
const TRIP_FRACTION = 0.46;
const SNAP_POINTS = ['23%', `${MID_FRACTION * 100}%`, `${TRIP_FRACTION * 100}%`, '92%'];
const SNAP = { MID: 1, TRIP: 2, FULL: 3 };

// How much farther than the max divergence a driver will go if they approve a request.
// There is no control for it any more, so it stays at this default.
const EXTRA_KM = 2;

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const sheetRef = useRef<BottomSheet>(null);
  const { session } = useAuth();
  const { driverMode, switching, choose } = useRoleSwitch();
  const userId = session?.user.id;

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [when, setWhen] = useState<Date | null>(null); // null = leave now
  const [mdd, setMdd] = useState(2);
  const [mddOpen, setMddOpen] = useState(false);
  // 'home' shows recent / saved trips; 'plan' shows the search form and results.
  const [view, setView] = useState<'home' | 'plan'>('home');

  // Driver side: the cancel confirmation, the booked passenger, and the navigation preview.
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [booked, setBooked] = useState<{ rideId: string; name: string | null } | null>(null);
  const [navigating, setNavigating] = useState(false);

  // Driver: the route shown for a look ("Your route") before the trip is posted.
  const [preview, setPreview] = useState<{
    route: Pt[];
    start: Pt;
    end: Pt;
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMsg, setPreviewMsg] = useState('');

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

  // The search pill straddles the sheet's top edge and the theme toggle sits above it;
  // both follow the sheet as it moves.
  const sheetPosition = useSharedValue(windowHeight * (1 - MID_FRACTION));
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetPosition.get() - 25 }],
  }));
  const toggleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetPosition.get() - 76 }],
  }));

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

  const tripId = driver.trip?.rideId;

  // A freshly posted (or restored) trip gets the taller sheet.
  useEffect(() => {
    if (tripId) sheetRef.current?.snapToIndex(SNAP.TRIP);
  }, [tripId]);

  // Ask the database whether a passenger is booked on this trip.
  function refreshBooked() {
    if (!userId || !tripId) return;
    loadPostedRides(userId)
      .then((rows) => {
        const row = rows.find((r) => r.rideId === tripId);
        setBooked(row?.passenger ? { rideId: tripId, name: row.passenger.name } : null);
      })
      .catch((e) => console.error(e));
  }

  // Check when a trip appears (for example after an app restart with a passenger already booked).
  useEffect(() => {
    refreshBooked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, userId]);

  const bookedNow = booked && booked.rideId === tripId ? booked : null;

  async function onFind() {
    Keyboard.dismiss();
    driver.clear();
    const found = await passenger.search(pickup, destination, when ?? new Date());
    if (found) sheetRef.current?.snapToIndex(SNAP.FULL);
  }

  // Driver: look up both places and draw the route, without posting anything yet.
  async function onPreview() {
    Keyboard.dismiss();
    passenger.clear();
    setPreviewMsg('');
    setPreviewLoading(true);
    try {
      const start = await resolveStart(pickup);
      const end = await resolveDestination(destination);
      if (!end) {
        setPreviewMsg('Enter a destination.');
        return;
      }
      if (!start) {
        setPreviewMsg('Could not find your starting point. Try adding the city, or allow location.');
        return;
      }
      const r = await getRoute([start, end]);
      if (!r) {
        setPreviewMsg('No road route found between those places.');
        return;
      }
      setPreview({ route: r.points, start, end, distanceKm: r.distanceKm, durationMin: r.durationMin });
      sheetRef.current?.snapToIndex(SNAP.TRIP);
    } catch (e) {
      console.error(e);
      setPreviewMsg(errText(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  // Post the trip being previewed. The preview goes away once it is posted.
  async function onPost() {
    Keyboard.dismiss();
    passenger.clear();
    const ok = await driver.post(pickup, destination, when ?? new Date(), mdd, EXTRA_KM);
    if (ok) setPreview(null);
  }

  const active = !!driver.trip || passenger.results.length > 0 || !!passenger.msg || !!driver.msg;
  function clearAll() {
    Keyboard.dismiss();
    passenger.clear();
    driver.clear();
    setPreview(null);
    setPreviewMsg('');
    setPickup('');
    setDestination('');
    sheetRef.current?.snapToIndex(SNAP.MID);
  }

  // Previews only exist for drivers, and give way to a posted trip.
  const previewNow = driverMode && !driver.trip ? preview : null;
  const showTrip = !!driver.trip;
  const showPreview = !!previewNow;

  // A posted trip, a route preview or a set of results always shows the plan view.
  const showPlan = view === 'plan' || active || showPreview;

  function openPlan(place?: string) {
    if (place) setDestination(place);
    setView('plan');
    sheetRef.current?.snapToIndex(SNAP.FULL);
  }

  function closePlan() {
    clearAll();
    setView('home');
  }

  // Driver answered a request. After accepting, look up who is booked.
  async function answer(accept: boolean) {
    const req = driver.popup;
    if (!req) return;
    await driver.respond(req, accept);
    if (accept) refreshBooked();
  }

  // "Yes" on the cancel confirmation: remove the trip from rider search.
  async function cancelTrip() {
    if (!driver.trip) return;
    setCancelling(true);
    try {
      await cancelPostedRide(driver.trip.rideId);
      setConfirmCancel(false);
      closePlan();
    } catch (e) {
      console.error(e);
      setConfirmCancel(false);
      Alert.alert('Could not cancel', errText(e));
    } finally {
      setCancelling(false);
    }
  }

  // "End" in the navigation preview finishes the trip.
  async function endTrip() {
    await driver.finish();
    setNavigating(false);
    setView('home');
    setPickup('');
    setDestination('');
    sheetRef.current?.snapToIndex(SNAP.MID);
  }

  // What the map draws: the posted trip, or the driver being looked at.
  const route = driver.trip?.route ?? previewNow?.route ?? passenger.selected?.route ?? [];
  const markers: MapMarker[] = driver.trip
    ? driver.markers.map((m) => ({ ...m, color: colors.pickup }))
    : previewNow
    ? [
        { id: 'start', point: previewNow.start, color: colors.ring },
        { id: 'end', point: previewNow.end, color: colors.brand },
      ]
    : [
        ...(passenger.pickup ? [{ id: 'pickup', point: passenger.pickup, color: colors.brand }] : []),
        ...(passenger.dropoff ? [{ id: 'dropoff', point: passenger.dropoff, color: colors.alert }] : []),
      ];

  const message = driver.msg || passenger.msg;

  return (
    <GestureHandlerRootView style={styles.container}>
      <InteractiveMap
        route={route}
        altRoute={passenger.alt}
        markers={markers}
        // Fit the route into the map area left visible above the sheet.
        padding={{
          top: insets.top + 90,
          right: 40,
          bottom: windowHeight * (showTrip || showPreview ? TRIP_FRACTION : MID_FRACTION) + 20,
          left: 40,
        }}
      />

      {navigating ? (
        <TripNavigation
          destination={destination}
          distanceKm={driver.trip?.distanceKm ?? 0}
          durationMin={driver.trip?.durationMin ?? 0}
          onEnd={endTrip}
        />
      ) : (
        <>
          {/* The plan view dims the map; a posted trip keeps it clear with a title chip on top. */}
          {showPlan && !showTrip && !showPreview && (
            <View pointerEvents='none' style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
          )}
          {showPreview ? (
            <BackButton onPress={() => setPreview(null)} />
          ) : (
            (!showPlan || showTrip) && <MenuButton onPress={() => navigation.openDrawer()} />
          )}
          {showTrip && <MapTitleChip title={tripTitle(driver.popup, bookedNow)} />}
          {showPreview && <MapTitleChip title='Your route' />}

          <BottomSheet
            ref={sheetRef}
            index={1}
            snapPoints={SNAP_POINTS}
            animatedPosition={sheetPosition}
            enableDynamicSizing={false}
            enableOverDrag={false}
            keyboardBehavior='extend'
            animationConfigs={animationConfigs}
            backgroundStyle={{
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              backgroundColor: showPlan ? colors.surface : colors.homeSheet,
              // Thin outline along the sheet's curved top edge.
              borderWidth: 1,
              borderColor: showPlan ? colors.border : colors.homeSheetBorder,
            }}
            // The home sheet has no visible handle; the plan view does.
            handleIndicatorStyle={[styles.handle, !showPlan && styles.handleHidden]}
          >
            <BottomSheetScrollView
              contentContainerStyle={[styles.sheetContent, !showPlan && styles.homeContent]}
              keyboardShouldPersistTaps='handled'
            >
              {!showPlan ? (
                <HomeSheetContent
                  onPickRecent={(place) => openPlan(place)}
                  onSaved={() => navigation.navigate('saved-trips')}
                />
              ) : showTrip && driver.trip ? (
                <TripSheet
                  startText={pickup}
                  endText={destination}
                  mddKm={driver.trip.mdd}
                  request={driver.popup}
                  booked={bookedNow}
                  message={message}
                  onAccept={() => answer(true)}
                  onDecline={() => answer(false)}
                  onNotNow={driver.closePopup}
                  onStart={() => setNavigating(true)}
                  onCancel={() => setConfirmCancel(true)}
                />
              ) : previewNow ? (
                <RoutePreview
                  startText={pickup}
                  endText={destination}
                  when={when}
                  onPickDate={() => pickDateTime(when ?? new Date(), setWhen)}
                  distanceKm={previewNow.distanceKm}
                  durationMin={previewNow.durationMin}
                  maxDivergenceKm={mdd}
                  onMaxDivergence={() => setMddOpen(true)}
                  submitLabel='Post trip'
                  onSubmit={onPost}
                  loading={driver.loading}
                  message={driver.msg}
                />
              ) : (
                <>
                  <PlanForm
                    title={driverMode ? 'Plan your ride' : 'Book your ride'}
                    onBack={closePlan}
                    driverMode={driverMode}
                    switching={switching}
                    onRole={choose}
                    when={when}
                    onPickDate={() => pickDateTime(when ?? new Date(), setWhen)}
                    pickup={pickup}
                    onPickup={setPickup}
                    destination={destination}
                    onDestination={setDestination}
                    onFocusField={() => sheetRef.current?.snapToIndex(SNAP.FULL)}
                    showClear={!!pickup || !!destination || active}
                    onClear={clearAll}
                    maxDivergenceKm={driverMode ? mdd : undefined}
                    onMaxDivergence={driverMode ? () => setMddOpen(true) : undefined}
                    submitLabel={driverMode ? 'Preview route' : 'Find driver'}
                    onSubmit={driverMode ? onPreview : onFind}
                    loading={driverMode ? previewLoading : passenger.loading}
                    onPickRecent={(place) => setDestination(place)}
                    onSaved={() => navigation.navigate('saved-trips')}
                  />

                  {!!(message || previewMsg) && <Text style={styles.message}>{previewMsg || message}</Text>}

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
                              sheetRef.current?.snapToIndex(SNAP.MID);
                            }}
                            onRequest={() => {}}
                          />
                        ))}
                      </View>
                    )
                  )}
                </>
              )}
            </BottomSheetScrollView>
          </BottomSheet>

          {/* Drawn after the sheet so they sit on top of its edge. */}
          {!showPlan && (
            <>
              <Animated.View style={[styles.toggle, toggleStyle]}>
                <ThemeToggle />
              </Animated.View>
              <Animated.View style={[styles.pill, pillStyle]}>
                <SearchPill onPress={() => openPlan()} />
              </Animated.View>
            </>
          )}
        </>
      )}

      {/* Passenger: spinner while waiting for the driver, then accepted or declined. */}
      <RideStatusPopup
        confirming={passenger.confirming}
        notice={passenger.notice}
        onCancel={passenger.cancel}
        onClose={passenger.closeNotice}
      />

      <ConfirmDialog
        visible={confirmCancel}
        title='Are you sure?'
        message={
          bookedNow
            ? 'Your booked passenger will lose this ride, and your trip will be cancelled and removed from rider search.'
            : 'Your posted trip will be cancelled and removed from rider search.'
        }
        busy={cancelling}
        onYes={cancelTrip}
        onNo={() => setConfirmCancel(false)}
      />

      <DivergenceModal
        visible={mddOpen}
        value={mdd}
        onSave={(km) => {
          setMdd(km);
          setMddOpen(false);
        }}
        onClose={() => setMddOpen(false)}
      />
    </GestureHandlerRootView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: c.handle,
    },
    handleHidden: { opacity: 0 },
    sheetContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    // Room for the pill that overlaps the top of the sheet.
    homeContent: { paddingTop: 21 },
    toggle: { position: 'absolute', top: 0, right: 16 },
    pill: { position: 'absolute', top: 0, left: 16, right: 16 },
    message: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary, marginTop: 8 },
    list: { gap: 10, marginTop: 10 },
    link: { fontFamily: fonts.semibold, color: c.brand, marginTop: 12 },
  });
