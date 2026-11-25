import BackButton from '@/components/BackButton';
import CartButton from '@/components/delivery/CartButton';
import CartView from '@/components/delivery/CartView';
import DropoffView from '@/components/delivery/DropoffView';
import ItemView from '@/components/delivery/ItemView';
import StoresView from '@/components/delivery/StoresView';
import DriverList from '@/components/DriverList';
import DriverMatchCard from '@/components/DriverMatchCard';
import LoadingPopup from '@/components/LoadingPopup';
import MenuButton from '@/components/MenuButton';
import { useSavedTrips } from '@/hooks/useSavedTrips';
import { useAuth } from '@/lib/auth';
import {
  BUILT_IN,
  cartLines,
  DELIVERY_FEE,
  loadCatalog,
  money,
  SAMPLE_DRIVERS,
  subtotalOf,
  type Cart,
  type Item,
  type Store,
} from '@/lib/delivery';
import { avatarSlot, driverExtras } from '@/lib/driverExtras';
import { useNotify } from '@/lib/notify';
import { errText, isCurrentLabel, resolveDestination } from '@/lib/places';
import { useTheme } from '@/lib/theme';
import { type Colors } from '@/styles/theme';
import { useFocusEffect, useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';

// How long the two spinners stay up: long enough to read, as the drivers are only samples.
const SEARCH_MS = 2500;
const CONFIRM_MS = 3000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Step =
  | { name: 'stores' }
  // `from` is where Back goes; opened from the cart, the item is being edited.
  | { name: 'item'; item: Item; from: 'stores' | 'cart' }
  | { name: 'cart' }
  | { name: 'dropoff' };

// Delivery: pick items from a store, check the cart, give a drop-off place, then choose a driver.
export default function DeliveryScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const { session } = useAuth();
  const places = useSavedTrips(session?.user.id);
  const notify = useNotify();

  const [stores, setStores] = useState<Store[]>(BUILT_IN);
  const [cart, setCart] = useState<Cart>({});
  const [step, setStep] = useState<Step>({ name: 'stores' });
  const [address, setAddress] = useState('');

  // Driver choosing, on top of the drop-off page.
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<'best' | 'list' | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [confirmingName, setConfirmingName] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Goes up whenever a search is abandoned, so a late answer is ignored.
  const searchRun = useRef(0);

  // Read the items again each time the tab is opened.
  useFocusEffect(
    useCallback(() => {
      loadCatalog()
        .then(setStores)
        .catch((e) => console.warn(e));
    }, []),
  );

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const lines = cartLines(cart, stores);
  const total = money(subtotalOf(lines) + DELIVERY_FEE);
  // The best rated driver is offered first.
  const best = [...SAMPLE_DRIVERS].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

  function back() {
    Keyboard.dismiss();
    if (match === 'list') setMatch('best');
    else if (match === 'best') setMatch(null);
    else if (step.name === 'item') setStep(step.from === 'cart' ? { name: 'cart' } : { name: 'stores' });
    else if (step.name === 'cart') setStep({ name: 'stores' });
    else if (step.name === 'dropoff') setStep({ name: 'cart' });
  }

  // Android's back button steps back through delivery before it leaves the tab.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step.name === 'stores') return false;
        back();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, match]),
  );

  function setQty(item: Item, qty: number, from: 'stores' | 'cart') {
    setCart((c) => {
      const next = { ...c };
      // From a store the number is added to what is there; from the cart it replaces it.
      const total = from === 'cart' ? qty : (c[item.id] ?? 0) + qty;
      if (total > 0) next[item.id] = total;
      else delete next[item.id];
      return next;
    });
    setStep(from === 'cart' ? { name: 'cart' } : { name: 'stores' });
  }

  async function findDriver() {
    Keyboard.dismiss();
    const run = ++searchRun.current;
    setSearching(true);
    try {
      const [point] = await Promise.all([resolveDestination(address), wait(SEARCH_MS)]);
      if (run !== searchRun.current) return;
      if (!point) {
        notify({
          kind: 'alert',
          title: isCurrentLabel(address) ? 'Current Location could not be found' : 'Address not found',
          subtitle: isCurrentLabel(address) ? 'Make sure location is turned on.' : 'Try adding the city.',
        });
        return;
      }
      setChosenId(null);
      setMatch('best');
    } catch (e) {
      console.warn(e);
      if (run === searchRun.current) notify({ kind: 'alert', title: 'Could not search', subtitle: errText(e) });
    } finally {
      if (run === searchRun.current) setSearching(false);
    }
  }

  function confirm(driverId: string | undefined) {
    const driver = SAMPLE_DRIVERS.find((d) => d.rideId === driverId);
    if (!driver) return;
    setConfirmingName(driver.driverName);
    confirmTimer.current = setTimeout(() => {
      setConfirmingName(null);
      setMatch(null);
      setCart({});
      setAddress('');
      setStep({ name: 'stores' });
      notify({
        kind: 'success',
        title: 'Order confirmed!',
        subtitle: `${driver.driverName} will deliver to ${address.trim()}`,
      });
    }, CONFIRM_MS);
  }

  function cancelConfirm() {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirmingName(null);
  }

  const store = step.name === 'item' ? stores.find((s) => s.id === step.item.storeId) : undefined;
  const openCart = () => setStep({ name: 'cart' });

  return (
    <View style={styles.container}>
      {match === 'list' ? (
        <DriverList
          drivers={SAMPLE_DRIVERS}
          chosenId={chosenId}
          onChoose={setChosenId}
          priceText={total}
          summary={`${SAMPLE_DRIVERS.length} drivers can deliver your order`}
          confirmLabel='Confirm'
          hideDeparture
          offerStatuses={{}}
          sendingRideId={null}
          onBack={() => setMatch('best')}
          onConfirm={() => confirm(chosenId ?? undefined)}
        />
      ) : (
        <>
          {step.name === 'stores' && (
            <StoresView stores={stores} onPick={(item) => setStep({ name: 'item', item, from: 'stores' })} />
          )}
          {step.name === 'item' && store && (
            <ItemView
              key={step.item.id}
              item={step.item}
              store={store}
              inCart={cart[step.item.id] ?? 0}
              editing={step.from === 'cart'}
              onDone={(qty) => setQty(step.item, qty, step.from)}
            />
          )}
          {step.name === 'cart' && (
            <CartView
              lines={lines}
              onEdit={(item) => setStep({ name: 'item', item, from: 'cart' })}
              onNext={() => setStep({ name: 'dropoff' })}
            />
          )}
          {step.name === 'dropoff' && (
            <DropoffView
              address={address}
              onAddress={setAddress}
              saved={places.saved}
              recent={places.recent}
              onUnsetSaved={(label) =>
                notify({
                  kind: 'alert',
                  title: 'No location saved',
                  subtitle: `Set your ${label} address in Saved Trips.`,
                })
              }
              onNext={findDriver}
            />
          )}

          {/* Best match: dims the page and floats the driver's card over it. */}
          {match === 'best' && best && (
            <View style={styles.matchWrap}>
              <DriverMatchCard
                driver={best}
                avatarIndex={avatarSlot(SAMPLE_DRIVERS.indexOf(best))}
                priceText={total}
                priceLabel='Total'
                confirmLabel='Confirm'
                awayText={`${driverExtras(best).minAway} min away`}
                sending={false}
                hasOthers={SAMPLE_DRIVERS.length > 1}
                onSeeOthers={() => setMatch('list')}
                onCancel={() => setMatch(null)}
                onConfirm={() => confirm(best.rideId)}
              />
            </View>
          )}

          {/* Drawn after the match card's dimmed cover, so Back still works over it. */}
          {step.name === 'stores' ? (
            <MenuButton onPress={() => navigation.openDrawer()} />
          ) : (
            <BackButton onPress={back} />
          )}
          {(step.name === 'stores' || step.name === 'item') && <CartButton count={lines.length} onPress={openCart} />}
        </>
      )}

      <LoadingPopup visible={searching} title='Finding drivers' subtitle='Matching you with nearby drivers' />
      <LoadingPopup
        visible={!!confirmingName}
        title='Confirming delivery'
        subtitle={`Sending your order to ${confirmingName}`}
        onCancel={cancelConfirm}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    matchWrap: {
      ...StyleSheet.absoluteFill,
      backgroundColor: c.scrim,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
  });
