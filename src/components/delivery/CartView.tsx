import BottomBar from '@/components/delivery/BottomBar';
import PressButton from '@/components/PressButton';
import { money, subtotalOf, type CartLine, type Item } from '@/lib/delivery';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  lines: CartLine[];
  // Tapping a line opens the item, to change how many or remove it.
  onEdit: (item: Item) => void;
  onNext: () => void;
};

// "Your cart": what has been added, the subtotal and Choose Location.
export default function CartView({ lines, onEdit, onNext }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 24, paddingHorizontal: 20, gap: 14 }}
      >
        <Text style={styles.title}>Your cart</Text>
        {lines.length === 0 ? (
          <Text style={styles.empty}>Your cart is empty. Add something from a store.</Text>
        ) : (
          <>
            {lines.map(({ item, qty }) => (
              <PressButton ghost pressScale={0.98} key={item.id} style={styles.line} onPress={() => onEdit(item)}>
                <View style={styles.lineText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.qty}>Qty {qty}</Text>
                </View>
                <Text style={styles.price}>{money((Math.round(item.price * 100) * qty) / 100)}</Text>
              </PressButton>
            ))}
            <View style={styles.subtotal}>
              <Text style={styles.subtotalText}>Subtotal</Text>
              <Text style={styles.subtotalText}>{money(subtotalOf(lines))}</Text>
            </View>
            <Text style={styles.hint}>Tap an item to change or remove it.</Text>
          </>
        )}
      </ScrollView>

      <BottomBar label='Choose Location' disabled={lines.length === 0} onPress={onNext} />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    title: { fontFamily: fonts.titleSemibold, fontSize: 21, color: c.text, textAlign: 'center', marginBottom: 6 },
    empty: { fontFamily: fonts.regular, fontSize: 15, color: c.textSecondary, textAlign: 'center' },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 18,
      paddingVertical: 14,
      boxShadow: `0px 4px 12px ${c.shadow}`,
    },
    lineText: { flex: 1, gap: 2 },
    name: { fontFamily: fonts.semibold, fontSize: 16, color: c.text },
    qty: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    price: { fontFamily: fonts.titleSemibold, fontSize: 17, color: c.text },
    subtotal: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 },
    subtotalText: { fontFamily: fonts.titleSemibold, fontSize: 18, color: c.text },
    hint: { fontFamily: fonts.regular, fontSize: 12, color: c.textSecondary, textAlign: 'center' },
  });
