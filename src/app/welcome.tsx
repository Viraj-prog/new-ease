import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/accountMadeCheckmarkGreen.png')}
        style={styles.check}
        contentFit='contain'
      />
      <Text style={styles.title}>Account Successfully Created!</Text>
      <Pressable style={styles.button} onPress={() => router.replace('/')}>
        <Text style={styles.buttonText}>Start Riding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  check: { width: 150, height: 150, marginBottom: 28 },
  title: {
    fontSize: 24,
    textAlign: 'center',
    color: colors.text,
    marginBottom: 28,
  },
  button: {
    backgroundColor: colors.success,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
});
