import InlineNotice from '@/components/InlineNotice';
import MenuButton from '@/components/MenuButton';
import ThemeToggle from '@/components/ThemeToggle';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { Image } from 'expo-image';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const insets = useSafeAreaInsets();
  const { profile, loading, error, email } = useProfile();

  const name = `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();
  // Passengers have no rating yet.
  const rating = profile?.rating ? Number(profile.rating).toFixed(1) : '—';
  const avatar = colors.avatars[4];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 40, paddingHorizontal: 24 }}>
        <View style={styles.card}>
          {profile?.profilePicture ? (
            <Image source={{ uri: profile.profilePicture }} style={styles.avatar} contentFit='cover' />
          ) : (
            <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
              <Text style={[styles.initials, { color: avatar.fg }]}>{initialsOf(name)}</Text>
            </View>
          )}

          {loading && !profile ? (
            <ActivityIndicator color={colors.brand} style={styles.loading} />
          ) : (
            <Text style={styles.name} numberOfLines={1}>
              {name || 'No name yet'}
            </Text>
          )}

          {!!error && <InlineNotice message={error} style={styles.error} />}

          <View style={styles.inset}>
            <View style={styles.stat}>
              <Text style={styles.label}>Total Rides</Text>
              <Text style={styles.statValue}>{profile?.totalRides ?? 0}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.label}>Rating</Text>
              <Text style={styles.statValue}>{rating}</Text>
            </View>
          </View>

          <View style={[styles.inset, styles.emailBox]}>
            <Text style={styles.label}>Email Address</Text>
            <Text style={styles.email} numberOfLines={1}>
              {email ?? 'N/A'}
            </Text>
          </View>

          <View style={styles.toggle}>
            <ThemeToggle depth />
          </View>
        </View>

      </ScrollView>

      <MenuButton onPress={() => navigation.openDrawer()} />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    card: {
      backgroundColor: c.card,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingTop: 29,
      paddingBottom: 22,
    },
    avatar: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
    initials: { fontFamily: fonts.titleSemibold, fontSize: 45 },
    loading: { marginTop: 19 },
    name: { fontFamily: fonts.titleSemibold, fontSize: 26, color: c.text, marginTop: 16, marginBottom: 22, textAlign: 'center' },
    error: { marginBottom: 10 },
    inset: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      backgroundColor: c.background,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 13,
      boxShadow: `0px 6px 14px ${c.shadow}`,
    },
    stat: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: c.border, marginVertical: 2 },
    label: { fontFamily: fonts.semibold, fontSize: 13, color: c.textSecondary },
    statValue: { fontFamily: fonts.titleSemibold, fontSize: 27, color: c.text },
    emailBox: { flexDirection: 'column', alignItems: 'center', marginTop: 16, paddingVertical: 11 },
    email: {
      fontFamily: fonts.regular,
      fontSize: 14,
      color: c.text,
      marginTop: 2,
      textAlign: 'center',
      paddingHorizontal: 10,
    },
    toggle: { marginTop: 16 },
  });
