import PressButton from '@/components/PressButton';
import { money, TINT_SLOT, type Item, type Store } from '@/lib/delivery';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Each store's name over a row of its items that scrolls sideways.
export default function StoresView({ stores, onPick }: { stores: Store[]; onPick: (item: Item) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 }]}
    >
      {stores.map((s) => (
        <View key={s.id}>
          <Text style={styles.store}>{s.name}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {s.items.map((item) => (
              <PressButton ghost key={item.id} style={styles.card} onPress={() => onPick(item)}>
                <View style={[styles.picture, { backgroundColor: colors.avatars[TINT_SLOT[s.tint]].bg }]}>
                  <Text style={styles.emoji}>{item.emoji}</Text>
                </View>
                <View style={styles.text}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.unit} numberOfLines={1}>
                    {item.unit}
                  </Text>
                  <Text style={styles.price}>{money(item.price)}</Text>
                </View>
              </PressButton>
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    // The space between one store and the next.
    page: { gap: 28 },
    // The side padding stays at 20, in line with the menu and cart buttons.
    store: { fontFamily: fonts.titleSemibold, fontSize: 17, color: c.text, paddingHorizontal: 20 },
    // Vertical padding leaves room for the cards' shadows.
    row: { gap: 11, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 14 },
    card: {
      width: 114,
      borderRadius: 16,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      boxShadow: `0px 3px 10px ${c.shadow}`,
    },
    picture: { height: 69, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 37 },
    text: { paddingHorizontal: 10, paddingVertical: 8, gap: 1 },
    name: { fontFamily: fonts.semibold, fontSize: 11, color: c.text },
    unit: { fontFamily: fonts.regular, fontSize: 10, color: c.textSecondary },
    price: { fontFamily: fonts.titleSemibold, fontSize: 14, color: c.text, marginTop: 5 },
  });
