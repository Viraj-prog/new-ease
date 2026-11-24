import Icon from '@/components/Icon';
import LogoutPopup from '@/components/LogoutPopup';
import SegmentedToggle from '@/components/SegmentedToggle';
import { useProfile } from '@/hooks/useProfile';
import { useRoleSwitch } from '@/hooks/useRoleSwitch';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Drawer, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotify } from '@/lib/notify';

type Item = { route: string; label: string; icon: (color: string) => ReactNode };

function DrawerContent(props: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { driverMode, switching, choose } = useRoleSwitch();
  const notify = useNotify();
  const { profile } = useProfile();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const first = profile?.firstName ?? '';
  const last = profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || 'Your profile';
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?';
  const rating = profile?.rating ? profile.rating.toFixed(1) : 'New';

  const current = props.state.routes[props.state.index]?.name;

  const items: Item[] = [
    { route: 'index', label: 'Home', icon: (c) => <Icon name='home' color={c} /> },
    { route: 'wallet', label: 'Wallet', icon: (c) => <Icon name='billing-card' color={c} /> },
    { route: 'rides', label: driverMode ? 'Scheduled Rides' : 'Trips', icon: (c) => <Icon name='trips-route' color={c} /> },
    { route: 'saved-trips', label: 'Saved Trips', icon: (c) => <Icon name='saved-bookmark' color={c} /> },
    { route: 'profile', label: 'Profile', icon: (c) => <Icon name='profile' color={c} /> },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoggingOut(false);
      setConfirmVisible(false);
      notify({ kind: 'alert', title: 'Log out failed', subtitle: error.message });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.ratingRow}>
            <Icon name='star' size={16} color={colors.star} />
            <Text style={styles.rating}>{rating}</Text>
          </View>
        </View>
      </View>

      <SegmentedToggle
        style={styles.toggle}
        options={[
          { key: 'driver', icon: 'steering-wheel', label: 'Driver' },
          { key: 'rider', icon: 'rider', label: 'Rider' },
        ]}
        value={driverMode ? 'driver' : 'rider'}
        onChange={(k) => choose(k === 'driver')}
        disabled={switching}
      />

      <View style={styles.items}>
        {items.map((item) => {
          const focused = current === item.route;
          return (
            <Pressable
              key={item.route}
              style={[styles.item, focused && styles.itemActive]}
              onPress={() =>
                focused ? props.navigation.closeDrawer() : props.navigation.navigate(item.route)
              }
            >
              {item.icon(focused ? colors.onTint : colors.textSecondary)}
              <Text style={styles.itemLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <Text style={styles.wordmark}>@Ease</Text>
      <View style={styles.divider} />
      <Pressable style={styles.item} onPress={() => setConfirmVisible(true)}>
        <Icon name='log-out' color={colors.alertText} />
        <Text style={[styles.itemLabel, styles.logoutLabel]}>Log Out</Text>
      </Pressable>

      <LogoutPopup
        visible={confirmVisible}
        loggingOut={loggingOut}
        onConfirm={handleLogout}
        onClose={() => setConfirmVisible(false)}
      />
    </View>
  );
}

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: colors.scrim,
        // The rounded panel is drawn by DrawerContent, so the container itself is see-through.
        drawerStyle: { backgroundColor: 'transparent', width: 300 },
      }}
    />
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.surface,
      borderTopRightRadius: 32,
      borderBottomRightRadius: 32,
      paddingHorizontal: 16,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.pill,
      borderRadius: 28,
      padding: 12,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: fonts.titleSemibold, fontSize: 24, color: c.onTint },
    profileText: { flex: 1, gap: 2 },
    name: { fontFamily: fonts.semibold, fontSize: 19, color: c.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rating: { fontFamily: fonts.regular, fontSize: 15, color: c.textSecondary },
    toggle: { marginTop: 16 },
    items: { marginTop: 16, gap: 4 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 16,
      height: 52,
      borderRadius: 20,
    },
    itemActive: { backgroundColor: c.selected },
    itemLabel: { fontFamily: fonts.medium, fontSize: 17, color: c.text },
    logoutLabel: { color: c.alertText },
    spacer: { flex: 1 },
    wordmark: {
      fontFamily: fonts.titleSemibold,
      fontSize: 22,
      color: c.brand,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    divider: { height: 1, backgroundColor: c.border, marginHorizontal: 16, marginBottom: 8 },
  });
