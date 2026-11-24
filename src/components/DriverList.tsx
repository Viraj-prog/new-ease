import BackButton from '@/components/BackButton';
import Icon from '@/components/Icon';
import InlineNotice from '@/components/InlineNotice';
import MapTitleChip from '@/components/MapTitleChip';
import VehicleBox from '@/components/VehicleBox';
import { avatarSlot, driverExtras, formatDriverDeparture, formatDriverFare } from '@/lib/driverExtras';
import { offerStatusLabels, type OfferStatus, type Result } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressButton from '@/components/PressButton';

type Props = {
  drivers: Result[];
  emptyMessage?: string;
  // The driver the rider has tapped, if any; this shows the Confirm button.
  chosenId: string | null;
  offerStatuses: Partial<Record<string, OfferStatus>>;
  sendingRideId: string | null;
  onChoose: (rideId: string) => void;
  onBack: () => void;
  onConfirm: () => void;
};

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

// Full-screen "Available drivers" list. Tapping a card selects it; Confirm sends the request.
export default function DriverList({
  drivers, emptyMessage, chosenId, offerStatuses, sendingRideId, onChoose, onBack, onConfirm,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  const n = drivers.length;
  const chosenStatus = chosenId ? offerStatuses[chosenId] : undefined;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8 + 46 + 18,
          paddingBottom: insets.bottom + (chosenId ? 100 : 24),
          paddingHorizontal: 20,
        }}
      >
        {n > 0 ? (
          <Text style={styles.count}>
            {n} driver{n === 1 ? '' : 's'} match{n === 1 ? 'es' : ''} your route
          </Text>
        ) : !!emptyMessage && <InlineNotice message={emptyMessage} />}

        <View style={styles.list}>
          {drivers.map((d, i) => {
            const avatar = colors.avatars[avatarSlot(i) % colors.avatars.length];
            const x = driverExtras(d);
            const chosen = d.rideId === chosenId;
            const status = offerStatuses[d.rideId];
            return (
              <Pressable
                key={d.rideId}
                style={[styles.card, chosen && styles.cardChosen]}
                onPress={() => onChoose(d.rideId)}
              >
                <View style={styles.row}>
                  <View style={[styles.avatar, chosen && styles.avatarBig, { backgroundColor: avatar.bg }]}>
                    <Text style={[styles.avatarText, { color: avatar.fg }]}>{initialsOf(d.driverName)}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>
                      {d.driverName}
                    </Text>
                    <View style={styles.ratingRow}>
                      <Icon name='star' size={14} color={colors.star} />
                      <Text style={styles.rating}>
                        {d.rating ? Number(d.rating).toFixed(1) : 'New'}
                        {chosen ? ` · ${x.minAway} min away` : ''}
                      </Text>
                    </View>
                    <Text style={styles.rating}>Departs {formatDriverDeparture(d.departAt)}</Text>
                    {status && <Text style={styles.rating}>{offerStatusLabels[status]}</Text>}
                  </View>
                  <Text style={d.fare === null ? styles.rating : styles.price}>{formatDriverFare(d.fare)}</Text>
                </View>
                {chosen && <VehicleBox model={x.model} detail={x.detail} plate={x.plate} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <MapTitleChip title='Available drivers' />
      <BackButton onPress={onBack} />

      {chosenId && (
        <View style={[styles.confirmWrap, { paddingBottom: insets.bottom + 16 }]}>
          <PressButton style={styles.confirm} onPress={onConfirm} disabled={!!chosenStatus || !!sendingRideId}>
            <Text style={styles.confirmText}>
              {sendingRideId === chosenId ? 'Sending…' : chosenStatus ? offerStatusLabels[chosenStatus] : 'Send request'}
            </Text>
          </PressButton>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { ...StyleSheet.absoluteFill, backgroundColor: c.background },
    count: { fontFamily: fonts.regular, fontSize: 15, color: c.textSecondary, marginBottom: 12 },
    list: { gap: 12 },
    card: {
      gap: 14,
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    cardChosen: { borderColor: c.brand, borderWidth: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarBig: { width: 56, height: 56, borderRadius: 28 },
    avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.titleSemibold, fontSize: 18 },
    info: { flex: 1, gap: 2 },
    name: { fontFamily: fonts.semibold, fontSize: 18, color: c.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rating: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary },
    price: { fontFamily: fonts.titleSemibold, fontSize: 22, color: c.text },
    confirmWrap: { position: 'absolute', left: 20, right: 20, bottom: 0 },
    confirm: {
      height: 54,
      borderRadius: 18,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmText: { fontFamily: fonts.semibold, fontSize: 17, color: c.onBrand },
  });
