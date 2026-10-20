import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
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
  View,
} from 'react-native';
import { Image } from 'expo-image';

function InfoIcon({ message }: { message: string }) {
  return (
    <Pressable onPress={() => Alert.alert('Info', message)} hitSlop={8} style={styles.info}>
      <Image source={require('../../assets/images/InfoIcon.png')} style={styles.infoIcon} contentFit='contain' />
    </Pressable>
  );
}

export default function SignUpScreen() {
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

      // Without a session (email confirmation enabled) RLS would reject the insert.
      if (!data.session || !data.user) {
        Alert.alert('Almost there', 'Check your inbox to confirm your email, then log in.');
        router.back();
        return;
      }

      const { error: profileError } = await supabase.from('users').insert({
        userId: data.user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        isVerified: false,
        isDriver: false,
      });
      if (profileError) throw profileError;

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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
            <Image source={require('../../assets/images/backButton.png')} style={styles.backIcon} contentFit='contain' />
          </Pressable>
          <Image
            source={require('../../assets/images/ease-logo-tiny.png')}
            style={styles.logo}
            contentFit='contain'
          />
        </View>

        <Image
          source={require('../../assets/images/account_circle.png')}
          style={styles.avatar}
          contentFit='contain'
        />

        <View style={styles.row}>
          <View style={styles.labelWrap}>
            <Text style={styles.label}>First Name</Text>
            <InfoIcon message='Your legal first name.' />
          </View>
          <TextInput
            placeholder='John'
            placeholderTextColor={PLACEHOLDER}
            autoComplete='given-name'
            value={firstName}
            onChangeText={setFirstName}
            style={[styles.input, { width: 120 }]}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.labelWrap}>
            <Text style={styles.label}>Last Name</Text>
            <InfoIcon message='Your legal last name.' />
          </View>
          <TextInput
            placeholder='Doe'
            placeholderTextColor={PLACEHOLDER}
            autoComplete='family-name'
            value={lastName}
            onChangeText={setLastName}
            style={[styles.input, { width: 120 }]}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.labelWrap}>
            <Text style={styles.label}>Email</Text>
            <InfoIcon message='Used to log in and to contact you about rides.' />
          </View>
          <TextInput
            placeholder='example@ease.com'
            placeholderTextColor={PLACEHOLDER}
            autoCapitalize='none'
            autoComplete='email'
            keyboardType='email-address'
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { width: 185 }]}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.labelWrap}>
            <Text style={styles.label}>Password</Text>
            <InfoIcon message='At least 6 characters.' />
          </View>
          <TextInput
            placeholder='examplepassword'
            placeholderTextColor={PLACEHOLDER}
            secureTextEntry
            autoComplete='new-password'
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { width: 170 }]}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { width: 90 }]}>Confirm Password</Text>
          <TextInput
            placeholder='examplepassword'
            placeholderTextColor={PLACEHOLDER}
            secureTextEntry
            autoComplete='new-password'
            value={confirm}
            onChangeText={setConfirm}
            style={[styles.input, { width: 170 }]}
          />
        </View>

        {busy ? (
          <ActivityIndicator color={DARK} style={styles.spinner} />
        ) : (
          <Pressable style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const DARK = '#1a1a1a';
const PLACEHOLDER = '#b5b5b5';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 60, paddingHorizontal: 30, paddingBottom: 40 },
  header: { alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  // Image includes its own shadow padding; the button face is ~60% of the width.
  back: { position: 'absolute', left: -26, zIndex: 1 },
  backIcon: { width: 77, height: 77 },
  logo: { width: 160, aspectRatio: 444 / 177 },
  avatar: { width: 166, height: 166, alignSelf: 'center', marginBottom: 36 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 16, color: DARK },
  info: { width: 15, height: 15 },
  infoIcon: { width: 15, height: 15 },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  button: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16 },
  spinner: { paddingVertical: 12, marginTop: 24 },
});
