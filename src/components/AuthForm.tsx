import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { createContext, useContext } from 'react';
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
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shared pieces of the log in, sign up and password screens. Fields and the submit
// button look slightly different inside a blue card than on a plain page.
type Look = 'card' | 'page';
const LookContext = createContext<Look>('page');

const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;

// Blue screen with the logo above a white card (log in, choose a new password).
export function AuthCard({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <LookContext.Provider value='card'>
      <KeyboardAvoidingView
        style={[styles.cardScreen, { paddingTop: height * 0.2 }]}
        behavior={keyboardBehavior}
      >
        <Image
          source={require('../../assets/images/ease-logo-white.png')}
          style={styles.logo}
          contentFit='contain'
        />
        <View style={styles.card}>{children}</View>
      </KeyboardAvoidingView>
    </LookContext.Provider>
  );
}

// White screen with a back button (sign up, reset email).
export function AuthPage({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <LookContext.Provider value='page'>
      <KeyboardAvoidingView style={styles.pageScreen} behavior={keyboardBehavior}>
        <ScrollView
          contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 56 }]}
          keyboardShouldPersistTaps='handled'
        >
          {children}
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
    </LookContext.Provider>
  );
}

// A label with an optional info icon, above its input.
export function Field({
  label,
  info,
  ...input
}: { label: string; info?: string } & TextInputProps) {
  const look = looks[useContext(LookContext)];
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
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={[styles.input, look.input]}
        {...input}
      />
    </View>
  );
}

// The main button, swapped for a spinner while busy.
export function SubmitButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy?: boolean;
  onPress: () => void;
}) {
  const look = looks[useContext(LookContext)];
  if (busy) return <ActivityIndicator color={colors.brand} style={look.spinner} />;
  return (
    <Pressable style={[styles.button, look.button]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const looks = {
  card: StyleSheet.create({
    input: { borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
    button: { borderRadius: 20, paddingVertical: 10, marginTop: 2 },
    spinner: { paddingVertical: 10, marginTop: 2 },
  }),
  page: StyleSheet.create({
    input: { borderRadius: 14, paddingHorizontal: 14, fontSize: 13 },
    button: { borderRadius: 22, paddingVertical: 12, alignSelf: 'center', width: '70%', marginTop: 32 },
    spinner: { paddingVertical: 12, marginTop: 32 },
  }),
};

const styles = StyleSheet.create({
  cardScreen: { flex: 1, paddingHorizontal: 20, backgroundColor: colors.brand },
  logo: { width: 230, aspectRatio: 951 / 237, alignSelf: 'center', marginBottom: 36 },
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
  pageScreen: { flex: 1, backgroundColor: colors.background },
  pageContent: { paddingHorizontal: 28, paddingBottom: 40 },
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
  field: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.label },
  infoIcon: { width: 14, height: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 9,
    color: colors.text,
  },
  button: { backgroundColor: colors.brand, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
});
