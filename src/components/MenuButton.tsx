import Icon from '@/components/Icon';
import { useTheme } from '@/lib/theme';
import { type Colors } from '@/styles/theme';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Round button at the top-left of a screen that opens the drawer.
export default function MenuButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.button, { top: insets.top + 8 }]}>
      <Icon name='menu' color={colors.text} />
    </Pressable>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      left: 20,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
