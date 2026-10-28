import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors } from "@/styles/global";
import { Image } from 'expo-image';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function SettingsScreen() {
    const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
    const insets = useSafeAreaInsets();
    const { isDriver, driverMode, setDriverMode, refreshProfile } = useAuth();
    const [busy, setBusy] = useState(false);

    async function becomeDriver() {
        setBusy(true);
        // Database function that sets isDriver for the logged-in user only.
        const { error } = await supabase.rpc('become_driver');
        if (error) {
            Alert.alert('Could not become a driver', error.message);
        } else {
            await refreshProfile();
        }
        setBusy(false);
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Settings</Text>

            {isDriver ? (
                <>
                    <Text style={styles.driverNote}>
                        {driverMode
                            ? "You're in driver mode."
                            : "You're in passenger mode."}
                    </Text>
                    <Pressable style={styles.button} onPress={() => setDriverMode(!driverMode)}>
                        <Text style={styles.buttonText}>
                            {driverMode ? 'Switch to Passenger' : 'Switch to Driver'}
                        </Text>
                    </Pressable>
                </>
            ) : (
                <Pressable style={styles.button} onPress={becomeDriver} disabled={busy}>
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Become a Driver</Text>
                    )}
                </Pressable>
            )}

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    gap: 20,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  button: {
    backgroundColor: '#1E90FF',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16 },
  driverNote: { color: colors.text, fontSize: 16, textAlign: 'center' },
  menu: { position: 'absolute', left: 12 },
  menuIcon: { width: 70, height: 70 },
});
