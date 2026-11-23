import { AuthCard, Field, SubmitButton } from '@/components/AuthForm';
import { errText } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNotify } from '@/lib/notify';

export default function LoginScreen() {
  const notify = useNotify();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  function validate() {
    if (!email.trim() || !password) {
      notify({ kind: 'alert', title: 'Missing info', subtitle: 'Enter your email and password.' });
      return false;
    }
    return true;
  }

  async function signIn() {
    if (!validate()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (err) {
      notify({ kind: 'alert', title: 'Login failed', subtitle: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <Field
        label='Email'
        placeholder='please enter your email'
        autoCapitalize='none'
        autoComplete='email'
        keyboardType='email-address'
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label='Password'
        placeholder='please enter your password'
        secureTextEntry
        autoComplete='password'
        value={password}
        onChangeText={setPassword}
      />
      <SubmitButton label='Log in' busy={busy} onPress={signIn} />

      <View style={styles.footerRow}>
        <Pressable
          onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
          hitSlop={8}
        >
          <Text style={styles.footerLink}>Forgot password?</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/signup')} hitSlop={8}>
          <Text style={styles.footerText}>
            New Here? <Text style={styles.footerLink}>Sign up</Text>
          </Text>
        </Pressable>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 },
  footerText: { fontSize: 12, color: '#9a9a9a' },
  footerLink: { fontSize: 12, color: colors.brand, fontWeight: '600' },
});
