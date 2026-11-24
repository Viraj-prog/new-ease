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
import { useNotify } from '@/lib/notify';

type Status = 'verifying' | 'ready' | 'invalid';

// Supabase puts the recovery tokens (or an error) in the link's #fragment.
function readFragment(url: string) {
  return new URLSearchParams(url.split('#')[1] ?? '');
}

export default function ResetPasswordScreen() {
  const notify = useNotify();
  const { session, beginRecovery, endRecovery } = useAuth();
  const url = Linking.useLinkingURL();
  const params = readFragment(url ?? '');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const isRecoveryLink = params.get('type') === 'recovery' && !!accessToken && !!refreshToken;
  const [verification, setVerification] = useState<{ url: typeof url; status: Status } | null>(null);
  const status = isRecoveryLink
    ? verification?.url === url && verification ? verification.status : 'verifying'
    : 'invalid';
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
    if (!isRecoveryLink || !accessToken || !refreshToken) return;

    let cancelled = false;
    // Hide the session from the rest of the app before it exists.
    beginRecovery();
    recovering.current = true;
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (cancelled) return;
      if (!error) {
        setVerification({ url, status: 'ready' });
        return;
      }
      console.warn('recovery setSession failed', error.message);
      recovering.current = false;
      endRecovery(true);
      setVerification({ url, status: 'invalid' });
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, beginRecovery, endRecovery, isRecoveryLink, refreshToken, url]);

  async function submit() {
    const problem = passwordProblem(password, confirm);
    if (problem) {
      notify({ kind: 'alert', title: problem[0], subtitle: problem[1] });
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
      notify({ kind: 'alert', title: 'Could not update password', subtitle: errText(err) });
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
