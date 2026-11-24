import AlertIcon from '@/components/AlertIcon';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

// An error shown inside a page or popup, with the same red mark as the top notification.
export default function InlineNotice({ message, style, onDismiss, onRetry }: {
  message: string;
  style?: StyleProp<ViewStyle>;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <AlertIcon size={36} />
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      {(onRetry || onDismiss) && (
        <Pressable accessibilityRole='button' onPress={onRetry ?? onDismiss} hitSlop={8}>
          <Text style={[styles.dismiss, { color: colors.brand }]}>{onRetry ? 'Retry' : 'Dismiss'}</Text>
        </Pressable>
      )}
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
  dismiss: { fontFamily: fonts.semibold, fontSize: 13 },
});
