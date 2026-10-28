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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// A label with an optional info icon, above its input.
function Field({
  label,
  info,
  ...input
}: { label: string; info?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {info && (
          <Pressable onPress={() => Alert.alert('Info', info)} hitSlop={8}>
            <Image
              source={require('../../assets/images/InfoIcon.png')}
              style={styles.infoIcon}
              contentFit='contain'
            />
          </Pressable>
        )}
      </View>
      <TextInput placeholderTextColor={PLACEHOLDER} style={styles.input} {...input} />
    </View>
  );
}

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  function validate() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Alert.alert('Missing info', 'Fill in every field.');
      return false;
    }
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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { firstName: firstName.trim(), lastName: lastName.trim() } },
      });
      if (error) throw error;

      // With email confirmation enabled there is no session until they confirm.
      if (!data.session || !data.user) {
        Alert.alert('Almost there', 'Check your inbox to confirm your email, then log in.');
        router.back();
        return;
      }

      // The users row is created by a database trigger (supabase/driver_setup.sql),
      // which reads firstName and lastName from the metadata sent above.
      router.replace('/welcome');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Sign up failed', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 56 }]}
        keyboardShouldPersistTaps='handled'
      >
        <Image
          source={require('../../assets/images/account_circle.png')}
          tintColor={colors.brand}
          style={styles.avatar}
          contentFit='contain'
        />
        <Text style={styles.title}>Create an Account</Text>

        <Field
          label='First Name'
          info='Your legal first name.'
          placeholder='John'
          autoComplete='given-name'
          value={firstName}
          onChangeText={setFirstName}
        />
        <Field
          label='Last Name'
          info='Your legal last name.'
          placeholder='Doe'
          autoComplete='family-name'
          value={lastName}
          onChangeText={setLastName}
        />
        <Field
          label='Email'
          info='Used to log in and to contact you about rides.'
          placeholder='example@ease.com'
          autoCapitalize='none'
          autoComplete='email'
          keyboardType='email-address'
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label='Password'
          info='At least 6 characters.'
          placeholder='please enter a secure password'
          secureTextEntry
          autoComplete='new-password'
          value={password}
          onChangeText={setPassword}
        />
        <Field
          label='Confirm Password'
          placeholder='please re-enter your password'
          secureTextEntry
          autoComplete='new-password'
          value={confirm}
          onChangeText={setConfirm}
        />

        {busy ? (
          <ActivityIndicator color={colors.brand} style={styles.spinner} />
        ) : (
          <Pressable style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        )}
      </ScrollView>

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
  content: { paddingHorizontal: 28, paddingBottom: 40 },
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
    marginBottom: 28,
  },
  field: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  infoIcon: { width: 14, height: 14 },
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
