import Icon from '@/components/Icon';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// "Where are you going?" bar that floats over the top edge of the home sheet.
// It is a field inside a thicker frame, and casts a soft shadow onto the sheet below it.
export default function SearchPill({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Pressable style={styles.frame} onPress={onPress}>
      <View style={styles.field}>
        <Icon name='at-sign' size={22} color={colors.brand} />
        <Text style={styles.text}>Where are you going?</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    frame: {
      height: 52,
      padding: 2,
      borderRadius: 16,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderStrong,
      // boxShadow blurs properly on Android; elevation gives a flat grey slab.
      boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 28, spreadDistance: 0, color: c.pillShadow }],
    },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      borderRadius: 13,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.borderMid,
    },
    text: { fontFamily: fonts.regular, fontSize: 17, color: c.placeholder },
  });
