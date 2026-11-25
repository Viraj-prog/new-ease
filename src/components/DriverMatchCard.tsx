import VehicleBox from '@/components/VehicleBox';
import { driverExtras, formatDriverDeparture, formatDriverFare } from '@/lib/driverExtras';
import { offerStatusLabels, type OfferStatus, type Result } from '@/lib/rides';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import PressButton from '@/components/PressButton';

type Props = {
  driver: Result;
  avatarIndex: number;
  offerStatus?: OfferStatus;
  sending: boolean;
  // True when other drivers exist; otherwise the left button is "Cancel".
  hasOthers: boolean;
  // Delivery shows its own price and label, and "min away" in place of a departure time.
  priceText?: string;
  priceLabel?: string;
  awayText?: string;
  confirmLabel?: string;
  onSeeOthers: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

// The first driver offered: "Best match", with See others (or Cancel) and Confirm.
export default function DriverMatchCard(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const x = driverExtras(p.driver);
  const avatar = colors.avatars[p.avatarIndex % colors.avatars.length];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Ionicons name='checkmark' size={18} color={colors.onTint} />
          <Text style={styles.badgeText}>Best match</Text>
        </View>
        <Text style={styles.away}>{p.awayText ?? `Departs ${formatDriverDeparture(p.driver.departAt)}`}</Text>
      </View>

      <View style={styles.person}>
        <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
          <Text style={[styles.avatarText, { color: avatar.fg }]}>{initialsOf(p.driver.driverName)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {p.driver.driverName}
          </Text>
          <View style={styles.ratingRow}>
            <Icon name='star' size={16} color={colors.star} />
            <Text style={styles.rating}>
              {p.driver.rating ? Number(p.driver.rating).toFixed(1) : 'New'} · {x.trips} trips
            </Text>
          </View>
        </View>
        <View style={styles.priceCol}>
          <Text style={p.driver.fare === null && !p.priceText ? styles.fare : styles.price}>
            {p.priceText ?? formatDriverFare(p.driver.fare)}
          </Text>
          {(p.driver.fare !== null || !!p.priceText) && <Text style={styles.fare}>{p.priceLabel ?? 'Est. fare'}</Text>}
        </View>
      </View>

      <VehicleBox model={x.model} detail={x.detail} plate={x.plate} />

      <View style={styles.buttons}>
        <PressButton ghost style={[styles.button, styles.ghost]} onPress={p.hasOthers ? p.onSeeOthers : p.onCancel}>
          <Text style={styles.ghostText}>{p.hasOthers ? 'See others' : p.offerStatus ? 'Back' : 'Cancel'}</Text>
        </PressButton>
        <PressButton
          style={[styles.button, { backgroundColor: colors.brand }]}
          onPress={p.onConfirm}
          disabled={p.sending || !!p.offerStatus}
        >
          <Text style={[styles.buttonText, { color: colors.onBrand }]}>
            {p.sending ? 'Sending…' : p.offerStatus ? offerStatusLabels[p.offerStatus] : p.confirmLabel ?? 'Send request'}
          </Text>
        </PressButton>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      gap: 16,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.selected,
      borderRadius: 18,
      paddingHorizontal: 12,
      height: 36,
    },
    badgeText: { fontFamily: fonts.semibold, fontSize: 16, color: c.onTint },
    away: { fontFamily: fonts.regular, fontSize: 16, color: c.textSecondary },
    person: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.titleSemibold, fontSize: 26 },
    info: { flex: 1, gap: 4 },
    name: { fontFamily: fonts.semibold, fontSize: 21, color: c.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rating: { fontFamily: fonts.regular, fontSize: 16, color: c.textSecondary },
    priceCol: { alignItems: 'flex-end' },
    price: { fontFamily: fonts.titleSemibold, fontSize: 27, color: c.text },
    fare: { fontFamily: fonts.regular, fontSize: 15, color: c.textSecondary, marginTop: 4 },
    buttons: { flexDirection: 'row', gap: 12 },
    button: { flex: 1, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    ghost: { backgroundColor: c.card, borderWidth: 1, borderColor: c.borderStrong },
    ghostText: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    buttonText: { fontFamily: fonts.semibold, fontSize: 17 },
  });
