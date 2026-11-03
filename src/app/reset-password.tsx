import { AuthCard, Field, SubmitButton } from '@/components/AuthForm';
import { useAuth } from '@/lib/auth';
import { passwordProblem } from '@/lib/password';
import { errText } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';

type Status = 'verifying' | 'ready' | 'invalid';

// Supabase puts the recovery tokens (or an error) in the link's #fragment.
function readFragment(url: string) {
  return new URLSearchParams(url.split('#')[1] ?? '');
}

export default function ResetPasswordScreen() {
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
    const params = readFragment(url ?? '');
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
      if (!error) {
        setStatus('ready');
        return;
      }
      console.warn('recovery setSession failed', error.message);
      recovering.current = false;
      endRecovery(true);
      setStatus('invalid');
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function submit() {
    const problem = passwordProblem(password, confirm);
    if (problem) {
      Alert.alert(...problem);
      return;
    }
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
      Alert.alert('Could not update password', errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      {status === 'verifying' && <ActivityIndicator color={colors.brand} style={styles.verifying} />}

      {status === 'invalid' && (
        <>
          <Text style={styles.title}>Link expired</Text>
          <Text style={styles.message}>
            This password reset link is invalid or has expired. Request a new one from the log in screen.
          </Text>
          <SubmitButton
            label={session ? 'Continue' : 'Back to log in'}
            onPress={() => router.replace(session ? '/' : '/login')}
          />
        </>
      )}

      {status === 'ready' && (
        <>
          <Text style={styles.title}>Choose a new password</Text>
          <Field
            label='New password'
            placeholder='please enter a new password'
            secureTextEntry
            autoComplete='new-password'
            value={password}
            onChangeText={setPassword}
          />
          <Field
            label='Confirm password'
            placeholder='please re-enter your password'
            secureTextEntry
            autoComplete='new-password'
            value={confirm}
            onChangeText={setConfirm}
          />
          <SubmitButton label='Update password' busy={busy} onPress={submit} />
        </>
      )}
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', color: colors.brand, textAlign: 'center', marginBottom: 16 },
  message: { fontSize: 13, color: colors.label, textAlign: 'center', marginBottom: 16 },
  verifying: { paddingVertical: 10, marginTop: 2 },
});
