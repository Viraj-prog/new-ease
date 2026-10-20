import { AuthProvider, useAuth } from '@/lib/auth';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;
  SplashScreen.hideAsync();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name='(tabs)' />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name='login' />
      </Stack.Protected>
      {/* Unguarded so they stay mounted when signUp creates a session mid-flow */}
      <Stack.Screen name='signup' />
      <Stack.Screen name='welcome' />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
