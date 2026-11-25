import Icon from '@/components/Icon';
import PressButton from '@/components/PressButton';
import type { PreviousTrip } from '@/lib/previousTrips';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type FolderKey = 'today' | 'yesterday' | 'more';

const folderNames: Record<FolderKey, string> = { today: 'Today', yesterday: 'Yesterday', more: 'More' };

// Which folder a trip belongs in, going by the day it was due to leave.
function folderOf(iso: string | null, now: Date): FolderKey {
  if (!iso) return 'more';
  const day = new Date(iso).toDateString();
  if (day === now.toDateString()) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return day === yesterday.toDateString() ? 'yesterday' : 'more';
}

// The time alone under Today and Yesterday; under More the date is needed too.
function whenText(iso: string | null, folder: FolderKey, now: Date) {
  if (!iso) return 'No date';
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (folder !== 'more') return time;
  const date = d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
  return `${date} · ${time}`;
}

type RowProps = {
  trip: PreviousTrip;
  when: string;
  open: boolean;
  onToggle: () => void;
  // Opens the route preview for the same start and end.
  onRedo: () => void;
  // Only for a ride the driver cancelled while the rider's search is still open.
  onFindAnother?: () => void;
};

// One past trip. Closed, it shows how it ended, where to, when, the user's role and the fare;
// opened, the full route and the other person. Redo works either way.
function TripRow({ trip, when, open, onToggle, onRedo, onFindAnother }: RowProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const finished = trip.statusLabel === 'Completed';
  const drove = trip.role === 'driver';
  // A cancelled ride moved no money, so it shows no price.
  const price = finished && trip.price != null
    ? `${drove ? '+' : ''}${trip.estimated ? '~' : ''}$${trip.price.toFixed(2)}`
    : null;
  const person = trip.otherName ? `${drove ? 'Rider' : 'Driver'}: ${trip.otherName}` : 'No passenger';
  // Why it was cancelled, when there is more to say than that.
  const reason = trip.statusLabel === 'Cancelled by driver' || trip.statusLabel === 'No show'
    ? trip.statusLabel : null;
  // The whole card is read as one control, so what shows when it is open is part of its label.
  const spoken = [
    `${finished ? 'Finished' : 'Cancelled'} trip to ${trip.end}`,
    when,
    drove ? 'You drove' : 'You rode',
    price,
    open && `From ${trip.start}`,
    open && person,
    open && reason,
  ].filter(Boolean).join(', ');

  return (
    // The whole card opens and closes the trip, with no press effect. The buttons inside take
    // their own presses.
    <PressButton
      ripple={false}
      pressScale={1}
      style={styles.card}
      onPress={onToggle}
      accessibilityRole='button'
      accessibilityLabel={spoken}
      accessibilityState={{ expanded: open }}
    >
      <View style={styles.main}>
        <View style={[styles.outcome, { backgroundColor: finished ? colors.successTint : colors.alertTint }]}>
          <Ionicons
            name={finished ? 'checkmark' : 'close'}
            size={20}
            color={finished ? colors.onSuccessTint : colors.alertText}
          />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.destination} numberOfLines={1}>{trip.end}</Text>
          <View style={styles.meta}>
            <View style={styles.role}>
              <Icon name={drove ? 'steering-wheel' : 'rider'} size={15} color={colors.text} />
            </View>
            <Text style={styles.when}>{when}</Text>
            <View style={styles.spacer} />
            {price && <Text style={[styles.price, drove && { color: colors.onSuccessTint }]}>{price}</Text>}
          </View>
        </View>
        <View style={styles.controls}>
          <PressButton
            ripple={false}
            style={styles.redo}
            onPress={onRedo}
            hitSlop={4}
            accessibilityRole='button'
            accessibilityLabel={`Redo trip to ${trip.end}`}
          >
            <Ionicons name='refresh' size={22} color={colors.onTint} />
          </PressButton>
          <View style={styles.arrow}>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
          </View>
        </View>
      </View>

      {open && (
        <View style={styles.details}>
          <View style={styles.stop}>
            <View style={styles.marker}>
              <View style={styles.startDot} />
            </View>
            <Text style={styles.stopText}>{trip.start}</Text>
          </View>
          <View style={styles.stop}>
            <View style={styles.marker}>
              <Icon name='map-pin' size={16} color={colors.alert} />
            </View>
            <Text style={styles.stopText}>{trip.end}</Text>
          </View>
          <Text style={styles.person}>{person}</Text>
          {reason && <Text style={styles.person}>{reason}</Text>}
          {onFindAnother && (
            <PressButton ripple={false} style={styles.findAnother} onPress={onFindAnother}>
              <Text style={styles.findAnotherText}>Find another driver</Text>
            </PressButton>
          )}
        </View>
      )}
    </PressButton>
  );
}

type Props = {
  // Finished and cancelled trips, newest first.
  trips: PreviousTrip[];
  onRedo: (trip: PreviousTrip) => void;
  onFindAnother: (trip: PreviousTrip) => void;
};

// The History tab: past trips in Today, Yesterday and More folders that open and close.
export default function TripHistory({ trips, onRedo, onFindAnother }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  // Folders the user has opened or closed themselves, and the trips they have opened.
  const [chosen, setChosen] = useState<Partial<Record<FolderKey, boolean>>>({});
  const [openTrips, setOpenTrips] = useState<string[]>([]);
  const now = new Date();

  const folders = (Object.keys(folderNames) as FolderKey[])
    .map((key) => ({ key, items: trips.filter((t) => folderOf(t.departAt, now) === key) }))
    .filter((folder) => folder.items.length > 0);

  function toggleTrip(key: string) {
    setOpenTrips((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }

  return (
    <View>
      {folders.map((folder) => {
        // More starts closed, unless it is the only folder there is.
        const open = chosen[folder.key] ?? (folder.key !== 'more' || folders.length === 1);
        return (
          <View key={folder.key}>
            <PressButton
              ripple={false}
              pressScale={1}
              style={styles.folder}
              onPress={() => setChosen((c) => ({ ...c, [folder.key]: !open }))}
              accessibilityRole='button'
              accessibilityLabel={`${folderNames[folder.key]}, ${folder.items.length} trips`}
              accessibilityState={{ expanded: open }}
            >
              <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={20} color={colors.textSecondary} />
              <Text style={styles.folderName}>{folderNames[folder.key]}</Text>
              <Text style={styles.count}>{folder.items.length}</Text>
            </PressButton>
            {open && (
              <View style={styles.list}>
                {folder.items.map((trip) => (
                  <TripRow
                    key={trip.key}
                    trip={trip}
                    when={whenText(trip.departAt, folder.key, now)}
                    open={openTrips.includes(trip.key)}
                    onToggle={() => toggleTrip(trip.key)}
                    onRedo={() => onRedo(trip)}
                    onFindAnother={trip.reopenedRequestId ? () => onFindAnother(trip) : undefined}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    folder: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 12 },
    folderName: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    count: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, paddingRight: 4 },
    list: { gap: 10, paddingBottom: 8 },

    card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border },
    // How it ended, the trip, then the redo button and the open / close arrow.
    main: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 4 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    outcome: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    summaryText: { flex: 1, gap: 4 },
    destination: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    when: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    // The grey bubble showing whether the user drove or rode.
    role: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.statBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spacer: { flex: 1 },
    price: { fontFamily: fonts.semibold, fontSize: 14, color: c.text },
    redo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrow: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },

    details: { borderTopWidth: 1, borderTopColor: c.border, marginHorizontal: 12, paddingVertical: 12, gap: 8 },
    stop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    marker: { width: 20, alignItems: 'center' },
    startDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand },
    stopText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: c.text },
    person: { fontFamily: fonts.regular, fontSize: 13, color: c.textSecondary },
    findAnother: {
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    findAnotherText: { fontFamily: fonts.semibold, fontSize: 15, color: c.onBrand },
  });
