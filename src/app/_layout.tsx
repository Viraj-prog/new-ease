import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;
  SplashScreen.hideAsync();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name='(drawer)' />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name='login' />
        <Stack.Screen name='forgot-password' />
      </Stack.Protected>
      {/* Unguarded so they stay mounted when signUp creates a session mid-flow */}
      <Stack.Screen name='signup' />
      <Stack.Screen name='welcome' />
      {/* Unguarded: the recovery link signs the user in before they pick a new password */}
      <Stack.Screen name='reset-password' />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Keep the splash screen up until fonts are ready. If loading fails, carry on with system fonts.
  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
