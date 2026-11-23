import AlertIcon from '@/components/AlertIcon';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

// An error shown inside a page or popup, with the same red mark as the top notification.
export default function InlineNotice({ message, style }: { message: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <AlertIcon size={36} />
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
});
