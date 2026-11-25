import DriverMatchCard from '@/components/DriverMatchCard';
import { useTheme } from '@/lib/theme';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

type Props = ComponentProps<typeof DriverMatchCard> & {
  // Shown above the card, such as "your driver cancelled".
  notice: ReactNode;
};

// The best match: dims the screen and floats the driver's card over the route preview.
export default function BestMatchOverlay({ notice, ...card }: Props) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.scrim, paddingBottom: height * 0.3 }]}>
      {notice}
      <DriverMatchCard {...card} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: 'flex-end', paddingHorizontal: 20, gap: 10 },
});
