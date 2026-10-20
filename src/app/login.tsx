import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  function validate() {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
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
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Login failed', message);
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email above, then tap Forgot password again.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) Alert.alert('Could not send reset email', error.message);
    else Alert.alert('Check your inbox', 'We sent you a password reset link.');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Image source={require('../../assets/images/ease-logo-tiny.png')} style={styles.logo} contentFit='contain' />
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          placeholder='please enter your email'
          placeholderTextColor={PLACEHOLDER}
          autoCapitalize='none'
          autoComplete='email'
          keyboardType='email-address'
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          placeholder='please enter your password'
          placeholderTextColor={PLACEHOLDER}
          secureTextEntry
          autoComplete='password'
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        {busy ? (
          <ActivityIndicator color={DARK} style={styles.spinner} />
        ) : (
          <Pressable style={styles.button} onPress={signIn}>
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
        )}
        <Pressable onPress={forgotPassword} style={styles.linkWrap}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/signup')} style={styles.linkWrap}>
          <Text style={styles.link}>New Here?</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const DARK = '#1a1a1a';
const PLACEHOLDER = '#b5b5b5';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 123,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  logo: {
    // The image has transparent padding; these values keep the visible mark ~178px wide
    // and in the same spot as the old full-size logo.
    width: 348,
    aspectRatio: 444 / 177,
    alignSelf: 'center',
    marginBottom: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#d9d9d9',
    borderRadius: 10,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  label: { fontSize: 16, color: '#1a1a1a', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "black",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16 },
  spinner: { paddingVertical: 10, marginTop: 4, marginBottom: 20 },
  linkWrap: { alignSelf: 'flex-start', marginBottom: 8 },
  link: { fontSize: 16, color: '#1a1a1a', textDecorationLine: 'underline' },
});
