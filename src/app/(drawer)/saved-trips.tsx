import Icon from '@/components/Icon';
import MenuButton from '@/components/MenuButton';
import SavedPlaceDialog from '@/components/SavedPlaceDialog';
import { useSavedTrips } from '@/hooks/useSavedTrips';
import { useAuth } from '@/lib/auth';
import { slotItems, type SlotItem } from '@/lib/savedSlots';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InlineNotice from '@/components/InlineNotice';


export default function SavedTripsScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const { session } = useAuth();
  const places = useSavedTrips(session?.user.id);

  // The place being set or changed in the popup.
  const [editing, setEditing] = useState<SlotItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  // Changes each time the dialog opens, so it starts from fresh values.
  const [openCount, setOpenCount] = useState(0);

  const items = slotItems(places.saved);

  function open(item: SlotItem) {
    setDialogError('');
    setOpenCount((n) => n + 1);
    setEditing(item);
  }

  async function onSave(address: string) {
    if (!editing) return;
    setBusy(true);
    const err = await places.save(editing.label, editing.kind, address);
    setBusy(false);
    if (err) setDialogError(err);
    else setEditing(null);
  }

  async function onDelete() {
    const id = editing?.place?.id;
    if (!id) return;
    setBusy(true);
    const err = await places.remove(id);
    setBusy(false);
    if (err) setDialogError(err);
    else setEditing(null);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8 + 46 + 18,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
      >
        <Text style={styles.title}>Saved trips</Text>
        <Text style={styles.sub}>Tap a place to set or change its address.</Text>

        {!!places.error && (
          <InlineNotice
            style={styles.error}
            message={`Saved places could not load (${places.error}). If this is new, run supabase/saved_trips.sql in the Supabase SQL editor.`}
          />
        )}

        <View style={styles.list}>
          {items.map((it) => (
            <Pressable key={it.key} style={styles.row} onPress={() => open(it)}>
              <View style={styles.circle}>
                <Icon name={it.icon} size={22} color={colors.onTint} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.label}>{it.label}</Text>
                <Text style={it.place ? styles.address : styles.unset} numberOfLines={1}>
                  {it.place ? it.place.address : 'Set address'}
                </Text>
              </View>
              <Icon name='chevron-right' size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>

      </ScrollView>

      <MenuButton onPress={() => navigation.openDrawer()} />

      <SavedPlaceDialog
        key={openCount}
        visible={!!editing}
        label={editing?.label ?? ''}
        initialAddress={editing?.place?.address ?? ''}
        canDelete={!!editing?.place}
        error={dialogError}
        busy={busy}
        onSave={onSave}
        onDelete={onDelete}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    title: { fontFamily: fonts.titleSemibold, fontSize: 28, color: c.text },
    sub: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, marginTop: 4, marginBottom: 18 },
    error: { marginBottom: 14 },
    list: { gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
    },
    circle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1 },
    label: { fontFamily: fonts.semibold, fontSize: 17, color: c.text },
    address: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, marginTop: 2 },
    unset: { fontFamily: fonts.medium, fontSize: 14, color: c.brand, marginTop: 2 },
  });
