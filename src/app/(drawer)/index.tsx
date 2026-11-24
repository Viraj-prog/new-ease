import BackButton from '@/components/BackButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import DivergenceModal from '@/components/DivergenceModal';
import DriverList from '@/components/DriverList';
import DriverMatchCard from '@/components/DriverMatchCard';
import LoadingPopup from '@/components/LoadingPopup';
import { avatarSlot } from '@/lib/driverExtras';
import HomeSheetContent from '@/components/HomeSheetContent';
import InteractiveMap, { type MapMarker } from '@/components/map';
import MapTitleChip from '@/components/MapTitleChip';
import MenuButton from '@/components/MenuButton';
import PlanForm from '@/components/PlanForm';
import RideStatusPopup from '@/components/RideStatusPopup';
import RoutePreview from '@/components/RoutePreview';
import SearchPill from '@/components/SearchPill';
import ThemeToggle from '@/components/ThemeToggle';
import TripNavigation from '@/components/TripNavigation';
import TripSheet, { tripTitle } from '@/components/TripSheet';
import { useDriverFlow } from '@/hooks/useDriverFlow';
import { haversineKm } from '@/lib/previousTrips';
import { useSavedTrips } from '@/hooks/useSavedTrips';
import { usePassengerFlow } from '@/hooks/usePassengerFlow';
import { useRoleSwitch } from '@/hooks/useRoleSwitch';
import { useAuth } from '@/lib/auth';
import type { Pt } from '@/lib/geo';
import { pickDate, pickDateTime, pickTime } from '@/lib/pickDateTime';
import { CURRENT_LABEL, errText, isCurrentLabel, resolveDestination, resolveStart } from '@/lib/places';
import { cancelPostedRide, loadPostedRides } from '@/lib/rides';
import { getRoute } from '@/lib/routing';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import BottomSheet, { BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotify } from '@/lib/notify';
import InlineNotice from '@/components/InlineNotice';

// Sheet heights: collapsed, home / route view, a driver's posted trip, and full (planning,
// typing, driver list).
const MID_FRACTION = 0.38;
const TRIP_FRACTION = 0.46;
const SNAP_POINTS = ['23%', `${MID_FRACTION * 100}%`, `${TRIP_FRACTION * 100}%`, '94%'];
const SNAP = { MID: 1, TRIP: 2, FULL: 3 };

// How much farther than the max divergence a driver will go if they approve a request.
// There is no control for it any more, so it stays at this default.

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
  const [pricePerKm, setPricePerKm] = useState<number | null>(null);
  const [mddOpen, setMddOpen] = useState(false);
  // 'home' shows recent / saved trips; 'plan' shows the search form and results.
  const [view, setView] = useState<'home' | 'plan'>('home');
  // The "Getting Trip Ready" popup shown while a recent or saved place is turned into a route.
  const [quickLoading, setQuickLoading] = useState(false);

  // Driver side: the cancel confirmation, the booked passenger, and the navigation preview.
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [booked, setBooked] = useState<{ rideId: string; name: string | null } | null>(null);
  const [navigating, setNavigating] = useState(false);

  // The route shown for a look ("Your route") before a driver posts, or a rider searches.
  const [preview, setPreview] = useState<{
    // Which role it was made for, so a role switch does not leave a stale preview behind.
    driver: boolean;
    route: Pt[];
    start: Pt;
    end: Pt;
    distanceKm: number;
    durationMin: number;
  } | null>(null);

  // Rider: the driver tapped in the "Available drivers" list.
  const [chosenId, setChosenId] = useState<string | null>(null);

  // Rider: "See others" has opened the full list; otherwise only the best match is shown.
  const [listOpen, setListOpen] = useState(false);
  // Notifications (errors and confirmations) are shown by the app-wide banner.
  const notify = useNotify();

  // Home, Work or School was tapped before an address was saved for it.
  function onUnsetSaved(label: string) {
    notify({
      kind: 'alert',
      title: 'No location saved',
      subtitle: `Set your ${label} address in Saved Trips.`,
    });
  }

  // The driver said yes: go Home and say so.
  function onBooked(name: string) {
    setListOpen(false);
    closePlan();
    notify({
      kind: 'success',
      title: 'Trip Successfully Booked!',
      subtitle: name ? `${name} will pick you up soon` : 'Your driver will pick you up soon',
    });
  }

  const passenger = usePassengerFlow(userId, onBooked);
  const driver = useDriverFlow(userId, driverMode);
  const places = useSavedTrips(userId);

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
    transform: [{ translateY: sheetPosition.get() - 84 }],
  }));
  // A message from posting a trip or finding a driver floats just above the sheet's top edge.
  const noticeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetPosition.get() }],
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

  // Rider: look for drivers on the previewed route. The list takes over the screen when found.
  async function onFind() {
    Keyboard.dismiss();
    driver.clear();
    setChosenId(null);
    setListOpen(false);
    // Reuse the start and end the route preview already found.
    const known = preview ? { ...preview, from: preview.start, to: preview.end } : undefined;
    const found = await passenger.search(pickup, destination, when ?? new Date(), known);
    if (found === 'none') {
      notify({ kind: 'alert', title: "No Driver's available.", subtitle: 'Try again Later.' });
    }
  }

  // Look up both places and draw the route, without posting or searching yet.
  const SAME_PLACE = { title: 'Start and end are the same', subtitle: 'Choose a different start or end.' };

  // Returns null once the route is showing, or the notification to show if it could not be drawn.
  async function previewTrip(
    fromText: string,
    toText: string,
    // Which role the preview is for; defaults to the one currently selected.
    asDriver?: boolean,
  ): Promise<{ title: string; subtitle?: string } | null> {
    Keyboard.dismiss();
    passenger.clear();
    // A blank start means "where I am now".
    const usesCurrent = !fromText.trim() || isCurrentLabel(fromText);
    const noCurrent = {
      title: 'Current Location could not be found',
      subtitle: 'Make sure location is turned on.',
    };
    try {
      const start = await resolveStart(fromText);
      const end = await resolveDestination(toText);
      if (!end) {
        return isCurrentLabel(toText) ? noCurrent : { title: 'Enter a destination', subtitle: 'Type where you are going.' };
      }
      if (!start) {
        return usesCurrent ? noCurrent : { title: 'Starting point not found', subtitle: 'Try adding the city.' };
      }
      // Two different names for the same spot count as the same place too.
      if (haversineKm(start, end) < 0.05) return SAME_PLACE;
      const r = await getRoute([start, end]);
      if (!r) return { title: 'No road route found', subtitle: 'Try different places.' };
      setPreview({
        driver: asDriver ?? driverMode,
        route: r.points,
        start,
        end,
        distanceKm: r.distanceKm,
        durationMin: r.durationMin,
      });
      sheetRef.current?.snapToIndex(SNAP.TRIP);
      return null;
    } catch (e) {
      console.warn(e);
      const message = errText(e);
      if (usesCurrent && /location/i.test(message)) return noCurrent;
      return { title: 'Could not open the route', subtitle: message };
    }
  }

  // Check the places first (an empty destination is refused at once, with no spinner), then show
  // the "Getting Trip Ready" popup while the route is looked up. Problems come back as a
  // notification. Returns true once the route preview is showing.
  async function startPreview(fromText: string, toText: string, asDriver?: boolean): Promise<boolean> {
    if (!toText.trim()) {
      Keyboard.dismiss();
      notify({ kind: 'alert', title: 'Enter a destination', subtitle: 'Type where you are going.' });
      return false;
    }
    // A blank Start is "Current location". The same name in both cells is refused at once.
    if ((fromText.trim() || CURRENT_LABEL).toLowerCase() === toText.trim().toLowerCase()) {
      Keyboard.dismiss();
      notify({ kind: 'alert', ...SAME_PLACE });
      return false;
    }
    setQuickLoading(true);
    const problem = await previewTrip(fromText, toText, asDriver);
    setQuickLoading(false);
    if (problem) {
      notify({ kind: 'alert', ...problem });
      return false;
    }
    return true;
  }

  // "Preview route" on the form.
  function onPreview() {
    startPreview(pickup, destination);
  }

  // A recent trip or saved place (Home, Work, School) was tapped on the Home sheet: start from the
  // user's current location, go to that place, and open the route preview. Back from the preview
  // returns to the Book/Plan page with that place as the destination.
  async function onPickRecentTrip(place: string) {
    setPickup('');
    setDestination(place);
    const ok = await startPreview('', place);
    if (ok) {
      setView('plan');
    } else {
      setDestination('');
    }
  }

  // "Redo" on a previous trip: same start and end, in the role the user had on that trip. Shows the
  // loading popup, then the route preview. Back goes to the Plan/Book page, and Back again to Home.
  async function redoTrip(startText: string, endText: string, asDriver: boolean) {
    setPickup(startText);
    setDestination(endText);
    if (asDriver !== driverMode) await choose(asDriver);
    const ok = await startPreview(startText, endText, asDriver);
    if (ok) {
      setView('plan');
    } else {
      setPickup('');
      setDestination('');
    }
  }

  // The Previous Trips tab sends a trip here to redo. It is read once, then cleared.
  const redoParams = useLocalSearchParams<{ redo?: string; from?: string; to?: string; role?: string }>();
  useFocusEffect(
    useCallback(() => {
      if (!redoParams.redo || !redoParams.to) return;
      const { from, to, role } = redoParams;
      router.setParams({ redo: undefined, from: undefined, to: undefined, role: undefined });
      redoTrip(from ?? '', to, role !== 'rider');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [redoParams.redo]),
  );

  // Post the trip being previewed. The preview goes away once it is posted.
  async function onPost() {
    Keyboard.dismiss();
    if (pricePerKm === null) {
      setMddOpen(true);
      return;
    }
    passenger.clear();
    const ok = await driver.post(pickup, destination, when ?? new Date(), mdd, pricePerKm);
    if (ok) setPreview(null);
  }

  const active = !!driver.trip || passenger.results.length > 0 || !!passenger.msg || !!driver.msg;
  // Empty the form and anything it produced, leaving the sheet where it is.
  function clearFields() {
    passenger.clear();
    driver.clear();
    setChosenId(null);
    setPreview(null);
    setPickup('');
    setDestination('');
  }
  // Same, but also closes the keyboard and lowers the sheet (used when leaving the plan view).
  function clearAll() {
    Keyboard.dismiss();
    clearFields();
    sheetRef.current?.snapToIndex(SNAP.MID);
  }

  // Rider: the list of matching drivers replaces everything else.
  const hasResults = !driverMode && passenger.results.length > 0;
  const showResults = hasResults && listOpen;
  // The best match is shown over the preview; "See others" opens the full list.
  const showMatch = hasResults && !listOpen;
  const best = passenger.results[0];
  const previewNow = preview && preview.driver === driverMode && !showResults ? preview : null;
  const showTrip = !!driver.trip && !previewNow;
  const showPreview = !!previewNow;

  // A posted trip, a route preview or a set of results always shows the plan view.
  const showPlan = view === 'plan' || active || showPreview;

  // Back from the driver list returns to the route preview.
  function backToPreview() {
    passenger.clear();
    setChosenId(null);
    setListOpen(false);
  }

  // Confirm on the best match card.
  function confirmBest() {
    if (best) passenger.request(best);
  }

  // Confirm on the driver list: ask the chosen driver. The "Confirming Ride" popup takes over.
  function confirmDriver() {
    const r = passenger.results.find((x) => x.rideId === chosenId);
    if (r) passenger.request(r);
  }

  // Closing the "Ride Accepted" notice ends the booking flow and goes home.
  function closeNotice() {
    const accepted = passenger.notice === 'accepted';
    passenger.closeNotice();
    if (accepted) closePlan();
  }

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
      notify({ kind: 'alert', title: 'Could not cancel', subtitle: errText(e) });
    } finally {
      setCancelling(false);
    }
  }

  // "End" in the navigation preview finishes the trip.
  async function endTrip() {
    const problem = await driver.finish();
    if (problem) {
      // Stay on the navigation screen so the driver can try again.
      notify({ kind: 'alert', title: 'Could not end the trip', subtitle: problem });
      return;
    }
    // Back to the Home screen.
    setNavigating(false);
    closePlan();
    notify({ kind: 'success', title: 'Trip Successfully Ended!' });
  }

  // What the map draws: the posted trip, or the driver being looked at.
  const route = previewNow?.route ?? driver.trip?.route ?? [];
  const markers: MapMarker[] = showTrip
    ? driver.markers.map((m) => ({ ...m, color: colors.pickup }))
    : previewNow
    ? [
        { id: 'start', point: previewNow.start, color: colors.brand },
        { id: 'end', point: previewNow.end, color: colors.alert },
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
      ) : showResults ? (
        <DriverList
          drivers={passenger.results}
          chosenId={chosenId}
          onChoose={setChosenId}
          onBack={() => {
            setChosenId(null);
            setListOpen(false);
          }}
          onConfirm={confirmDriver}
        />
      ) : (
        <>
          {/* The plan view dims the map; a posted trip keeps it clear with a title chip on top. */}
          {showPlan && !showTrip && !showPreview && (
            <View pointerEvents='none' style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
          )}
          {showPreview ? (
            <BackButton
              onPress={() => {
                setPreview(null);
                // Back to the form with the sheet still fully open.
                sheetRef.current?.snapToIndex(SNAP.FULL);
              }}
            />
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
                  recent={places.recent}
                  saved={places.saved}
                  onPickRecent={onPickRecentTrip}
                  onPickSaved={onPickRecentTrip}
                  onUnsetSaved={onUnsetSaved}
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
                  onScheduleAnother={() => {
                    clearFields();
                    setWhen(null);
                    openPlan();
                  }}
                />
              ) : previewNow ? (
                <RoutePreview
                  startText={pickup}
                  endText={destination}
                  when={when}
                  onPickDate={() => pickDate(when ?? new Date(), setWhen)}
                  onPickTime={() => pickTime(when ?? new Date(), setWhen)}
                  distanceKm={previewNow.distanceKm}
                  durationMin={previewNow.durationMin}
                  maxDivergenceKm={driverMode ? mdd : undefined}
                  pricePerKm={driverMode ? pricePerKm : undefined}
                  onMaxDivergence={driverMode ? () => setMddOpen(true) : undefined}
                  submitLabel={driverMode ? 'Schedule Ride' : 'Find driver'}
                  onSubmit={driverMode ? onPost : onFind}
                  loading={driverMode ? driver.loading : passenger.loading}
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
                    driverOptions={driverMode ? { mdd, pricePerKm, onEdit: () => setMddOpen(true) } : undefined}
                    pickup={pickup}
                    onPickup={setPickup}
                    destination={destination}
                    onDestination={setDestination}
                    onFocusField={() => sheetRef.current?.snapToIndex(SNAP.FULL)}
                    onClear={clearFields}
                    submitLabel='Preview route'
                    onSubmit={onPreview}
                    loading={quickLoading}
                    recent={places.recent}
                    saved={places.saved}
                    onUnsetSaved={onUnsetSaved}
                  />

                  {!!message && <InlineNotice message={message} style={styles.message} />}
                </>
              )}
            </BottomSheetScrollView>
          </BottomSheet>

          {/* Best match: dims the screen and floats the card over the route preview. */}
          {showMatch && best && (
            <View style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.scrim,
                  justifyContent: 'flex-end',
                  paddingHorizontal: 20,
                  paddingBottom: windowHeight * 0.3,
                },
              ]}>
              <DriverMatchCard
                driver={best}
                avatarIndex={avatarSlot(Math.max(0, passenger.results.indexOf(best)))}
                hasOthers={passenger.results.length > 1}
                onSeeOthers={() => setListOpen(true)}
                onCancel={backToPreview}
                onConfirm={confirmBest}
              />
            </View>
          )}

          {/* Post trip / Find driver problems: a card above the sheet, outside it. */}
          {showPreview && !!message && !showMatch && (
            <Animated.View pointerEvents='box-none' style={[styles.notice, noticeStyle]}>
              <InlineNotice message={message} style={styles.noticeCard} />
            </Animated.View>
          )}

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
      {/* Looking for drivers after Find driver. */}
      <LoadingPopup visible={quickLoading} title='Getting Trip Ready' />
      <LoadingPopup visible={driverMode && driver.loading} title='Scheduling Ride' />

      <LoadingPopup
        visible={passenger.loading && !driverMode}
        title='Finding drivers'
        subtitle='Matching you with nearby drivers'
      />


      <RideStatusPopup
        driverName={passenger.results.find((x) => x.rideId === passenger.sentTo)?.driverName}
        confirming={passenger.confirming}
        notice={passenger.notice}
        onCancel={passenger.cancel}
        onClose={closeNotice}
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
        pricePerKm={pricePerKm}
        onSave={(km, price) => {
          setMdd(km);
          setPricePerKm(price);
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
    message: { marginTop: 12 },
    // Zero-height row at the sheet's top edge; the card hangs upward from it.
    notice: { position: 'absolute', top: 0, left: 16, right: 16, height: 0 },
    noticeCard: { position: 'absolute', left: 0, right: 0, bottom: 12 },
    list: { gap: 10, marginTop: 10 },
    link: { fontFamily: fonts.semibold, color: c.brand, marginTop: 12 },
  });
