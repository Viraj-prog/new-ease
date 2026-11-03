import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type Status = 'verifying' | 'ready' | 'invalid';

// Supabase puts the recovery tokens (or an error) in the link's #fragment.
function readFragment(url: string) {
  return new URLSearchParams(url.split('#')[1] ?? '');
}

export default function ResetPasswordScreen() {
  const { height } = useWindowDimensions();
  const { session, beginRecovery, endRecovery } = useAuth();
  const url = Linking.useLinkingURL();
  const [status, setStatus] = useState<Status>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  // True while the reset session is active and the password has not been changed yet.
  const recovering = useRef(false);

  // Leaving without choosing a password must not leave the user logged in.
  useEffect(() => {
    return () => {
      if (recovering.current) endRecovery(false);
    };
  }, [endRecovery]);

  // Turn the emailed link into a recovery session so updateUser is allowed.
  useEffect(() => {
    if (!url) {
      setStatus('invalid');
      return;
    }
    const params = readFragment(url);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (params.get('type') !== 'recovery' || !accessToken || !refreshToken) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;
    // Hide the session from the rest of the app before it exists.
    beginRecovery();
    recovering.current = true;
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (cancelled) return;
      if (error) {
        console.warn('recovery setSession failed', error.message);
        recovering.current = false;
        endRecovery(true);
      }
      setStatus(error ? 'invalid' : 'ready');
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function validate() {
    if (password.length < 6) {
      Alert.alert('Weak password', 'Your password must be at least 6 characters.');
      return false;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Re-enter your password in both fields.');
      return false;
    }
    return true;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      recovering.current = false;
      await endRecovery(true);
      Alert.alert('Password updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Could not update password', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: height * 0.2 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Image
        source={require('../../assets/images/ease-logo-white.png')}
        style={styles.logo}
        contentFit='contain'
      />
      <View style={styles.card}>
        {status === 'verifying' && <ActivityIndicator color={colors.brand} style={styles.spinner} />}

        {status === 'invalid' && (
          <>
            <Text style={styles.title}>Link expired</Text>
            <Text style={styles.message}>
              This password reset link is invalid or has expired. Request a new one from the log in screen.
            </Text>
            <Pressable style={styles.button} onPress={() => router.replace(session ? '/' : '/login')}>
              <Text style={styles.buttonText}>{session ? 'Continue' : 'Back to log in'}</Text>
            </Pressable>
          </>
        )}

        {status === 'ready' && (
          <>
            <Text style={styles.title}>Choose a new password</Text>
            <Text style={styles.label}>New password</Text>
            <TextInput
              placeholder='please enter a new password'
              placeholderTextColor={PLACEHOLDER}
              secureTextEntry
              autoComplete='new-password'
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              placeholder='please re-enter your password'
              placeholderTextColor={PLACEHOLDER}
              secureTextEntry
              autoComplete='new-password'
              value={confirm}
              onChangeText={setConfirm}
              style={styles.input}
            />
            {busy ? (
              <ActivityIndicator color={colors.brand} style={styles.spinner} />
            ) : (
              <Pressable style={styles.button} onPress={submit}>
                <Text style={styles.buttonText}>Update password</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const PLACEHOLDER = '#b5b5b5';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: colors.brand,
  },
  logo: {
    width: 230,
    aspectRatio: 951 / 237,
    alignSelf: 'center',
    marginBottom: 36,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.brand, textAlign: 'center', marginBottom: 16 },
  message: { fontSize: 13, color: '#1a1a1a', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  spinner: { paddingVertical: 10, marginTop: 2 },
});
