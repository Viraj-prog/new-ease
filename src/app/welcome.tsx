import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/ease-logo-tiny.png')}
        style={styles.logo}
        contentFit='contain'
      />
      <View style={styles.body}>
        <Image
          source={require('../../assets/images/accountMadeCheckmark.png')}
          style={styles.check}
          contentFit='contain'
        />
        <Text style={styles.title}>Account Successfully Created!</Text>
        <Text style={styles.subtitle}>Welcome to the @Ease Transit Community!</Text>
      </View>
      <Pressable style={styles.button} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.buttonText}>Start Riding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingHorizontal: 30,
    paddingBottom: 80,
  },
  logo: { width: 160, aspectRatio: 444 / 177, alignSelf: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  check: { width: 170, height: 170, marginBottom: 40 },
  title: { fontSize: 32, textAlign: 'center', color: colors.text, marginBottom: 40 },
  subtitle: { fontSize: 16, textAlign: 'center', color: colors.text },
  button: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16 },
});
