import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AlertIcon from '@/components/AlertIcon';

type Props = {
  visible: boolean;
  kind: 'success' | 'alert';
  title: string;
  subtitle?: string;
  sticky?: boolean;
  onClose: () => void;
};

// In-app notification that slides in at the top, then hides itself after a few seconds (a sticky
// one waits to be tapped).
export default function Banner({ visible, kind, title, subtitle, sticky, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  useEffect(() => {
    if (!visible || sticky) return;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [visible, sticky, onClose]);

  if (!visible) return null;
  const ok = kind === 'success';
  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + 8 }]}
    >
      <Pressable style={styles.card} onPress={onClose}>
        {ok ? (
          <View style={[styles.circle, { backgroundColor: colors.selected }]}>
            <Ionicons name='checkmark' size={26} color={colors.brand} />
          </View>
        ) : (
          <AlertIcon />
        )}
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <Text style={styles.now}>{sticky ? 'Dismiss' : 'now'}</Text>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 12, right: 12, zIndex: 50 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.card,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 14,
      boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, color: c.pillShadow }],
    },
    circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: 2 },
    title: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    subtitle: { fontFamily: fonts.regular, fontSize: 15, color: c.textSecondary },
    now: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary, alignSelf: 'flex-start' },
  });
