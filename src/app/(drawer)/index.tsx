import BackButton from '@/components/BackButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import DivergenceModal from '@/components/DivergenceModal';
import DriverList from '@/components/DriverList';
import BestMatchOverlay from '@/components/home/BestMatchOverlay';
import DriverTripPanel from '@/components/home/DriverTripPanel';
import HomeSheetContent from '@/components/HomeSheetContent';
import InlineNotice from '@/components/InlineNotice';
import LoadingPopup from '@/components/LoadingPopup';
import InteractiveMap from '@/components/map';
import MapTitleChip from '@/components/MapTitleChip';
import MenuButton from '@/components/MenuButton';
import PlanForm from '@/components/PlanForm';
import PriceModal from '@/components/PriceModal';
import RoutePreview from '@/components/RoutePreview';
import SearchPill from '@/components/SearchPill';
import { tripTitle } from '@/components/TripSheet';
import { useDriverFlow } from '@/hooks/useDriverFlow';
import { MID_FRACTION, SNAP, useHomeSheet } from '@/hooks/useHomeSheet';
import { usePassengerFlow } from '@/hooks/usePassengerFlow';
import { usePassengerResults } from '@/hooks/usePassengerResults';
import { useRoleSwitch } from '@/hooks/useRoleSwitch';
import { useRoutePreview } from '@/hooks/useRoutePreview';
import { useSavedTrips } from '@/hooks/useSavedTrips';
import { useAuth } from '@/lib/auth';
import { avatarSlot } from '@/lib/driverExtras';
import { homeMapContent } from '@/lib/homeMap';
import { useNotify } from '@/lib/notify';
import { pickDate, pickDateTime, pickTime } from '@/lib/pickDateTime';
import { errText } from '@/lib/places';
import { cancelPostedRide, type Req } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { type Colors } from '@/styles/theme';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useDrawerStatus, type DrawerNavigationProp } from 'expo-router/drawer';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // Which driver setting's popup is open, if any.
  const [editing, setEditing] = useState<'mdd' | 'price' | null>(null);
  // 'home' shows recent / saved trips; 'plan' shows the search form and results.
  const [view, setView] = useState<'home' | 'plan'>('home');

  // Driver side: the cancel confirmation.
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  // The driver said yes: go Home. The trip updates check announces it.
  function onBooked() {
    results.setListOpen(false);
    closePlan();
  }

  const passenger = usePassengerFlow(userId, onBooked);
  const driver = useDriverFlow(userId, driverMode);
  const drawerStatus = useDrawerStatus();
  const clearPassenger = passenger.clear;
  const clearDriver = driver.clear;
  const places = useSavedTrips(userId);
  const {
    preview, setPreview, loading: quickLoading, start: startPreview,
  } = useRoutePreview({
    driverMode,
    beforeLookup: () => passenger.clear(),
    onShown: () => sheetRef.current?.snapToIndex(SNAP.TRIP),
  });
  const results = usePassengerResults({
    userId, driverMode, view, passenger, onReopened: () => setPreview(null),
  });
  const { showResults, showMatch, best, automatic } = results;
  const resetResults = results.reset;

  // Passenger view drops any trip being shown. (Driver view re-checks it when Home opens.)
  useEffect(() => {
    if (!driverMode) driver.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverMode]);

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

  // Rider: look for drivers on the previewed route. The list takes over the screen when found.
  async function onFind() {
    Keyboard.dismiss();
    results.startFinding();
    driver.clear();
    // Reuse the start and end the route preview already found.
    const known = preview ? { ...preview, from: preview.start, to: preview.end } : undefined;
    const found = await passenger.search(pickup, destination, when ?? new Date(), known);
    if (found === 'none') {
      // The search stays open, so a driver who posts a matching ride can still pick the rider up.
      notify({
        kind: 'alert',
        title: "No Driver's available.",
        subtitle: 'Drivers can still pick you up. Cancel in Scheduled Trips.',
      });
    }
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

  // The History tab sends a trip here to redo. It is read once, then cleared.
  const redoParams = useLocalSearchParams<{
    redo?: string; from?: string; to?: string; role?: string; resumeRequest?: string; resumeOffer?: string;
  }>();
  useFocusEffect(
    useCallback(() => {
      if (redoParams.resumeRequest) {
        const requestId = redoParams.resumeRequest;
        router.setParams({ resumeRequest: undefined, resumeOffer: undefined });
        setPreview(null);
        results.openFromHistory(redoParams.resumeOffer);
        setView('plan');
        if (driverMode) void choose(false);
        void passenger.resume(requestId);
        return;
      }
      if (!redoParams.redo || !redoParams.to) return;
      const { from, to, role } = redoParams;
      router.setParams({ redo: undefined, from: undefined, to: undefined, role: undefined });
      redoTrip(from ?? '', to, role !== 'rider');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [redoParams.redo, redoParams.resumeRequest]),
  );

  // Post the trip being previewed. The preview goes away once it is posted.
  async function onPost() {
    Keyboard.dismiss();
    if (pricePerKm === null) {
      setEditing('price');
      return;
    }
    passenger.clear();
    const ok = await driver.post(pickup, destination, when ?? new Date(), mdd, pricePerKm);
    if (ok) setPreview(null);
  }

  const active = !!driver.trip || passenger.results.length > 0 || !!passenger.msg || !!driver.msg;
  // Empty the form and anything it produced, leaving the sheet where it is.
  const clearFields = useCallback(() => {
    resetResults();
    clearPassenger();
    clearDriver();
    setPreview(null);
    setPickup('');
    setDestination('');
  }, [clearDriver, clearPassenger, resetResults, setPreview]);
  // Same, but also closes the keyboard and lowers the sheet (used when leaving the plan view).
  const clearAll = useCallback(() => {
    Keyboard.dismiss();
    clearFields();
    sheetRef.current?.snapToIndex(SNAP.MID);
  }, [clearFields]);

  const previewNow = preview && preview.driver === driverMode && !showResults ? preview : null;
  const showTrip = !!driver.trip && !previewNow;
  const showPreview = !!previewNow;

  // A posted trip, a route preview or a set of results always shows the plan view.
  const showPlan = view === 'plan' || active || showPreview;

  const {
    animationConfigs, sheetPosition, pillStyle, noticeStyle, snapPoints, raisedHeight, setPreviewHeight,
  } = useHomeSheet(windowHeight, insets.bottom, showPreview);

  // Back from the driver list returns to the route preview.
  const { setChosenId, setListOpen, finishAutomatic, reopened, hasResults } = results;
  const abandonSearch = passenger.abandon;
  const backToPreview = useCallback(() => {
    abandonSearch();
    clearPassenger();
    setChosenId(null);
    setListOpen(false);
  }, [abandonSearch, clearPassenger, setChosenId, setListOpen]);

  function openPlan(place?: string) {
    if (place) setDestination(place);
    setView('plan');
    sheetRef.current?.snapToIndex(SNAP.FULL);
  }

  function closePlan() {
    clearAll();
    setView('home');
  }

  const leaveAutomaticSearch = useCallback(() => {
    finishAutomatic();
    clearAll();
    setView('home');
  }, [clearAll, finishAutomatic]);

  // "Cancel" on the match for a reopened search closes the search itself.
  async function cancelReopenedSearch() {
    if (!(await passenger.cancelSearch())) return;
    leaveAutomaticSearch();
    notify({ kind: 'success', title: 'Search cancelled' });
  }

  const recoveryNotice = automatic?.showNotice ? (
    <InlineNotice message='Your driver cancelled, we’re searching again' onDismiss={results.dismissNotice} />
  ) : null;

  const backFromDrivers = useCallback(() => {
    setListOpen(false);
    if (reopened) {
      clearAll();
      setView('home');
      router.navigate('/rides');
      return;
    }
    if (automatic && !hasResults) {
      leaveAutomaticSearch();
      return;
    }
    if (automatic) setChosenId(null);
    else backToPreview();
  }, [automatic, backToPreview, clearAll, hasResults, leaveAutomaticSearch, reopened, setChosenId, setListOpen]);

  const backFromPreview = useCallback(() => {
    setPreview(null);
    sheetRef.current?.snapToIndex(SNAP.FULL);
  }, [setPreview]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerStatus === 'open') return false;
      if (showResults) backFromDrivers();
      else if (showMatch) {
        if (automatic) leaveAutomaticSearch();
        else backToPreview();
      }
      else if (showPreview) backFromPreview();
      else if (showPlan && !showTrip) {
        clearAll();
        setView('home');
      }
      else return false;
      return true;
    });
    return () => subscription.remove();
  }, [automatic, backFromDrivers, backFromPreview, backToPreview, clearAll, drawerStatus, leaveAutomaticSearch,
    showMatch, showPlan, showPreview, showResults, showTrip]));

  // Driver answered a request.
  async function answer(accept: boolean, req: Req | null = driver.popup) {
    if (req) await driver.respond(req, accept);
  }

  // "Yes" on the cancel confirmation: remove the trip from rider search.
  async function cancelTrip() {
    if (driver.trip?.status !== 'scheduled') {
      setConfirmCancel(false);
      return;
    }
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

  const inProgress = driver.trip?.status === 'in_progress';
  const map = homeMapContent({
    shownTrip: showTrip ? driver.trip : null,
    trip: driver.trip,
    preview: previewNow,
    requestMarkers: driver.markers,
    pickup: passenger.pickup,
    dropoff: passenger.dropoff,
    colors,
  });

  const message = driver.msg || passenger.msg;

  return (
    <GestureHandlerRootView style={styles.container}>
      <InteractiveMap
        route={map.route}
        markers={map.markers}
        plannedStops={map.plannedStops}
        // Fit the route into the map area left visible above the sheet.
        padding={{
          top: insets.top + 90,
          right: 40,
          bottom: (showTrip || showPreview ? raisedHeight : windowHeight * MID_FRACTION) + 20,
          left: 40,
        }}
      />

      {showResults ? (
        <DriverList
          drivers={passenger.results}
          emptyMessage={(reopened || automatic) && !passenger.loading ? passenger.msg : undefined}
          notice={recoveryNotice}
          onRetry={automatic ? () => void passenger.resume(automatic.requestId) : undefined}
          chosenId={results.chosenId}
          offerStatuses={passenger.offerStatuses}
          sendingRideId={passenger.sendingRideId}
          onChoose={setChosenId}
          onBack={backFromDrivers}
          onConfirm={results.confirmChosen}
        />
      ) : (
        <>
          {/* The plan view dims the map; a posted trip keeps it clear with a title chip on top. */}
          {showPlan && !showTrip && !showPreview && (
            <View pointerEvents='none' style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
          )}
          {!showPreview && (!showPlan || showTrip) && <MenuButton onPress={() => navigation.openDrawer()} />}
          {showTrip && (
            <MapTitleChip
              title={inProgress ? 'Trip in progress' : tripTitle(driver.popup, driver.passengers.length)}
            />
          )}
          {showPreview && <MapTitleChip title='Your route' />}

          <BottomSheet
            ref={sheetRef}
            index={1}
            snapPoints={snapPoints}
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
                <DriverTripPanel
                  driver={driver}
                  trip={driver.trip}
                  message={message}
                  cancelling={cancelling}
                  onAnswer={(accept, request) => void answer(accept, request)}
                  onStarted={() => {
                    setConfirmCancel(false);
                    driver.markStarted();
                  }}
                  onFinished={closePlan}
                  onCancel={() => setConfirmCancel(true)}
                  onScheduleAnother={() => {
                    clearFields();
                    setWhen(null);
                    openPlan();
                  }}
                />
              ) : previewNow ? (
                <View onLayout={(e) => setPreviewHeight(e.nativeEvent.layout.height)}>
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
                    onMaxDivergence={driverMode ? () => setEditing('mdd') : undefined}
                    onPrice={driverMode ? () => setEditing('price') : undefined}
                    submitLabel={driverMode ? 'Schedule Ride' : 'Find driver'}
                    onSubmit={driverMode ? onPost : onFind}
                    loading={driverMode ? driver.loading : passenger.loading}
                  />
                </View>
              ) : (
                <>
                  <PlanForm
                    onBack={closePlan}
                    driverMode={driverMode}
                    switching={switching}
                    onRole={choose}
                    when={when}
                    onPickDate={() => pickDateTime(when ?? new Date(), setWhen)}
                    driverOptions={driverMode ? {
                      mdd,
                      pricePerKm,
                      onEditMdd: () => setEditing('mdd'),
                      onEditPrice: () => setEditing('price'),
                    } : undefined}
                    pickup={pickup}
                    onPickup={setPickup}
                    destination={destination}
                    onDestination={setDestination}
                    onFocusField={() => sheetRef.current?.snapToIndex(SNAP.FULL)}
                    onClear={clearFields}
                    submitLabel='Preview Route'
                    onSubmit={onPreview}
                    loading={quickLoading}
                    recent={places.recent}
                    saved={places.saved}
                    onUnsetSaved={onUnsetSaved}
                    message={message}
                  />
                </>
              )}
            </BottomSheetScrollView>
          </BottomSheet>

          {showMatch && best && (
            <BestMatchOverlay
              notice={recoveryNotice}
              driver={best}
              offerStatus={passenger.offerStatuses[best.rideId]}
              sending={passenger.sendingRideId === best.rideId}
              avatarIndex={avatarSlot(Math.max(0, passenger.results.indexOf(best)))}
              hasOthers={passenger.results.length > 1}
              onSeeOthers={() => setListOpen(true)}
              onCancel={!automatic ? backToPreview
                : passenger.offerStatuses[best.rideId] ? leaveAutomaticSearch
                : () => void cancelReopenedSearch()}
              onConfirm={results.confirmBest}
            />
          )}

          {showPreview && <BackButton onPress={showMatch ? backToPreview : backFromPreview} />}
          {automatic && showMatch && <BackButton onPress={leaveAutomaticSearch} />}

          {/* Post trip / Find driver problems: a card above the sheet, outside it. */}
          {showPreview && !!message && !showMatch && (
            <Animated.View pointerEvents='box-none' style={[styles.notice, noticeStyle]}>
              <InlineNotice message={message} style={styles.noticeCard} />
            </Animated.View>
          )}

          {/* Drawn after the sheet so they sit on top of its edge. */}
          {!showPlan && (
            <>
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


      <ConfirmDialog
        visible={confirmCancel}
        title='Are you sure?'
        message={
          driver.passengers.length
            ? 'Accepted passengers will return to searching. This ride will move to History.'
            : 'This ride will move to History and any pending offers will close.'
        }
        busy={cancelling}
        onYes={cancelTrip}
        onNo={() => setConfirmCancel(false)}
      />

      <DivergenceModal
        visible={editing === 'mdd'}
        value={mdd}
        onSave={(km) => {
          setMdd(km);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
      <PriceModal
        visible={editing === 'price'}
        value={pricePerKm}
        onSave={(price) => {
          setPricePerKm(price);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
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
    pill: { position: 'absolute', top: 0, left: 16, right: 16 },
    // Zero-height row at the sheet's top edge; the card hangs upward from it.
    notice: { position: 'absolute', top: 0, left: 16, right: 16, height: 0 },
    noticeCard: { position: 'absolute', left: 0, right: 0, bottom: 12 },
  });
