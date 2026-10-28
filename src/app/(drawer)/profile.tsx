import { ageFrom, useProfile } from '@/hooks/useProfile';
import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Field({ label, value, done }: { label: string; value: string; done: boolean }) {
    return (
        <View style={styles.fieldRow}>
            <Image
                source={
                    done
                        ? require('../../../assets/images/check_small.png')
                        : require('../../../assets/images/XcircleIcon.png')
                }
                style={styles.status}
                contentFit='contain'
            />
            <Text style={styles.fieldLabel}>{label}</Text>
            <Image
                source={require('../../../assets/images/EditIcon.png')}
                style={styles.pencil}
                contentFit='contain'
            />
            <Text style={styles.fieldValue}>{value}</Text>
        </View>
    );
}

export default function ProfileScreen() {
    const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
    const insets = useSafeAreaInsets();
    const { profile, loading, error, email } = useProfile();

    const name = `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();
    const age = ageFrom(profile?.dateOfBirth ?? null);
    // Passengers have no rating, so they see empty stars.
    const filledStars = Math.max(0, Math.min(5, Math.round(profile?.rating ?? 0)));

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: 40 }}>
                <View style={styles.avatar}>
                    <Image
                        source={
                            profile?.profilePicture
                                ? { uri: profile.profilePicture }
                                : require('../../../assets/images/account_circle.png')
                        }
                        style={styles.avatarImage}
                        contentFit='cover'
                    />
                    <Pressable style={styles.avatarBadge}>
                        <Image
                            source={require('../../../assets/images/XcircleIcon.png')}
                            style={styles.avatarBadgeIcon}
                            contentFit='contain'
                        />
                    </Pressable>
                </View>

                <View style={styles.stars}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Image
                            key={i}
                            source={
                                i < filledStars
                                    ? require('../../../assets/images/star_filled.png')
                                    : require('../../../assets/images/star_unfilled.png')
                            }
                            style={styles.star}
                            contentFit='contain'
                        />
                    ))}
                </View>

                {loading && !profile ? (
                    <ActivityIndicator color={colors.brand} style={styles.loading} />
                ) : (
                    <>
                        <Text style={styles.name}>{name || 'No name yet'}</Text>
                        <View style={styles.verifyRow}>
                            <View style={[styles.chip, profile?.isVerified && styles.chipVerified]}>
                                <Text style={styles.chipText}>
                                    {profile?.isVerified ? 'Verified' : 'Not Verified'}
                                </Text>
                            </View>
                            {!profile?.isVerified && <Text style={styles.link}>Verify Account</Text>}
                        </View>
                        <Text style={styles.rides}>Total Rides: {profile?.totalRides ?? 0}</Text>
                    </>
                )}

                {!!error && <Text style={styles.error}>{error}</Text>}

                <View style={styles.fields}>
                    <Field label='Email Address' value={email ?? 'N/A'} done={!!email} />
                    <Field label='Password' value='••••••••••••' done />
                    <Field label='Age' value={age === null ? 'N/A' : String(age)} done={age !== null} />
                    <Field label='Gender' value='N/A' done={false} />
                </View>
            </ScrollView>

            <Pressable
                onPress={() => navigation.openDrawer()}
                style={[styles.menu, { top: insets.top + 8 }]}
                hitSlop={8}
            >
                <Image
                    source={require('../../../assets/images/menuButton.png')}
                    style={styles.menuIcon}
                    contentFit='contain'
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    menu: { position: 'absolute', left: 12 },
    menuIcon: { width: 70, height: 70 },
    avatar: {
        width: 220,
        height: 220,
        alignSelf: 'center',
    },
    avatarImage: { width: 220, height: 220, borderRadius: 110 },
    avatarBadge: {
        position: 'absolute',
        right: 0,
        bottom: 0,
    },
    avatarBadgeIcon: { width: 44, height: 44 },
    stars: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
    star: { width: 20, height: 20 },
    loading: { marginTop: 20 },
    name: { textAlign: 'center', fontSize: 36, fontWeight: '700', marginTop: 8 },
    verifyRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    chip: {
        backgroundColor: '#d9d9d9',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    chipVerified: { backgroundColor: '#bbf7d0' },
    chipText: { color: '#555', fontSize: 13 },
    link: { textDecorationLine: 'underline', color: '#555', fontSize: 13 },
    rides: { textAlign: 'center', color: '#777', marginTop: 8 },
    error: { textAlign: 'center', color: colors.alert, marginTop: 8, paddingHorizontal: 30 },
    fields: { paddingHorizontal: 40, marginTop: 32, gap: 12 },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    status: { width: 18, height: 18 },
    fieldLabel: { fontSize: 15 },
    pencil: { width: 16, height: 16 },
    fieldValue: { marginLeft: 'auto', fontSize: 12 },
});
