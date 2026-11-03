import { AuthPage, Field, SubmitButton } from '@/components/AuthForm';
import { passwordProblem } from '@/lib/password';
import { errText } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

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
    const problem = passwordProblem(password, confirm);
    if (problem) {
      Alert.alert(...problem);
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
      Alert.alert('Sign up failed', errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage>
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

      <SubmitButton label='Done' busy={busy} onPress={submit} />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 72, height: 72, alignSelf: 'center' },
  title: {
    textAlign: 'center',
    color: colors.brand,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 28,
  },
});
