import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  // The login screen passes along whatever the user already typed.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);

  async function sendLink() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type the email you signed up with.');
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
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Could not send reset email', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top + 56 }]}>
        
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.message}>
          Enter your email and we'll send you a link to choose a new password.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          placeholder='example@ease.com'
          placeholderTextColor={PLACEHOLDER}
          autoCapitalize='none'
          autoComplete='email'
          keyboardType='email-address'
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        {busy ? (
          <ActivityIndicator color={colors.brand} style={styles.spinner} />
        ) : (
          <Pressable style={styles.button} onPress={sendLink}>
            <Text style={styles.buttonText}>Send reset link</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={[styles.back, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Image
          source={require('../../assets/images/ArrowleftIcon.png')}
          style={styles.backIcon}
          contentFit='contain'
        />
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const PLACEHOLDER = '#b5b5b5';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 28 },
  back: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  backIcon: { width: 20, height: 20 },
  avatar: { width: 72, height: 72, alignSelf: 'center' },
  title: {
    textAlign: 'center',
    color: colors.brand,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  message: { textAlign: 'center', fontSize: 13, color: '#1a1a1a', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'center',
    width: '70%',
    marginTop: 32,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  spinner: { paddingVertical: 12, marginTop: 32 },
});
