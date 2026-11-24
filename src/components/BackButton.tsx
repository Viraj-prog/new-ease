import Icon from '@/components/Icon';
import { useTheme } from '@/lib/theme';
import { type Colors } from '@/styles/theme';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Round back button at the top-left of the map (same look as the menu button).
export default function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel='Back'
      onPress={onPress}
      hitSlop={8}
      style={[styles.button, { top: insets.top + 8 }]}
    >
      <Icon name='arrow-left' color={colors.text} />
    </Pressable>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      zIndex: 1,
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
