import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/global';
import { Image } from 'expo-image';
import {
  Drawer,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { Alert } from 'react-native';

function DrawerContent(props: DrawerContentComponentProps) {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Log out failed', error.message);
  };

  return (
    <DrawerContentScrollView {...props}>
      <Image
        source={require('../../../assets/images/Blue@ease.png')}
        style={{ width: 180, aspectRatio: 444 / 177, alignSelf: 'center', marginVertical: 20, marginBottom: 40 }}
        contentFit='contain'
      />
      <DrawerItemList {...props} />
      <DrawerItem label='Log out' labelStyle={{ color: colors.alert, fontWeight: 'bold' }} onPress={handleLogout} />
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: "white",
        drawerInactiveTintColor: "#1E90FF",
        drawerActiveBackgroundColor: "#1E90FF",
      }}
    >

      <Drawer.Screen name='index' options={{
        drawerLabel: 'Home', title: 'Home', drawerIcon: ({ color, size }) => (
          <Image
            source={require('../../../assets/images/HomeIconWhite.png')}
            style={{ width: size, height: size }}
            tintColor={color as string}
            contentFit='contain'
          />
        ),
      }} />
      <Drawer.Screen name='rides' options={{
        drawerLabel: 'Rides', title: 'Rides', drawerIcon: ({ color, size }) => (
          <Image
            source={require('../../../assets/images/carIcon.png')}
            style={{ width: size, height: size }}
            tintColor={color as string}
            contentFit='contain'
          />
        ),
      }} />
      <Drawer.Screen name='profile' options={{
        drawerLabel: 'Profile', title: 'Profile', drawerIcon: ({ color, size }) => (
          <Image
            source={require('../../../assets/images/account_circle_black.png')}
            style={{ width: size, height: size }}
            tintColor={color as string}
            contentFit='contain'
          />
        ),
      }} />
      <Drawer.Screen name='settings' options={{
        drawerLabel: 'Settings', title: 'Settings', drawerIcon: ({ color, size }) => (
          <Image
            source={require('../../../assets/images/SettingsIconBlack.png')}
            style={{ width: size, height: size }}
            tintColor={color as string}
            contentFit='contain'
          />
        ),
      }} />
    </Drawer>
  );
}
