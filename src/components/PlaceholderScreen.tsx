import MenuButton from '@/components/MenuButton';
import { useTheme } from '@/lib/theme';
import { fonts } from '@/styles/fonts';
import { type Colors } from '@/styles/theme';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from 'expo-router/drawer';
import { StyleSheet, Text, View } from 'react-native';

// Stand-in for a page that isn't built yet.
export default function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
      <MenuButton onPress={() => navigation.openDrawer()} />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
      gap: 8,
    },
    title: { fontFamily: fonts.titleSemibold, fontSize: 28, color: c.text },
    note: { fontFamily: fonts.regular, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
  });
