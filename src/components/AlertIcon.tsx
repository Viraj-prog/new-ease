import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

// The mark on every error: a red exclamation point on a see-through red rounded square.
export default function AlertIcon({ size = 44 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: 'rgba(255,107,107,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name='alert' size={size * 0.64} color={colors.alert} />
    </View>
  );
}
