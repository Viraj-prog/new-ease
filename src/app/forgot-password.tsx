import { AuthPage, backToLogin, Field, SubmitButton } from '@/components/AuthForm';
import { errText } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useNotify } from '@/lib/notify';

export default function ForgotPasswordScreen() {
  const notify = useNotify();
  // The login screen passes along whatever the user already typed.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);

  async function sendLink() {
    if (!email.trim()) {
      notify({ kind: 'alert', title: 'Enter your email', subtitle: 'Type the email you signed up with.' });
      return;
    }
    setBusy(true);
    try {
      // The emailed link opens the app on the reset-password screen.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) throw error;
      Alert.alert(
        'Check your inbox',
        'If an account exists for that email, we sent a link to reset your password.',
        [{ text: 'OK', onPress: backToLogin }]
      );
    } catch (err) {
      notify({ kind: 'alert', title: 'Could not send reset email', subtitle: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.message}>
        Enter your email and we&apos;ll send you a link to choose a new password.
      </Text>

      <Field
        label='Email'
        placeholder='example@ease.com'
        autoCapitalize='none'
        autoComplete='email'
        keyboardType='email-address'
        value={email}
        onChangeText={setEmail}
      />

      <SubmitButton label='Send reset link' busy={busy} onPress={sendLink} />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    color: colors.brand,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  message: { textAlign: 'center', fontSize: 13, color: colors.label, marginBottom: 28 },
});
