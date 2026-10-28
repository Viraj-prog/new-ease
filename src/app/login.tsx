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
  useWindowDimensions,
  View,
} from 'react-native';

export default function LoginScreen() {
  const { height } = useWindowDimensions();
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
          <ActivityIndicator color={colors.brand} style={styles.spinner} />
        ) : (
          <Pressable style={styles.button} onPress={signIn}>
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
        )}

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <Pressable onPress={() => router.push('/signup')} hitSlop={8}>
            <Text style={styles.signupLink}>Sign up</Text>
          </Pressable>
        </View>
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
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  signupText: { fontSize: 12, color: '#9a9a9a' },
  signupLink: { fontSize: 12, color: colors.brand, fontWeight: '600' },
});
