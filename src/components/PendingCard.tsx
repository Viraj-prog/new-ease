import Icon from '@/components/Icon';
import PressButton from '@/components/PressButton';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type PendingStatus = 'searching' | 'waiting' | 'scheduled' | 'booked' | 'in_progress';

const statuses: Record<PendingStatus, { label: string; icon: ComponentProps<typeof Ionicons>['name'] }> = {
  searching: { label: 'Searching', icon: 'search' },
  waiting: { label: 'Waiting', icon: 'time-outline' },
  scheduled: { label: 'Scheduled', icon: 'calendar-outline' },
  booked: { label: 'Booked', icon: 'checkmark' },
  in_progress: { label: 'In progress', icon: 'navigate' },
};

export type PendingAction = {
  label: string;
  onPress: () => void;
  // 'main' is the blue button; 'quiet' is outlined; 'danger' is outlined with red text.
  kind: 'main' | 'quiet' | 'danger';
};

type Props = {
  role: 'driver' | 'rider';
  status: PendingStatus;
  title: string;
  // Where it starts, when that is known.
  from?: string | null;
  when: string | null;
  actions: PendingAction[];
  // Extra controls under the buttons, such as Start trip.
  children?: ReactNode;
};

// One upcoming or live trip, drawn to match the rows in History.
export default function PendingCard(p: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const status = statuses[p.status];
  // Booked and under way are good news (green); the rest are still waiting on something (blue).
  const settled = p.status === 'booked' || p.status === 'in_progress';
  const tint = settled ? colors.successTint : colors.selected;
  const ink = settled ? colors.onSuccessTint : colors.onTint;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.bubble, { backgroundColor: tint }]}>
          <Ionicons name={status.icon} size={20} color={ink} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{p.title}</Text>
          <View style={styles.meta}>
            <View
              style={styles.role}
              accessible
              accessibilityLabel={p.role === 'driver' ? 'You drive' : 'You ride'}
            >
              <Icon name={p.role === 'driver' ? 'steering-wheel' : 'rider'} size={15} color={colors.text} />
            </View>
            {!!p.when && <Text style={styles.when}>{p.when}</Text>}
          </View>
        </View>
        <Text style={[styles.status, { backgroundColor: tint, color: ink }]}>{status.label}</Text>
      </View>

      {!!p.from && <Text style={styles.from} numberOfLines={2}>From {p.from}</Text>}

      {p.actions.length > 0 && (
        <View style={styles.actions}>
          {p.actions.map((a) => (
            <PressButton
              key={a.label}
              ripple={false}
              style={[styles.button, a.kind === 'main' ? styles.main : styles.outlined]}
              onPress={a.onPress}
              accessibilityRole='button'
            >
              <Text
                style={[
                  styles.buttonText,
                  a.kind === 'main' && { color: colors.onBrand },
                  a.kind === 'danger' && { color: colors.alertText },
                ]}
              >
                {a.label}
              </Text>
            </PressButton>
          ))}
        </View>
      )}
      {p.children}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 12, gap: 10 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: 4 },
    title: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    role: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.statBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    when: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    status: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      borderRadius: 10,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    from: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    actions: { flexDirection: 'row', gap: 8 },
    button: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    main: { backgroundColor: c.brand, borderColor: c.brand },
    outlined: { backgroundColor: 'transparent', borderColor: c.handle },
    buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
  });
