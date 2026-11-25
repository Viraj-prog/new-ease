import PressButton from '@/components/PressButton';
import { money, TINT_SLOT, type Item, type Store } from '@/lib/delivery';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_QTY = 20;

type Props = {
  item: Item;
  store: Store;
  // How many are already in the cart. Above 0 only when the item was opened from the cart.
  inCart: number;
  // True when changing an item that is in the cart; the number chosen replaces the old one.
  editing: boolean;
  onDone: (qty: number) => void;
};

// One item: its picture, details, a quantity stepper and Add to cart.
export default function ItemView({ item, store, inCart, editing, onDone }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);
  const [qty, setQty] = useState(editing ? inCart : 1);
  // Taking a cart item down to zero removes it.
  const min = editing ? 0 : 1;

  const total = money((Math.round(item.price * 100) * qty) / 100);
  const label = !editing ? `Add to cart · ${total}` : qty === 0 ? 'Remove from cart' : `Update cart · ${total}`;

  const step = (by: number) => setQty((q) => Math.max(min, Math.min(MAX_QTY, q + by)));

  return (
    <View style={styles.screen}>
      <View style={[styles.picture, { marginTop: insets.top + 68, backgroundColor: colors.avatars[TINT_SLOT[store.tint]].bg }]}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>
        <ScrollView style={styles.details}>
          <Text style={styles.meta}>
            {store.name} · {item.category}
          </Text>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>{money(item.price)}</Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
        </ScrollView>

        <View style={styles.actions}>
          <View style={styles.stepper}>
            <PressButton ghost style={styles.stepButton} onPress={() => step(-1)} disabled={qty <= min} accessibilityLabel='Fewer'>
              <Ionicons name='remove' size={22} color={qty <= min ? colors.textSecondary : colors.text} />
            </PressButton>
            <Text style={styles.qty}>{qty}</Text>
            <PressButton ghost style={styles.stepButton} onPress={() => step(1)} disabled={qty >= MAX_QTY} accessibilityLabel='More'>
              <Ionicons name='add' size={22} color={qty >= MAX_QTY ? colors.textSecondary : colors.text} />
            </PressButton>
          </View>
          <PressButton style={styles.add} onPress={() => onDone(qty)}>
            <Text style={styles.addText} numberOfLines={1}>
              {label}
            </Text>
          </PressButton>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, gap: 18 },
    picture: {
      flex: 1.2,
      marginHorizontal: 16,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: { fontSize: 130 },
    panel: {
      flex: 1,
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 22,
      boxShadow: `0px -6px 18px ${c.shadow}`,
    },
    details: { flex: 1 },
    meta: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
    name: { flex: 1, fontFamily: fonts.titleSemibold, fontSize: 26, color: c.text },
    price: { fontFamily: fonts.titleSemibold, fontSize: 23, color: c.text },
    description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: c.textSecondary, marginTop: 8 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 54,
      borderRadius: 18,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 4,
    },
    stepButton: { width: 40, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    qty: { fontFamily: fonts.semibold, fontSize: 17, color: c.text, minWidth: 24, textAlign: 'center' },
    add: {
      flex: 1,
      height: 54,
      borderRadius: 18,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    addText: { fontFamily: fonts.semibold, fontSize: 16, color: c.onBrand },
  });
